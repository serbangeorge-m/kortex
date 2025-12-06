#!/bin/bash
#
# Copyright (C) 2025 Red Hat, Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

# Ollama Setup Script for CI/CD environments
# Supports: Linux (Ubuntu), macOS, Windows (via Git Bash/WSL)
# Compatible with GHA runners: ubuntu-24.04, macos-15-intel, macos-26, windows-2025, windows-11-arm

set -e

# Default model to pull (small and fast for CI)
DEFAULT_MODEL="${OLLAMA_MODEL:-tinyllama}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

detect_os() {
    case "$(uname -s)" in
        Linux*)     echo "linux";;
        Darwin*)    echo "macos";;
        CYGWIN*|MINGW*|MSYS*) echo "windows";;
        *)          echo "unknown";;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)   echo "amd64";;
        arm64|aarch64)  echo "arm64";;
        *)              echo "unknown";;
    esac
}

install_ollama_linux() {
    log_info "Installing Ollama on Linux..."
    
    if command -v ollama &> /dev/null; then
        log_info "Ollama is already installed"
        ollama --version
        return 0
    fi

    # Use official install script
    curl -fsSL https://ollama.ai/install.sh | sh

    # Wait for systemd service to start (if available)
    if command -v systemctl &> /dev/null; then
        log_info "Waiting for Ollama service to start..."
        sleep 5
        
        # Check if service is running
        if systemctl is-active --quiet ollama 2>/dev/null; then
            log_info "Ollama service is running"
        else
            log_warn "Ollama service not running via systemd, starting manually..."
            ollama serve &
            sleep 3
        fi
    else
        # No systemd, start manually
        log_info "Starting Ollama server manually..."
        ollama serve &
        sleep 3
    fi
}

install_ollama_macos() {
    log_info "Installing Ollama on macOS..."

    if command -v ollama &> /dev/null; then
        log_info "Ollama is already installed"
        ollama --version
        return 0
    fi

    # Check if Homebrew is available
    if command -v brew &> /dev/null; then
        log_info "Installing Ollama via Homebrew..."
        brew install ollama
    else
        # Use official install script
        log_info "Installing Ollama via official script..."
        curl -fsSL https://ollama.ai/install.sh | sh
    fi

    # Start Ollama server
    log_info "Starting Ollama server..."
    ollama serve &
    sleep 3
}

install_ollama_windows() {
    log_info "Installing Ollama on Windows..."

    if command -v ollama &> /dev/null; then
        log_info "Ollama is already installed"
        ollama --version
        return 0
    fi

    local arch=$(detect_arch)
    local download_url=""

    if [ "$arch" = "amd64" ]; then
        download_url="https://ollama.ai/download/OllamaSetup.exe"
    elif [ "$arch" = "arm64" ]; then
        download_url="https://ollama.ai/download/OllamaSetup.exe"
    else
        log_error "Unsupported architecture: $arch"
        exit 1
    fi

    # Use Windows temp directory
    local temp_dir="${TEMP:-/c/Windows/Temp}"
    local installer_path="$temp_dir/OllamaSetup.exe"

    log_info "Downloading Ollama installer to $installer_path..."
    curl -fsSL -o "$installer_path" "$download_url"

    if [ ! -f "$installer_path" ]; then
        log_error "Failed to download installer"
        exit 1
    fi

    log_info "Running Ollama installer (silent mode)..."
    # Use start /wait to ensure the installer completes before proceeding
    # /S flag for silent installation
    cmd.exe /c "start /wait \"\" \"$installer_path\" /S" || {
        log_warn "Standard silent install failed, trying alternative method..."
        # Fallback: run directly with timeout
        timeout 120 "$installer_path" /S || log_warn "Installer may have completed or timed out"
    }

    # Wait for installation to finalize and find installation directory
    log_info "Waiting for installation to complete..."
    
    # Possible installation locations
    local possible_paths=(
        "/c/Users/$USER/AppData/Local/Programs/Ollama"
        "/c/Program Files/Ollama"
        "/c/Program Files (x86)/Ollama"
        "$LOCALAPPDATA/Programs/Ollama"
        "$PROGRAMFILES/Ollama"
    )
    
    local ollama_path=""
    local max_wait=60  # Wait up to 60 seconds
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        for path in "${possible_paths[@]}"; do
            # Expand variables and check if directory exists
            local expanded_path=$(eval echo "$path")
            if [ -d "$expanded_path" ]; then
                ollama_path="$expanded_path"
                log_info "Found Ollama installation at: $ollama_path"
                break 2
            fi
        done
        
        log_info "Waiting for installation directory... ($waited/$max_wait seconds)"
        sleep 5
        waited=$((waited + 5))
    done
    
    if [ -z "$ollama_path" ]; then
        log_error "Ollama installation directory not found after $max_wait seconds"
        log_error "Searched paths:"
        for path in "${possible_paths[@]}"; do
            local expanded_path=$(eval echo "$path")
            log_error "  - $expanded_path"
        done
        exit 1
    fi
    
    # Add to PATH
    export PATH="$PATH:$ollama_path"
    log_info "Added Ollama to PATH: $ollama_path"

    # Verify ollama command is available
    if ! command -v ollama &> /dev/null; then
        log_error "Ollama command not found after installation"
        log_error "PATH: $PATH"
        log_error "Directory contents of $ollama_path:"
        ls -la "$ollama_path" || log_error "Could not list directory"
        exit 1
    fi

    # Start Ollama server in background
    log_info "Starting Ollama server..."
    ollama serve > /dev/null 2>&1 &
    local server_pid=$!
    
    log_info "Ollama server started with PID: $server_pid"
    sleep 5
}

pull_model() {
    local model="$1"
    
    # Check if model already exists
    if ollama list 2>/dev/null | grep -q "^$model"; then
        log_info "Model '$model' is already available"
        return 0
    fi
    
    log_info "Pulling model: $model..."
    
    # Retry logic for model pull
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if ollama pull "$model"; then
            log_info "Successfully pulled model: $model"
            return 0
        else
            log_warn "Attempt $attempt/$max_attempts failed to pull model: $model"
            attempt=$((attempt + 1))
            sleep 5
        fi
    done

    log_error "Failed to pull model after $max_attempts attempts: $model"
    return 1
}

verify_installation() {
    log_info "Verifying Ollama installation..."

    # Check if ollama command exists
    if ! command -v ollama &> /dev/null; then
        log_error "Ollama command not found in PATH"
        log_error "Current PATH: $PATH"
        return 1
    fi

    # Check version
    log_info "Ollama version:"
    ollama --version || {
        log_error "Failed to get Ollama version"
        return 1
    }

    # Check if server is running by listing models
    local max_attempts=20
    local attempt=1

    log_info "Waiting for Ollama server to become ready..."
    while [ $attempt -le $max_attempts ]; do
        if ollama list &> /dev/null; then
            log_info "Ollama server is responding"
            ollama list || log_warn "Could not list models, but server is running"
            return 0
        else
            log_warn "Waiting for Ollama server... (attempt $attempt/$max_attempts)"
            
            # On Windows, the server might need extra time to initialize
            if [ "$(detect_os)" = "windows" ]; then
                sleep 3
            else
                sleep 2
            fi
            
            attempt=$((attempt + 1))
        fi
    done

    log_error "Ollama server is not responding after $max_attempts attempts"
    
    # Debug information
    log_error "Checking if Ollama process is running..."
    if [ "$(detect_os)" = "windows" ]; then
        tasklist | grep -i ollama || log_error "No Ollama process found"
    else
        ps aux | grep -i ollama | grep -v grep || log_error "No Ollama process found"
    fi
    
    return 1
}

main() {
    local os=$(detect_os)
    local arch=$(detect_arch)

    log_info "Detected OS: $os, Architecture: $arch"

    case "$os" in
        linux)
            install_ollama_linux
            ;;
        macos)
            install_ollama_macos
            ;;
        windows)
            install_ollama_windows
            ;;
        *)
            log_error "Unsupported operating system: $os"
            exit 1
            ;;
    esac

    # Verify installation
    if ! verify_installation; then
        log_error "Ollama installation verification failed"
        exit 1
    fi

    # Pull the default model
    if ! pull_model "$DEFAULT_MODEL"; then
        log_error "Failed to pull model: $DEFAULT_MODEL"
        exit 1
    fi

    log_info "Ollama setup complete!"
    log_info "Model '$DEFAULT_MODEL' is ready for use"

    # Export environment variable to signal Ollama is ready
    echo "OLLAMA_ENABLED=true" >> "${GITHUB_ENV:-/dev/null}" 2>/dev/null || true
}

# Run main function
main "$@"

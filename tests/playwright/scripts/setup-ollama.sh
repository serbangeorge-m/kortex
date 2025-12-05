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

    log_info "Downloading Ollama installer..."
    curl -fsSL -o /tmp/OllamaSetup.exe "$download_url"

    log_info "Running Ollama installer (silent mode)..."
    # Run installer silently
    /tmp/OllamaSetup.exe /S

    # Wait for installation to complete
    sleep 10

    # Add to PATH if not already there
    export PATH="$PATH:/c/Users/$USER/AppData/Local/Programs/Ollama"

    # Start Ollama server
    log_info "Starting Ollama server..."
    ollama serve &
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
        log_error "Ollama command not found"
        return 1
    fi

    # Check version
    ollama --version

    # Check if server is running by listing models
    local max_attempts=10
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if ollama list &> /dev/null; then
            log_info "Ollama server is responding"
            ollama list
            return 0
        else
            log_warn "Waiting for Ollama server... (attempt $attempt/$max_attempts)"
            attempt=$((attempt + 1))
            sleep 2
        fi
    done

    log_error "Ollama server is not responding"
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

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

    # Try to install via winget first (available on Windows 11 and recent Windows 10)
    if command -v winget &> /dev/null; then
        log_info "Installing Ollama via winget..."
        # Redirect winget output to reduce noise but keep errors
        if winget install --id=Ollama.Ollama -e --silent --accept-package-agreements --accept-source-agreements 2>&1 | grep -i "error" || true; then
            log_info "Winget installation completed"
        fi
        
        # Check common winget installation paths
        local winget_paths=(
            "$LOCALAPPDATA/Programs/Ollama"
            "/c/Users/$USER/AppData/Local/Programs/Ollama"
            "$PROGRAMFILES/Ollama"
            "/c/Program Files/Ollama"
        )
        
        for path in "${winget_paths[@]}"; do
            if [ -d "$path" ] && [ -f "$path/ollama.exe" ]; then
                log_info "Found Ollama at: $path"
                export PATH="$PATH:$path"
                # Force refresh the command cache
                hash -r 2>/dev/null || true
                
                if command -v ollama &> /dev/null; then
                    log_info "Ollama command is available via winget installation"
                    return 0
                fi
            fi
        done
        
        log_warn "Ollama may have been installed via winget but command not immediately available"
    else
        log_info "Winget not available, using manual installation"
    fi

    # Manual installation fallback
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

    log_info "Running Ollama installer..."
    log_warn "Note: Ollama installer may require GUI interaction and might not work in CI"
    
    # Try running installer in background with timeout
    powershell.exe -Command "Start-Process -FilePath '$installer_path' -ArgumentList '/S' -Wait -NoNewWindow" || {
        log_warn "PowerShell installer method failed, trying cmd.exe..."
        cmd.exe /c "start /wait \"\" \"$installer_path\" /S" || {
            log_error "All installation methods failed"
            log_error "This might be because Ollama's Windows installer doesn't support true silent installation"
            log_error "Consider using winget or pre-installing Ollama on the runner image"
            exit 1
        }
    }
    
    log_info "Installer execution completed, waiting for files..."
    sleep 10

    # Wait for installation to finalize and find installation directory
    log_info "Waiting for installation to complete..."
    
    local ollama_path=""
    local max_wait=60  # Wait up to 60 seconds
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        # Check possible installation locations
        if [ -d "/c/Users/$USER/AppData/Local/Programs/Ollama" ]; then
            ollama_path="/c/Users/$USER/AppData/Local/Programs/Ollama"
            log_info "Found Ollama installation at: $ollama_path"
            break
        elif [ -d "/c/Program Files/Ollama" ]; then
            ollama_path="/c/Program Files/Ollama"
            log_info "Found Ollama installation at: $ollama_path"
            break
        elif [ -n "$LOCALAPPDATA" ] && [ -d "$LOCALAPPDATA/Programs/Ollama" ]; then
            ollama_path="$LOCALAPPDATA/Programs/Ollama"
            log_info "Found Ollama installation at: $ollama_path"
            break
        elif [ -n "$PROGRAMFILES" ] && [ -d "$PROGRAMFILES/Ollama" ]; then
            ollama_path="$PROGRAMFILES/Ollama"
            log_info "Found Ollama installation at: $ollama_path"
            break
        fi
        
        log_info "Waiting for installation directory... ($waited/$max_wait seconds)"
        sleep 5
        waited=$((waited + 5))
    done
    
    if [ -z "$ollama_path" ]; then
        log_error "Ollama installation directory not found after $max_wait seconds"
        log_error "Searched paths:"
        log_error "  - /c/Users/$USER/AppData/Local/Programs/Ollama"
        log_error "  - /c/Program Files/Ollama"
        [ -n "$LOCALAPPDATA" ] && log_error "  - $LOCALAPPDATA/Programs/Ollama"
        [ -n "$PROGRAMFILES" ] && log_error "  - $PROGRAMFILES/Ollama"
        exit 1
    fi
    
    # Add to PATH
    export PATH="$PATH:$ollama_path"
    log_info "Added Ollama to PATH: $ollama_path"

    # Verify ollama.exe exists
    if [ ! -f "$ollama_path/ollama.exe" ]; then
        log_error "ollama.exe not found in $ollama_path"
        log_error "Directory contents:"
        ls -la "$ollama_path" 2>&1 || log_error "Could not list directory"
        exit 1
    fi
    
    # On Windows with Git Bash, we need to call the exe directly
    log_info "Creating ollama command wrapper..."
    local ollama_wrapper="/usr/local/bin/ollama"
    mkdir -p /usr/local/bin 2>/dev/null || true
    echo "#!/bin/bash" > "$ollama_wrapper"
    echo "\"$ollama_path/ollama.exe\" \"\$@\"" >> "$ollama_wrapper"
    chmod +x "$ollama_wrapper"
    
    # Also add to PATH
    export PATH="/usr/local/bin:$PATH:$ollama_path"
    hash -r 2>/dev/null || true
    
    # Verify ollama command works
    if ! ollama --version &> /dev/null; then
        log_error "Ollama command not working after installation"
        log_error "Trying to run directly: $ollama_path/ollama.exe --version"
        "$ollama_path/ollama.exe" --version || log_error "Direct execution also failed"
        exit 1
    fi
    
    log_info "Ollama command is working"

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

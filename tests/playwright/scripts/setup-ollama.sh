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
    
    # Get the actual Windows username
    local windows_user="${USERNAME:-${USER:-runneradmin}}"
    local arch=$(detect_arch)
    log_info "Windows user: $windows_user, Architecture: $arch"
    
    # Check if we're on ARM architecture
    if [ "$arch" = "arm64" ]; then
        log_warn "Detected ARM64 architecture"
        log_warn "Note: Ollama ARM64 support on Windows may be limited"
    fi

    # Try to install via winget first (available on Windows 11 and recent Windows 10)
    # winget.exe might not be in Git Bash PATH, try to call it directly
    local winget_cmd="winget.exe"
    if ! command -v "$winget_cmd" &> /dev/null; then
        winget_cmd="/c/Users/$windows_user/AppData/Local/Microsoft/WindowsApps/winget.exe"
    fi
    
    # Also check in system directories
    if ! command -v winget &> /dev/null && [ ! -f "$winget_cmd" ]; then
        # Try common system locations
        if [ -f "/c/Program Files/WindowsApps/Microsoft.DesktopAppInstaller_1.0.0.0_x64__8wekyb3d8bbwe/winget.exe" ]; then
            winget_cmd="/c/Program Files/WindowsApps/Microsoft.DesktopAppInstaller_1.0.0.0_x64__8wekyb3d8bbwe/winget.exe"
        fi
    fi
    
    if command -v winget &> /dev/null || [ -f "$winget_cmd" ]; then
        log_info "Installing Ollama via winget..."
        # Run winget with reduced output
        if "$winget_cmd" install --id=Ollama.Ollama -e --silent --accept-package-agreements --accept-source-agreements > /tmp/winget-install.log 2>&1; then
            log_info "Winget installation completed successfully"
            
            # Check common winget installation paths
            local check_paths=(
                "/c/Users/$windows_user/AppData/Local/Programs/Ollama"
                "/c/Program Files/Ollama"
            )
            
            for path in "${check_paths[@]}"; do
                if [ -d "$path" ] && [ -f "$path/ollama.exe" ]; then
                    log_info "Found Ollama at: $path"
                    
                    # Create wrapper and continue with the rest of the function
                    ollama_path="$path"
                    
                    # Jump to the verification section
                    log_info "Ollama installed successfully via winget"
                    # Don't return here, continue to create wrapper and verify
                    break
                fi
            done
            
            # If we found it via winget, skip manual installation
            if [ -n "$ollama_path" ]; then
                log_info "Skipping manual installation, using winget installation"
                # Continue to wrapper creation below
            else
                log_warn "Winget reported success but installation not found at expected paths"
                cat /tmp/winget-install.log
            fi
        else
            log_warn "Winget installation failed, check log at /tmp/winget-install.log"
            cat /tmp/winget-install.log || true
        fi
    else
        log_warn "Winget not available"
    fi
    
    # If winget didn't work, try Chocolatey as fallback
    if [ -z "$ollama_path" ] && command -v choco &> /dev/null; then
        log_info "Trying installation via Chocolatey..."
        if choco install ollama -y > /tmp/choco-install.log 2>&1; then
            log_info "Chocolatey installation completed"
            
            # Check for installation
            local check_paths=(
                "/c/Users/$windows_user/AppData/Local/Programs/Ollama"
                "/c/Program Files/Ollama"
                "/c/ProgramData/chocolatey/lib/ollama/tools"
            )
            
            for path in "${check_paths[@]}"; do
                if [ -d "$path" ] && [ -f "$path/ollama.exe" ]; then
                    log_info "Found Ollama at: $path"
                    ollama_path="$path"
                    break
                fi
            done
            
            if [ -z "$ollama_path" ]; then
                log_warn "Chocolatey reported success but installation not found"
                cat /tmp/choco-install.log
            fi
        else
            log_warn "Chocolatey installation failed"
            cat /tmp/choco-install.log || true
        fi
    fi
    
    # If neither winget nor chocolatey worked, fail gracefully
    if [ -z "$ollama_path" ]; then
        log_error "Could not install Ollama via winget or chocolatey"
        log_error "Ollama tests will be skipped for this runner"
        log_error "To enable Ollama tests, ensure winget or chocolatey is available, or pre-install Ollama"
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

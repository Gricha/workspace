#!/bin/bash
set -euo pipefail

REPO="gricha/perry"
INSTALL_DIR="${PERRY_INSTALL_DIR:-${XDG_BIN_HOME:-$HOME/.perry}}"
BIN_DIR="$INSTALL_DIR/bin"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}==>${NC} $1"; }
success() { echo -e "${GREEN}==>${NC} $1"; }
warn() { echo -e "${YELLOW}==>${NC} $1"; }
error() { echo -e "${RED}Error:${NC} $1" >&2; exit 1; }

VERSION=""
NO_MODIFY_PATH=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--version) VERSION="$2"; shift 2 ;;
    --no-modify-path) NO_MODIFY_PATH=true; shift ;;
    -h|--help)
      echo "Perry installer"
      echo ""
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  -v, --version VERSION  Install specific version (default: latest)"
      echo "  --no-modify-path       Don't modify shell PATH"
      echo "  -h, --help             Show this help"
      exit 0
      ;;
    *) error "Unknown option: $1" ;;
  esac
done

detect_platform() {
  local os arch

  case "$(uname -s)" in
    Linux*)  os="linux" ;;
    Darwin*) os="darwin" ;;
    MINGW*|MSYS*|CYGWIN*) os="windows" ;;
    *) error "Unsupported operating system: $(uname -s)" ;;
  esac

  case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) error "Unsupported architecture: $(uname -m)" ;;
  esac

  echo "${os}-${arch}"
}

get_latest_version() {
  local url="https://api.github.com/repos/${REPO}/releases/latest"
  local version

  if command -v curl &>/dev/null; then
    version=$(curl -fsSL "$url" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  elif command -v wget &>/dev/null; then
    version=$(wget -qO- "$url" | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
  else
    error "curl or wget is required"
  fi

  if [[ -z "$version" ]]; then
    error "Failed to fetch latest version"
  fi

  echo "$version"
}

download_and_install() {
  local version="$1"
  local platform="$2"
  local archive_ext="tar.gz"
  local binary_name="perry"

  if [[ "$platform" == windows-* ]]; then
    archive_ext="zip"
    binary_name="perry.exe"
  fi

  local archive_name="perry-${version}-${platform}.${archive_ext}"
  local download_url="https://github.com/${REPO}/releases/download/v${version}/${archive_name}"

  info "Downloading perry v${version} for ${platform}..."

  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap "rm -rf '$tmp_dir'" EXIT

  local archive_path="$tmp_dir/$archive_name"

  if command -v curl &>/dev/null; then
    curl -fsSL --progress-bar "$download_url" -o "$archive_path" || error "Download failed. Check if version v${version} exists."
  else
    wget -q --show-progress "$download_url" -O "$archive_path" || error "Download failed. Check if version v${version} exists."
  fi

  info "Extracting..."

  mkdir -p "$BIN_DIR"
  mkdir -p "$INSTALL_DIR/web"

  if [[ "$archive_ext" == "tar.gz" ]]; then
    tar -xzf "$archive_path" -C "$tmp_dir"
  else
    unzip -q "$archive_path" -d "$tmp_dir"
  fi

  local extracted_dir="$tmp_dir/perry-${version}-${platform}"

  cp "$extracted_dir/$binary_name" "$BIN_DIR/perry"
  chmod +x "$BIN_DIR/perry"

  if [[ -d "$extracted_dir/web" ]]; then
    rm -rf "$INSTALL_DIR/web"
    cp -r "$extracted_dir/web" "$INSTALL_DIR/web"
  fi

  success "Installed perry to $BIN_DIR/perry"
}

update_path() {
  if [[ "$NO_MODIFY_PATH" == "true" ]]; then
    return
  fi

  if [[ -n "${GITHUB_PATH:-}" ]]; then
    echo "$BIN_DIR" >> "$GITHUB_PATH"
    info "Added $BIN_DIR to GITHUB_PATH"
    return
  fi

  local shell_config=""
  local path_export="export PATH=\"$BIN_DIR:\$PATH\""

  if [[ -n "${ZSH_VERSION:-}" ]] || [[ "$SHELL" == */zsh ]]; then
    shell_config="$HOME/.zshrc"
  elif [[ -n "${BASH_VERSION:-}" ]] || [[ "$SHELL" == */bash ]]; then
    if [[ -f "$HOME/.bashrc" ]]; then
      shell_config="$HOME/.bashrc"
    elif [[ -f "$HOME/.bash_profile" ]]; then
      shell_config="$HOME/.bash_profile"
    fi
  elif [[ "$SHELL" == */fish ]]; then
    shell_config="$HOME/.config/fish/config.fish"
    path_export="set -gx PATH $BIN_DIR \$PATH"
  fi

  if [[ -n "$shell_config" ]]; then
    if ! grep -q "$BIN_DIR" "$shell_config" 2>/dev/null; then
      echo "" >> "$shell_config"
      echo "# Perry" >> "$shell_config"
      echo "$path_export" >> "$shell_config"
      info "Added $BIN_DIR to PATH in $shell_config"
    fi
  fi

  for rc in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [[ -f "$rc" ]] && [[ "$rc" != "$shell_config" ]]; then
      if ! grep -q "$BIN_DIR" "$rc" 2>/dev/null; then
        echo "" >> "$rc"
        echo "# Perry" >> "$rc"
        echo "export PATH=\"$BIN_DIR:\$PATH\"" >> "$rc"
      fi
    fi
  done
}

main() {
  info "Perry installer"
  echo ""

  local platform
  platform=$(detect_platform)
  info "Detected platform: $platform"

  if [[ -z "$VERSION" ]]; then
    VERSION=$(get_latest_version)
  fi

  download_and_install "$VERSION" "$platform"
  update_path

  echo ""
  success "Perry v${VERSION} installed successfully!"
  echo ""
  echo "To get started, run:"
  echo ""

  if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
  fi

  echo "  perry --help"
  echo ""
}

main

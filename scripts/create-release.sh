#!/bin/bash

# 🚀 Create Release Script
# Usage: ./scripts/create-release.sh v1.0.0

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_step() {
    echo -e "${BLUE}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if version is provided
if [ -z "$1" ]; then
    print_error "Usage: $0 <version> (e.g., v1.0.0)"
fi

VERSION=$1
RELEASE_DIR="release-$VERSION"

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-.*)?$ ]]; then
    print_error "Version must be in format v1.0.0 or v1.0.0-beta"
fi

print_step "Creating release $VERSION"

# Check if we're in the right directory
if [ ! -f "main.ts" ] || [ ! -f "deno.json" ]; then
    print_error "Please run this script from the project root directory"
fi

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Git working directory is not clean"
    echo "Uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if Deno is installed
if ! command -v deno &> /dev/null; then
    print_error "Deno is not installed. Please install Deno first."
fi

print_step "Running pre-release checks"

# Lint code
print_step "Linting code..."
deno lint || print_error "Linting failed"

# Type check
print_step "Type checking..."
deno check main.ts || print_error "Type checking failed"

# Test compilation for all platforms
print_step "Testing compilation..."
deno task build-windows > /dev/null || print_error "Windows build failed"
rm -f mod-manager.exe

print_success "Pre-release checks passed"

# Create release directory
print_step "Creating release directory: $RELEASE_DIR"
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Build for all platforms
print_step "Building for Windows (x64)..."
deno task build-windows
mv mod-manager.exe "$RELEASE_DIR/mod-manager-windows-x64.exe"

print_step "Building for Linux (x64)..."
deno task build-linux
mv mod-manager "$RELEASE_DIR/mod-manager-linux-x64"

print_step "Building for macOS (ARM64)..."
deno task build-macos
mv mod-manager "$RELEASE_DIR/mod-manager-macos-arm64"

# Create README for release
print_step "Creating release documentation..."
cat > "$RELEASE_DIR/README.txt" << EOF
# Minecraft Mod Manager $VERSION

Built on: $(date)
Commit: $(git rev-parse HEAD)

## Quick Start

1. Download the executable for your platform:
   - Windows: mod-manager-windows-x64.exe
   - Linux: mod-manager-linux-x64
   - macOS: mod-manager-macos-arm64

2. Place it in your modpack folder

3. Create tn.mods.json:
   {
     "modLoader": "fabric",
     "gameVersion": "1.20.1", 
     "mods": [
       { "name": "Fabric API", "source": "modrinth" },
       { "name": "Sodium", "source": "modrinth" }
     ]
   }

4. Run the executable

## Features

- Smart mod search - just provide mod names
- Auto-downloads from Modrinth
- Auto-updates to latest compatible versions
- Supports Fabric, Forge, NeoForge
- Single executable, no dependencies

Built with ❤️ and TypeScript
EOF

# Create checksums
print_step "Generating checksums..."
cd "$RELEASE_DIR"
sha256sum mod-manager-* > SHA256SUMS.txt
cd ..

# Create zip archive
print_step "Creating archive..."
zip -r "$RELEASE_DIR.zip" "$RELEASE_DIR"

print_success "Release built successfully!"
echo
echo "📦 Release files in: $RELEASE_DIR/"
echo "🗜️  Archive created: $RELEASE_DIR.zip"
echo
echo "🔗 Files:"
ls -la "$RELEASE_DIR/"
echo
echo "📝 Next steps:"
echo "1. Test the executables"
echo "2. Create git tag: git tag $VERSION"
echo "3. Push tag: git push origin $VERSION"
echo "4. GitHub Actions will automatically create the release"
echo
print_warning "Don't forget to update the version in your documentation!"
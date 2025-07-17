# 🚀 Release Guide

Guide for creating and publishing releases of the Minecraft Mod Manager.

## 📋 Prerequisites

- [Deno](https://deno.land/) installed
- Git access to the repository
- GitHub repository with Actions enabled

## 🔄 Release Workflow

### 1. Pre-release checklist

**Code quality:**
```bash
# Lint and validate
deno task validate

# Test all builds
deno task build-all

# Clean up
deno task clean
```

**Manual testing:**
- [ ] Test with a real modpack
- [ ] Verify mod downloads work
- [ ] Check error handling
- [ ] Test on different platforms (if available)

### 2. Version selection

Follow [Semantic Versioning](https://semver.org/):

- **Major** (`v2.0.0`) - Breaking changes
- **Minor** (`v1.1.0`) - New features, backward compatible
- **Patch** (`v1.0.1`) - Bug fixes
- **Pre-release** (`v1.0.0-beta.1`) - Testing versions

### 3. Create release (Automated)

**Option A: Automatic via GitHub (Recommended)**

1. **Create and push tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **GitHub Actions will automatically:**
   - Build for all platforms
   - Run tests
   - Create release
   - Upload binaries
   - Generate release notes

**Option B: Local build first**

1. **Test locally:**
   ```bash
   # Create local release (requires version)
   ./scripts/create-release.sh v1.0.0
   
   # Test the binaries
   # Then push tag to trigger GitHub release
   git tag v1.0.0
   git push origin v1.0.0
   ```

### 4. Post-release

- [ ] Verify release on GitHub
- [ ] Test download links
- [ ] Update documentation if needed
- [ ] Announce in relevant communities

## 🛠️ Manual Release Process

If GitHub Actions fails or you need a manual release:

### 1. Build locally

```bash
# Create local release
chmod +x scripts/create-release.sh
./scripts/create-release.sh v1.0.0

# This creates:
# - release-v1.0.0/ directory with binaries
# - release-v1.0.0.zip archive
# - SHA256 checksums
```

### 2. Create GitHub release manually

1. Go to [GitHub Releases](../../releases)
2. Click "Create a new release"
3. Choose your tag (or create new one)
4. Fill in release title: `🎮 Mod Manager v1.0.0`
5. Upload files from `release-v1.0.0/`
6. Use this template for description:

```markdown
## 🎮 Minecraft Mod Manager v1.0.0

### 📦 Downloads

| Platform | Download | Architecture |
|----------|----------|--------------|
| 🪟 **Windows** | `mod-manager-windows-x64.exe` | x64 |
| 🐧 **Linux** | `mod-manager-linux-x64` | x64 |
| 🍎 **macOS** | `mod-manager-macos-arm64` | ARM64 (M1/M2) |

### 🚀 Quick Start

1. Download the executable for your platform
2. Place it in your modpack folder
3. Create `tn.mods.json` with your mod configuration
4. Run the executable

### ✨ What's New

- [List your changes here]

### 🛡️ Security

Verify downloads using `SHA256SUMS.txt`
```

## 🔧 Troubleshooting

### GitHub Actions fails

**Common issues:**

1. **Permission errors:**
   - Check repository settings → Actions → General
   - Ensure "Read and write permissions" is enabled

2. **Build fails:**
   ```bash
   # Test locally first
   deno task validate
   deno task build-all
   ```

3. **Release creation fails:**
   - Check if tag already exists
   - Verify `GITHUB_TOKEN` permissions

### Local build fails

**Deno issues:**
```bash
# Update Deno
deno upgrade

# Clear cache
deno cache --reload main.ts

# Check permissions
deno task run --help
```

**Platform build issues:**
- Ensure internet connection (downloads targets)
- Check Deno version compatibility
- Try building one platform at a time

## 🔄 Automated Workflows

### On every push to main:
- `.github/workflows/test.yml` runs tests

### On tag push (v*):
- `.github/workflows/release.yml` creates release

### Workflow structure:
```
🧪 Test Job
├── Lint code
├── Type check  
├── Run tests
└── Test compilation

🔨 Build Job (matrix: windows, linux, macos)
├── Setup Deno
├── Compile binary
├── Create artifacts
└── Upload artifacts

🎉 Release Job
├── Download artifacts
├── Create release notes
├── Generate checksums
└── Publish GitHub release
```

## 📊 Release Metrics

Track these after each release:

- [ ] Download counts
- [ ] Issue reports
- [ ] User feedback
- [ ] Performance metrics

## 🎯 Tips

- **Test everything locally first**
- **Use semantic versioning consistently**
- **Write clear release notes**
- **Keep binaries under 50MB**
- **Always include checksums**
- **Tag releases properly**

## 🆘 Emergency Procedures

### If a bad release goes out:

1. **Immediately create hotfix:**
   ```bash
   git checkout v1.0.0  # bad release
   git checkout -b hotfix/v1.0.1
   # Fix the issue
   git commit -m "fix: critical bug"
   git tag v1.0.1
   git push origin v1.0.1
   ```

2. **Mark bad release as pre-release:**
   - Edit the GitHub release
   - Check "This is a pre-release"
   - Add warning to description

3. **Communicate the issue:**
   - Update README if needed
   - Post in discussions/issues

---

*Remember: Releases are permanent. Test thoroughly before tagging!* 🎯
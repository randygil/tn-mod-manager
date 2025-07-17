# 🎮 Minecraft Mod Manager

*A **vibe-coded** automatic mod manager that works like `npm install` but for Minecraft mods. Built in ~30 minutes because manually managing mods is pain.*

[![Deno](https://img.shields.io/badge/deno-v1.40+-black?logo=deno)](https://deno.land/)
[![TypeScript](https://img.shields.io/badge/typescript-100%25-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**TL;DR**: Drop a JSON file with mod names, double-click executable, get perfectly synced mods folder. That's it.

## 🚀 Features

- ✅ **Zero-config mod discovery** - Just write the mod name, we'll find it
- 🔍 **Smart search** - Finds mods even with fuzzy names
- 📦 **Auto-downloads** from Modrinth (CurseForge coming soon™)
- 🔄 **Smart sync** - Adds, updates, removes mods automatically
- 🎯 **Version-aware** - Always grabs compatible versions
- 💾 **Single executable** - Compiles to `.exe`, no dependencies
- 🌐 **Custom URLs** - Support for private/custom mods
- ⚡ **Blazing fast** - Downloads with progress bars
- 🛡️ **JAR validation** - Ensures downloaded files aren't corrupted

**Supported mod loaders**: Fabric, Forge, NeoForge

## 📦 Quick Start

### 1. Create your mod list
Create `tn.mods.json` in your modpack folder:

```json
{
  "modLoader": "fabric",
  "gameVersion": "1.20.1",
  "mods": [
    {
      "name": "Fabric API",
      "source": "modrinth"
    },
    {
      "name": "Sodium",
      "source": "modrinth"
    },
    {
      "name": "JEI",
      "source": "modrinth"
    }
  ]
}
```

*Just the mod names - that's literally it. The manager will find the projects and grab the latest compatible versions.*

### 2. Compile the executable

**Windows:**
```bash
deno compile --allow-all --target x86_64-pc-windows-msvc --output mod-manager.exe main.ts
```

**Linux/Mac:**
```bash
deno compile --allow-all --output mod-manager main.ts
```

**From WSL (for Windows):**
```bash
chmod +x build-wsl.sh
./build-wsl.sh
```

### 3. Run it
- **Double-click** `mod-manager.exe`
- Or: `./mod-manager`

### 4. Magic happens
```
🚀 Starting mod manager...
📋 Config loaded: fabric 1.20.1
📦 Configured mods: 3

🔍 Current mods: 0
🎯 Required mods: 3

🔍 Searching for "Fabric API" on Modrinth...
✅ Project found: "Fabric API" (P7dR8mSH)
⬇️  Downloading: Fabric API (latest compatible version)
✅ Latest version found: 0.92.2
📊 Progress: 100% (2.1 MB/2.1 MB)
✅ Downloaded: Fabric API v0.92.2

✅ Sync completed!
```

## 🔧 Configuration Options

### 🚀 Zero-config (Recommended)
```json
{
  "name": "Sodium",
  "source": "modrinth"
}
```
*Just the name - finds project automatically and downloads latest compatible version*

### ⚡ Fast mode (with Project ID)
```json
{
  "name": "Sodium",
  "source": "modrinth",
  "projectId": "AANobbMI"
}
```
*Skips search, uses specific Project ID for faster downloads*

### 🎯 Specific version
```json
{
  "name": "Sodium",
  "version": "0.5.3",
  "source": "modrinth",
  "projectId": "AANobbMI"
}
```
*Locks to exact version - won't auto-update*

### 🌐 Custom URL
```json
{
  "name": "My Custom Mod",
  "version": "1.0.0",
  "source": "url",
  "downloadUrl": "https://example.com/mod.jar",
  "fileName": "custom-mod-1.0.0.jar"
}
```

## 🧠 Smart Search Algorithm

The mod manager uses intelligent search when you don't specify a `projectId`:

1. **Exact match**: Searches for exact mod name
2. **Fuzzy matching**: Finds mods with similar names
3. **Popularity ranking**: Picks most popular if multiple matches
4. **Compatibility filtering**: Only shows mods for your loader + game version

**Examples that work**:
- `"JEI"` → Finds "Just Enough Items"
- `"Iron Chests"` → Finds "Iron Chests: Restocked"
- `"Waystones"` → Finds "Waystones"

## 🔄 Auto-Update Behavior

### 🚀 Auto mode (no `version` specified)
- ✅ Downloads latest compatible version
- 🔍 Checks for updates on every run
- 🔄 Auto-updates if newer version available
- 🎯 Filters by game version and mod loader

### 🎯 Locked mode (with `version`)
- 📌 Maintains exact specified version
- ⚠️ Never auto-updates
- ✅ Good for stability or specific compatibility

## 📁 Project Structure

```
your-modpack/
├── mod-manager.exe          # Compiled executable
├── tn.mods.json            # Your mod configuration
└── mods/                   # Auto-managed mods folder
    ├── fabric-api-0.92.2.jar
    ├── sodium-0.5.3.jar
    └── jei-15.2.0.27.jar
```

## 🛠️ Building from Source

### Prerequisites
- [Deno](https://deno.land/) installed

### Build Commands
```bash
# Development
deno task dev

# Build for current platform
deno task build

# Cross-compile for Windows
deno task build-win

# Cross-compile for Linux
deno task build-linux

# Cross-compile for macOS
deno task build-mac

# Build from WSL for Windows
deno task build-wsl
```

## 🎮 Usage Examples

### Basic Fabric setup
```json
{
  "modLoader": "fabric",
  "gameVersion": "1.20.1",
  "mods": [
    { "name": "Fabric API", "source": "modrinth" },
    { "name": "Sodium", "source": "modrinth" },
    { "name": "Lithium", "source": "modrinth" },
    { "name": "Phosphor", "source": "modrinth" }
  ]
}
```

### Mixed configuration
```json
{
  "modLoader": "forge",
  "gameVersion": "1.20.1",
  "mods": [
    {
      "name": "JEI",
      "source": "modrinth"
    },
    {
      "name": "Quark",
      "version": "4.0-460",
      "source": "modrinth",
      "projectId": "YjJp64LY"
    },
    {
      "name": "Private Mod",
      "version": "1.0.0",
      "source": "url",
      "downloadUrl": "https://my-server.com/privatemod.jar"
    }
  ]
}
```

## 🚨 Troubleshooting

### "No compatible version found"
- Check that the mod supports your Minecraft version
- Verify the mod works with your mod loader (Fabric/Forge)
- Try specifying a `projectId` manually

### "Project not found"
- Double-check the mod name spelling
- Try searching on [modrinth.com](https://modrinth.com) manually
- Use the exact `projectId` from the mod's page

### Executable doesn't work
- Make sure `tn.mods.json` is in the same folder
- Run from terminal to see detailed error messages
- Check that you have internet connection

## 📊 Performance

- **Download speed**: Limited by your internet and Modrinth's servers
- **Search time**: ~200-500ms per mod (cached after first search)
- **Startup time**: ~100ms for config loading
- **Memory usage**: ~10-20MB during operation

## 🤝 Contributing

This was vibe-coded in 30 minutes, so there's definitely room for improvement:

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

**Ideas for contributions**:
- CurseForge API integration
- GUI version
- Dependency resolution
- Mod pack export/import
- Better error messages

## 📝 License

MIT License - do whatever you want with this code.

## 🎯 Why This Exists

Managing Minecraft mods manually is tedious:
- Finding compatible versions
- Downloading one by one
- Keeping track of updates
- Dealing with mod loader compatibility

This tool automates all of that. You just list what you want, and it handles the rest.

**Built with the philosophy**: *If it takes more than 2 steps, automate it.*

## 🔮 Roadmap

- [ ] CurseForge API support
- [ ] Dependency resolution
- [ ] GUI version
- [ ] Mod pack sharing
- [ ] Version rollback
- [ ] Mod recommendations
- [ ] Performance optimizations

---

*Made with ☕ and TypeScript. Vibe-coded because life's too short for manual mod management.*
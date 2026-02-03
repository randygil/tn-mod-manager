#!/usr/bin/env -S deno run --allow-all

import { format, greaterThan, parse } from '@std/semver';
import { dirname, join } from '@std/path';

const APP_VERSION = '1.0.1';
const GITHUB_REPO = 'randygil/tn-mod-manager';


interface ModConfig {
  name: string;
  version?: string; // Opcional - si no se especifica, busca la última compatible
  source?: 'curseforge' | 'modrinth' | 'url';
  projectId?: string; // Opcional - si no se especifica para Modrinth, lo busca por nombre
  downloadUrl?: string;
  fileName?: string;
}

interface ModpackConfig {
  modLoader: 'fabric' | 'forge' | 'neoforge';
  gameVersion: string;
  prune?: boolean; // Por defecto true. Si es false, NO elimina mods extras.
  mods: ModConfig[];
  externalSrc?: {
    type: 'direct' | 'github';
    url?: string;
    repo?: string;
    branch?: string;
    file?: string;
  };
}

interface SearchResult {
  title: string;
  slug: string;
  project_id: string;
  categories: string[];
}

interface Version {
  game_versions: string[];
  loaders: string[];
  version_number: string;
  files: { url: string; filename: string }[];
}

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  assets: GitHubAsset[];
}

class ModManager {
  private config: ModpackConfig;
  private modsDir = './mods';
  private configFile = './tn.mods.json';

  constructor() {
    this.config = { modLoader: 'fabric', gameVersion: '1.20.1', mods: [] };
  }

  async init(): Promise<void> {
    console.log('🚀 Iniciando gestor de mods...');

    try {
      await this.loadConfig();
      await this.ensureModsDirectory();
      await this.syncMods();
      console.log('✅ Sincronización completada!');
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      Deno.exit(1);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configText = await Deno.readTextFile(this.configFile);
      this.config = JSON.parse(configText);

      if (this.config.externalSrc) {
        await this.processExternalSource();
      }

      console.log(`📋 Configuración cargada: ${this.config.modLoader} ${this.config.gameVersion}`);
      console.log(`📦 Mods configurados: ${this.config.mods.length}`);
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) {
        console.log('📝 Creando archivo de configuración de ejemplo...');
        await this.createExampleConfig();
        console.log('⚠️  Edita tn.mods.json y ejecuta de nuevo');
        Deno.exit(0);
      }
      throw error;
    }
  }

  private async processExternalSource(): Promise<void> {
    const { type, url, repo, branch = 'main', file = 'tn.mods.json' } = this.config.externalSrc!;

    console.log(`\n🌐 Fuente externa detectada: ${type}`);
    let configUrl: string;

    if (type === 'github') {
      if (!repo) throw new Error('Para fuente github, se requiere el campo "repo" (usuario/repositorio)');
      configUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${file}`;
    } else if (type === 'direct') {
      if (!url) throw new Error('Para fuente directa, se requiere el campo "url"');
      configUrl = url;
    } else {
      throw new Error(`Tipo de fuente externa no soportada: ${type}`);
    }

    try {
      console.log(`📥 Descargando configuración de: ${configUrl}`);
      const response = await fetch(configUrl);
      if (!response.ok) throw new Error(`Error HTTP ${response.status} - ${response.statusText}`);
      const externalConfig = await response.json();

      if (!externalConfig.mods) throw new Error('El JSON externo no contiene una lista de mods válida');

      this.config = {
        ...this.config,
        ...externalConfig,
        externalSrc: this.config.externalSrc
      };

      console.log('✅ Configuración externa aplicada');
    } catch (error) {
      console.error(`❌ Error cargando configuración externa: ${(error as Error).message}`);
      console.log('⚠️  Usando configuración local...\n');
    }
  }

  private async createExampleConfig(): Promise<void> {
    const exampleConfig: ModpackConfig = {
      modLoader: 'fabric',
      gameVersion: '1.20.1',
      mods: [
        {
          name: 'Fabric API',
          source: 'modrinth',
          projectId: 'P7dR8mSH'
          // Sin 'version' - usará la última compatible
        },
        {
          name: 'JEI',
          version: '15.2.0.27', // Versión específica
          source: 'modrinth',
          projectId: 'u6dRKJwZ'
        },
        {
          name: 'Sodium',
          source: 'modrinth'
          // Sin 'projectId' - lo buscará automáticamente por nombre
          // Sin 'version' - siempre la más reciente
        },
        {
          name: 'Custom Mod',
          version: '1.0.0',
          source: 'url',
          downloadUrl: 'https://example.com/mod.jar',
          fileName: 'custom-mod-1.0.0.jar'
        }
      ]
    };

    await Deno.writeTextFile(this.configFile, JSON.stringify(exampleConfig, null, 2));
  }

  private async ensureModsDirectory(): Promise<void> {
    try {
      await Deno.stat(this.modsDir);
    } catch {
      await Deno.mkdir(this.modsDir, { recursive: true });
      console.log('📁 Carpeta mods creada');
    }
  }

  private async getCurrentMods(): Promise<string[]> {
    try {
      const entries = [];
      for await (const entry of Deno.readDir(this.modsDir)) {
        if (entry.isFile && entry.name.endsWith('.jar')) {
          entries.push(entry.name);
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  private async syncMods(): Promise<void> {
    const currentMods = await this.getCurrentMods();

    console.log(`\n🔍 Mods actuales: ${currentMods.length}`);
    console.log(`🎯 Mods requeridos: ${this.config.mods.length}`);

    // Eliminar mods no listados por defecto, a menos que se deshabilite explícitamente
    if (this.config.prune !== false) {
      console.log('🧹 Limpieza activa: buscando archivos no listados...');
      const configModNames = this.config.mods.map(mod =>
        mod.name.toLowerCase().replace(/\s+/g, '-')
      );

      for (const currentMod of currentMods) {
        const modBaseName = this.extractModBaseName(currentMod);
        if (!configModNames.some(configName => modBaseName.includes(configName))) {
          console.log(`🗑️  Eliminando mod no listado: ${currentMod}`);
          await Deno.remove(`${this.modsDir}/${currentMod}`);
        }
      }
    } else {
      console.log('🛡️  Modo seguro: Conservando mods no listados');
    }

    // Descargar mods faltantes o verificar existentes
    for (const mod of this.config.mods) {
      await this.processModDownload(mod, currentMods);
    }
  }

  private extractModBaseName(fileName: string): string {
    // Remover extensión y convertir a minúsculas para comparación
    return fileName.replace(/\.jar$/i, '').toLowerCase();
  }

  private async processModDownload(mod: ModConfig, currentMods: string[]): Promise<void> {
    let expectedFileName: string;
    let downloadUrl: string;
    let versionDisplay: string;

    try {
      // 1. Resolver qué archivo necesitamos (Target)
      if (mod.source === 'modrinth') {
        // Siempre consultamos Modrinth para saber cuál es la versión correcta/última
        // Esto es necesario para poder comparar con lo que tenemos instalado
        const showMessage = !mod.version; // Solo mostramos 'Buscando' si es autodiscovery
        const info = await this.getModrinthDownloadUrl(mod, showMessage);

        expectedFileName = info.fileName;
        downloadUrl = info.url;
        versionDisplay = info.version;
      } else if (mod.source === 'curseforge') {
        // Esta implementación falla actualmente, pero mantenemos la estructura
        downloadUrl = await this.getCurseForgeDownloadUrl(mod);
        expectedFileName = mod.fileName || this.generateFileName(mod);
        versionDisplay = mod.version || 'latest';
      } else {
        // Generic URL
        if (!mod.downloadUrl && mod.source === 'url') {
          throw new Error('source: "url" requiere "downloadUrl"');
        }
        downloadUrl = mod.downloadUrl || '';
        expectedFileName = mod.fileName || this.generateFileName(mod);
        versionDisplay = mod.version || 'custom';
      }

      // 2. Limpiar versiones antiguas/incorrectas DE ESTE MOD ESPECÍFICO
      // Esto funciona independientemente de si 'prune' está activo para el resto de archivos
      const modBaseNameSearch = mod.name.toLowerCase().replace(/\s+/g, '-');

      const duplicates = currentMods.filter(current => {
        const currentBase = this.extractModBaseName(current);
        // Usamos startsWith para identificar variantes de version del mismo mod
        return currentBase.startsWith(modBaseNameSearch) && current !== expectedFileName;
      });

      for (const file of duplicates) {
        console.log(`🧹 Eliminando versión antigua/incorrecta: ${file}`);
        try {
          await Deno.remove(`${this.modsDir}/${file}`);
        } catch (e) {
          console.log(`⚠️  No se pudo eliminar ${file}: ${(e as Error).message}`);
        }
      }

      // 3. Asegurar que el archivo deseado existe
      const targetPath = `${this.modsDir}/${expectedFileName}`;

      try {
        await Deno.stat(targetPath);
        // Si existe, verificamos que no esté corrupto (chequeo rápido de tamaño > 0)
        if ((await Deno.stat(targetPath)).size > 0) {
          console.log(`✅ Verificado: ${mod.name} ${mod.version ? '(v' + mod.version + ')' : '(v' + versionDisplay + ')'}`);
          return;
        }
      } catch {
        // No existe (stat falló), continuamos a descarga
      }

      console.log(`⬇️  Descargando: ${mod.name} (v${versionDisplay})`);
      await this.downloadFile(downloadUrl!, targetPath);
      await this.validateJarFile(targetPath);
      console.log(`✅ Instalado: ${expectedFileName}`);

    } catch (error) {
      console.log(`❌ Error procesando ${mod.name}: ${(error as Error).message}`);
    }
  }

  private generateFileName(mod: ModConfig): string {
    if (mod.fileName) return mod.fileName;

    const sanitizedName = mod.name.replace(/\s+/g, '-').toLowerCase();
    const version = mod.version || 'latest';
    return `${sanitizedName}-${version}.jar`;
  }

  private async downloadMod(mod: ModConfig, filePath: string): Promise<void> {
    let downloadUrl: string;

    try {
      switch (mod.source) {
        case 'modrinth': {
          const modrinthInfo = await this.getModrinthDownloadUrl(mod);
          downloadUrl = modrinthInfo.url; // Asignar solo la URL
          break;
        }
        case 'curseforge':
          downloadUrl = await this.getCurseForgeDownloadUrl(mod);
          break;
        case 'url':
          downloadUrl = mod.downloadUrl!;
          break;
        default:
          throw new Error(`Fuente no soportada: ${mod.source}`);
      }

      await this.downloadFile(downloadUrl, filePath);

      // Verificar que el archivo descargado es válido
      await this.validateJarFile(filePath);

      console.log(`✅ Descargado: ${mod.name}`);
    } catch (error) {
      // Limpiar archivo parcial si existe
      try {
        await Deno.remove(filePath);
      } catch {
        // Ignorar errores de limpieza
      }
      throw new Error(`Error descargando ${mod.name}: ${(error as Error).message}`);
    }
  }

  private async validateJarFile(filePath: string): Promise<void> {
    try {
      const stat = await Deno.stat(filePath);
      if (stat.size === 0) {
        throw new Error('Archivo vacío');
      }

      // Verificar que es un archivo ZIP/JAR válido leyendo los primeros bytes
      const file = await Deno.open(filePath, { read: true });
      const buffer = new Uint8Array(4);
      await file.read(buffer);
      file.close();

      // Signature para archivos ZIP/JAR: 50 4B 03 04
      if (buffer[0] !== 0x50 || buffer[1] !== 0x4B || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
        throw new Error('No es un archivo JAR válido');
      }
    } catch (error) {
      throw new Error(`Archivo JAR inválido: ${(error as Error).message}`);
    }
  }

  private async searchModrinthProject(modName: string): Promise<string> {
    try {
      console.log(`🔍 Buscando proyecto "${modName}" en Modrinth...`);

      const searchUrl = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(modName)}&facets=[["categories:${this.config.modLoader}"],["versions:${this.config.gameVersion}"]]&limit=10`;
      const response = await fetch(searchUrl);
      const searchResults = await response.json();

      if (!searchResults.hits || searchResults.hits.length === 0) {
        throw new Error(`No se encontraron proyectos para "${modName}"`);
      }

      // Buscar coincidencia exacta primero
      let bestMatch = searchResults.hits.find((hit: SearchResult) =>
        hit.title.toLowerCase() === modName.toLowerCase() ||
        hit.slug.toLowerCase() === modName.toLowerCase()
      );

      // Si no hay coincidencia exacta, buscar por similitud
      if (!bestMatch) {
        bestMatch = searchResults.hits.find((hit: SearchResult) =>
          hit.title.toLowerCase().includes(modName.toLowerCase()) ||
          modName.toLowerCase().includes(hit.title.toLowerCase())
        );
      }

      // Si aún no hay match, tomar el más popular
      if (!bestMatch) {
        bestMatch = searchResults.hits[0];
      }

      console.log(`✅ Proyecto encontrado: "${bestMatch.title}" (${bestMatch.project_id})`);

      // Verificar que el proyecto es compatible
      if (!bestMatch.categories.includes(this.config.modLoader)) {
        console.log(`⚠️  Advertencia: "${bestMatch.title}" podría no ser compatible con ${this.config.modLoader}`);
      }

      return bestMatch.project_id;
    } catch (error) {
      throw new Error(`Error buscando proyecto en Modrinth: ${(error as Error).message}`);
    }
  }

  private async getModrinthDownloadUrl(mod: ModConfig, showSearchMessage: boolean = true): Promise<{ url: string; version: string; fileName: string }> {
    try {
      let projectId = mod.projectId;

      // Si no hay projectId, buscarlo
      if (!projectId) {
        projectId = await this.searchModrinthProject(mod.name);
      }

      const response = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`);
      const versions = await response.json();

      let compatibleVersion;

      if (mod.version) {
        // 1. Búsqueda exacta
        compatibleVersion = versions.find((v: Version) =>
          v.game_versions.includes(this.config.gameVersion) &&
          v.loaders.includes(this.config.modLoader) &&
          v.version_number === mod.version
        );

        // 2. Búsqueda flexible (ej: usuario pide "1.5.0", modrinth tiene "v1.5.0")
        if (!compatibleVersion) {
          compatibleVersion = versions.find((v: Version) =>
            v.game_versions.includes(this.config.gameVersion) &&
            v.loaders.includes(this.config.modLoader) &&
            (v.version_number === `v${mod.version}` ||
              v.version_number.replace(/^v/, '') === mod.version)
          );
        }

        if (!compatibleVersion) {
          throw new Error(`Versión específica "${mod.version}" no encontrada para ${this.config.gameVersion} (${this.config.modLoader})`);
        }

        console.log(`✅ Versión específica encontrada: ${compatibleVersion.version_number}`);
      } else {
        // Buscar la versión más reciente compatible
        if (showSearchMessage) {
          console.log(`🔍 Buscando última versión de ${mod.name} para ${this.config.modLoader} ${this.config.gameVersion}`);
        }

        compatibleVersion = versions.find((v: Version) =>
          v.game_versions.includes(this.config.gameVersion) &&
          v.loaders.includes(this.config.modLoader)
        );

        if (!compatibleVersion) {
          throw new Error(`No se encontró ninguna versión compatible para ${this.config.modLoader} ${this.config.gameVersion}`);
        }

        if (showSearchMessage) {
          console.log(`✅ Última versión encontrada: ${compatibleVersion.version_number}`);
        }
      }

      const primaryFile = compatibleVersion.files[0];
      return {
        url: primaryFile.url,
        version: compatibleVersion.version_number,
        fileName: primaryFile.filename
      };
    } catch (error) {
      throw new Error(`Error obteniendo URL de Modrinth para ${mod.name}: ${(error as Error).message}`);
    }
  }

  private getCurseForgeDownloadUrl(mod: ModConfig): Promise<string> {
    // Nota: CurseForge requiere API key para acceso completo
    // Esta es una implementación simplificada
    console.log(`⚠️  CurseForge requiere configuración adicional para ${mod.name}`);
    throw new Error(`CurseForge no implementado completamente para ${mod.name}`);
  }

  private async downloadFile(url: string, filePath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Error descargando: ${response.status} ${response.statusText}`);
    }

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const file = await Deno.open(filePath, { create: true, write: true });
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('No se pudo leer el contenido de la descarga');
    }

    let downloaded = 0;
    const writer = file.writable.getWriter();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writer.write(value);
        downloaded += value.length;

        if (total > 0) {
          const percent = Math.round((downloaded / total) * 100);
          const progressText = `\r   📊 Progreso: ${percent}% (${this.formatBytes(downloaded)}/${this.formatBytes(total)})`;
          await Deno.stdout.write(new TextEncoder().encode(progressText));
        } else {
          const progressText = `\r   📊 Descargado: ${this.formatBytes(downloaded)}`;
          await Deno.stdout.write(new TextEncoder().encode(progressText));
        }
      }
      console.log(); // Nueva línea después del progreso
    } finally {
      await writer.close();
      reader.releaseLock();
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

class AutoUpdater {
  private isDev: boolean;

  constructor() {
    // Detectamos si estamos en desarrollo buscando "deno" en el ejecutable
    // o si el script se está ejecutando directamente
    this.isDev = Deno.execPath().includes('deno');
  }

  async check(): Promise<void> {
    // 1. Limpiar versiones antiguas (.old) si existen
    await this.cleanupOldVersions();

    if (this.isDev) {
      console.log('🛠️  Modo desarrollo: Saltando verificación de auto-update');
      return;
    }

    try {
      console.log('🔄 Buscando actualizaciones...');
      const latest = await this.getLatestRelease();
      const currentVer = parse(APP_VERSION);
      const latestVer = parse(latest.tag_name);

      if (greaterThan(latestVer, currentVer)) {
        console.log(`✨ Nueva versión disponible: ${latest.tag_name} (actual: v${APP_VERSION})`);
        await this.performUpdate(latest);
      } else {
        console.log('✅ Tu versión está actualizada');
      }
    } catch (error) {
      // Si falla el update, solo logueamos y dejamos que el programa continúe
      console.error('⚠️  Error verificando actualizaciones:', (error as Error).message);
    }
  }

  private async cleanupOldVersions(): Promise<void> {
    try {
      const execPath = Deno.execPath();
      const oldPath = `${execPath}.old`;

      // Intentar borrar .old si existe
      try {
        await Deno.remove(oldPath);
        // console.log("🧹 Limpieza: Versión antigua eliminada");
      } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
          // Ignorar silenciosamente si no se puede borrar (tal vez bloqueado)
        }
      }
    } catch {
      // Ignorar errores generales de limpieza
    }
  }

  private async getLatestRelease(): Promise<GitHubRelease> {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) {
      throw new Error(`GitHub API Error: ${response.statusText}`);
    }
    return await response.json();
  }

  private getAssetForPlatform(assets: GitHubAsset[]): GitHubAsset {
    const os = Deno.build.os; // windows, linux, darwin
    const arch = Deno.build.arch; // x86_64, aarch64

    let assetNamePattern = '';

    if (os === 'windows' && arch === 'x86_64') {
      assetNamePattern = 'mod-manager-windows-x64.exe';
    } else if (os === 'linux' && arch === 'x86_64') {
      assetNamePattern = 'mod-manager-linux-x64';
    } else if (os === 'darwin' && arch === 'aarch64') {
      assetNamePattern = 'mod-manager-macos-arm64';
    } else {
      throw new Error(`Plataforma no soportada para auto-update: ${os}-${arch}`);
    }

    const asset = assets.find((a) => a.name === assetNamePattern);
    if (!asset) {
      throw new Error(`Asset no encontrado para esta plataforma: ${assetNamePattern}`);
    }

    return asset;
  }

  private async performUpdate(release: GitHubRelease): Promise<void> {
    const asset = this.getAssetForPlatform(release.assets);
    const execPath = Deno.execPath();
    const oldPath = `${execPath}.old`;

    console.log(`⬇️  Descargando actualización: ${asset.name}`);
    console.log(`📦 Tamaño: ${(asset.size / 1024 / 1024).toFixed(2)} MB`);

    // 1. Descargar nueva versión a un archivo temporal
    const tempPath = `${execPath}.new`;

    // Descargar
    const response = await fetch(asset.browser_download_url);
    if (!response.ok) throw new Error('Error descargando update');

    const file = await Deno.open(tempPath, { create: true, write: true });
    await response.body?.pipeTo(file.writable);

    // Asegurar permisos en Unix
    if (Deno.build.os !== 'windows') {
      await Deno.chmod(tempPath, 0o755);
    }

    // 2. Renombrar actual a .old
    // En Windows no podemos borrar el ejecutable en uso, pero sí renombrarlo
    try {
      await Deno.rename(execPath, oldPath);
    } catch (error) {
      await Deno.remove(tempPath); // Limpieza
      throw new Error(`No se pudo renombrar el ejecutable actual: ${(error as Error).message}`);
    }

    // 3. Mover nuevo a ubicación original
    try {
      await Deno.rename(tempPath, execPath);
    } catch (error) {
      // Intentar revertir
      await Deno.rename(oldPath, execPath);
      throw new Error(`Error aplicando actualización: ${(error as Error).message}`);
    }

    console.log('🚀 Actualización exitosa! Reiniciando...');

    // 4. Reiniciar proceso
    const command = new Deno.Command(execPath, {
      args: Deno.args,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    });

    const child = command.spawn();
    // Salimos del proceso actual, el hijo toma el control
    Deno.exit((await child.status).code);
  }
}


// Función principal
async function main() {
  // Autoupdate check
  const updater = new AutoUpdater();
  await updater.check();

  const manager = new ModManager();
  await manager.init();

  console.log('\n🎮 Presiona Enter para cerrar...');
  await new Promise<void>((resolve) => {
    const decoder = new TextDecoder();
    const buffer = new Uint8Array(1024);

    Deno.stdin.read(buffer).then(() => {
      resolve();
    });
  });
}

if (import.meta.main) {
  main().catch((error) => console.error((error as Error).message));
}
#!/usr/bin/env -S deno run --allow-all

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
  mods: ModConfig[];
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

    // Eliminar mods no especificados en la configuración
    // Para esto, necesitamos ser más inteligentes ya que los nombres pueden cambiar
    const configModNames = this.config.mods.map(mod => 
      mod.name.toLowerCase().replace(/\s+/g, '-')
    );

    for (const currentMod of currentMods) {
      const modBaseName = this.extractModBaseName(currentMod);
      if (!configModNames.some(configName => modBaseName.includes(configName))) {
        console.log(`🗑️  Eliminando: ${currentMod}`);
        await Deno.remove(`${this.modsDir}/${currentMod}`);
      }
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
    if (mod.source === 'modrinth' && !mod.version) {
      // Para mods de Modrinth sin versión específica, necesitamos verificar si existe
      const modBaseName = mod.name.toLowerCase().replace(/\s+/g, '-');
      const existingMod = currentMods.find(current => 
        this.extractModBaseName(current).includes(modBaseName)
      );

      if (existingMod) {
        console.log(`✅ Ya existe: ${mod.name} (${existingMod})`);
        console.log(`🔍 Verificando si hay actualizaciones disponibles...`);
        
        try {
          // Obtener información de la última versión UNA SOLA VEZ
          const modrinthInfo = await this.getModrinthDownloadUrl(mod, false); // false = no mostrar mensaje de búsqueda
          const expectedFileName = modrinthInfo.fileName;
          
          if (existingMod !== expectedFileName) {
            console.log(`🔄 Actualizando: ${existingMod} → ${expectedFileName}`);
            await Deno.remove(`${this.modsDir}/${existingMod}`);
            // Descargar directamente con la información ya obtenida
            await this.downloadFile(modrinthInfo.url, `${this.modsDir}/${expectedFileName}`);
            await this.validateJarFile(`${this.modsDir}/${expectedFileName}`);
            console.log(`✅ Actualizado: ${mod.name} v${modrinthInfo.version}`);
          } else {
            console.log(`✅ ${mod.name} está actualizado (v${modrinthInfo.version})`);
          }
        } catch (error) {
          console.log(`⚠️  Error verificando actualizaciones para ${mod.name}: ${(error as Error).message}`);
        }
      } else {
        // Mod no existe, descargar
        try {
          console.log(`⬇️  Descargando: ${mod.name} (última versión compatible)`);
          const modrinthInfo = await this.getModrinthDownloadUrl(mod, true); // true = mostrar mensaje de búsqueda
          const filePath = `${this.modsDir}/${modrinthInfo.fileName}`;
          await this.downloadFile(modrinthInfo.url, filePath);
          await this.validateJarFile(filePath);
          console.log(`✅ Descargado: ${mod.name} v${modrinthInfo.version}`);
        } catch (error) {
          console.log(`❌ Error descargando ${mod.name}: ${(error as Error).message}`);
        }
      }
    } else {
      // Para mods con versión específica o otras fuentes
      const fileName = mod.fileName || this.generateFileName(mod);
      const filePath = `${this.modsDir}/${fileName}`;
      
      try {
        await Deno.stat(filePath);
        console.log(`✅ Ya existe: ${mod.name}`);
      } catch {
        console.log(`⬇️  Descargando: ${mod.name} v${mod.version || 'latest'}`);
        await this.downloadMod(mod, filePath);
      }
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
      let bestMatch = searchResults.hits.find((hit: any) => 
        hit.title.toLowerCase() === modName.toLowerCase() || 
        hit.slug.toLowerCase() === modName.toLowerCase()
      );
      
      // Si no hay coincidencia exacta, buscar por similitud
      if (!bestMatch) {
        bestMatch = searchResults.hits.find((hit: any) =>
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
        // Buscar versión específica
        compatibleVersion = versions.find((v: any) => 
          v.game_versions.includes(this.config.gameVersion) &&
          v.loaders.includes(this.config.modLoader) &&
          v.version_number === mod.version
        );
        
        if (!compatibleVersion) {
          throw new Error(`Versión específica ${mod.version} no encontrada o no compatible`);
        }
      } else {
        // Buscar la versión más reciente compatible
        if (showSearchMessage) {
          console.log(`🔍 Buscando última versión de ${mod.name} para ${this.config.modLoader} ${this.config.gameVersion}`);
        }
        
        compatibleVersion = versions.find((v: any) => 
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

  private async getCurseForgeDownloadUrl(mod: ModConfig): Promise<string> {
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

// Función principal
async function main() {
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
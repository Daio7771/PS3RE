// Plataforma actual y entorno con el que se lanzan los programas externos.
export const IS_WINDOWS = process.platform === 'win32';
export const IS_LINUX = process.platform === 'linux';

// Variables tipo lista (separadas por «:») que el AppImage amplía con rutas
// de su propia carpeta montada. Un juego no debe heredarlas: cargaría
// bibliotecas del AppImage en vez de las del sistema.
const APPIMAGE_LISTS = [
  'PATH',
  'LD_LIBRARY_PATH',
  'XDG_DATA_DIRS',
  'GSETTINGS_SCHEMA_DIR',
  'QT_PLUGIN_PATH',
  'PYTHONPATH',
  'PERLLIB',
  'GST_PLUGIN_SYSTEM_PATH',
  'GST_PLUGIN_SYSTEM_PATH_1_0',
];
const APPIMAGE_VARS = ['APPDIR', 'APPIMAGE', 'ARGV0', 'OWD'];

function withoutAppDir(value, appDir) {
  return value
    .split(':')
    .filter((part) => part && part !== appDir && !part.startsWith(`${appDir}/`))
    .join(':');
}

/**
 * Entorno «del sistema» para lanzar juegos y lanzadores: el del proceso sin
 * los añadidos del AppImage ni los cambios que hace Electron. `extra` se
 * añade al final (variables propias de un juego).
 */
export function hostEnv(extra = {}) {
  const env = { ...process.env };
  const appDir = process.env.APPDIR;
  if (process.env.APPIMAGE && appDir) {
    for (const key of APPIMAGE_LISTS) {
      if (env[key] === undefined) continue;
      const cleaned = withoutAppDir(env[key], appDir);
      if (cleaned) env[key] = cleaned;
      else delete env[key];
    }
    for (const key of APPIMAGE_VARS) delete env[key];
  }
  // Electron cambia el escritorio declarado (por la bandeja del sistema) y
  // guarda el original; xdg-open y los juegos deben ver el de verdad.
  if (env.ORIGINAL_XDG_CURRENT_DESKTOP !== undefined) {
    env.XDG_CURRENT_DESKTOP = env.ORIGINAL_XDG_CURRENT_DESKTOP;
    delete env.ORIGINAL_XDG_CURRENT_DESKTOP;
  }
  delete env.CHROME_DESKTOP;
  delete env.ELECTRON_RUN_AS_NODE;
  return { ...env, ...extra };
}

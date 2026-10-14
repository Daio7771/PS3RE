// Biblioteca de Steam: carpetas de biblioteca → manifiestos de cada app →
// juegos instalados, con sus carátulas de la caché local de Steam.
//   · Windows: la carpeta de Steam sale del registro.
//   · Linux: se busca en las rutas habituales (paquete de la distribución,
//     Flatpak y Snap). Si hay varias instalaciones se juntan sin repetir.
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseVdf } from './vdf.js';
import { IS_WINDOWS } from './platform.js';
import { regValue } from './windows.js';
import { listProcesses } from './linux.js';

const STEAM_KEY = 'HKCU\\Software\\Valve\\Steam';
const STATE_INSTALLED = 4;

// Herramientas que Steam instala como «apps» pero no son juegos.
const TOOL_IDS = new Set([
  '228980', // Steamworks Common Redistributables
  '250820', // SteamVR
  '1070560', // Steam Linux Runtime 1.0
  '1391110', // Steam Linux Runtime 2.0
  '1628350', // Steam Linux Runtime 3.0
  '1493710', // Proton Experimental
  '2180100', // Proton Hotfix
]);
const TOOL_NAME = /redistributable|proton|steam linux runtime|steamvr|dedicated server|\bsdk\b/i;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ── Dónde está Steam ──

// Carpeta que Steam ve como su «home» en cada tipo de instalación de Linux.
// En Flatpak el home del sandbox es ~/.var/app/<id>, y las rutas que Steam
// guarda (p. ej. en libraryfolders.vdf) son las de dentro del sandbox.
function linuxInstalls() {
  const home = homedir();
  const dataHome = process.env.XDG_DATA_HOME || join(home, '.local', 'share');
  const flatpak = join(home, '.var', 'app', 'com.valvesoftware.Steam');
  const snap = join(home, 'snap', 'steam', 'common');
  return [
    { home, root: join(home, '.steam', 'root') },
    { home, root: join(home, '.steam', 'steam') },
    { home, root: join(dataHome, 'Steam') },
    { home: flatpak, root: join(flatpak, '.local', 'share', 'Steam') },
    { home: flatpak, root: join(flatpak, 'data', 'Steam') },
    { home: snap, root: join(snap, '.local', 'share', 'Steam') },
  ];
}

/** Instalaciones de Steam encontradas: [{ root, home }] (home = null en Windows). */
async function steamInstalls() {
  if (IS_WINDOWS) {
    const path = await regValue(STEAM_KEY, 'SteamPath');
    const root = path ? path.replace(/\//g, '\\') : null;
    return root && (await exists(root)) ? [{ root, home: null }] : [];
  }
  const installs = [];
  const seen = new Set();
  for (const candidate of linuxInstalls()) {
    let root;
    try {
      root = await realpath(candidate.root);
    } catch {
      continue;
    }
    if (seen.has(root) || !(await exists(join(root, 'steamapps')))) continue;
    seen.add(root);
    installs.push({ root, home: candidate.home });
  }
  return installs;
}

// Ruta de una biblioteca tal como la ve este proceso. En Flatpak, una ruta
// dentro del home del sandbox (/home/ana/.local/share/Steam) está realmente
// en ~/.var/app/com.valvesoftware.Steam/.local/share/Steam.
async function hostPath(path, install) {
  const home = homedir();
  if (install.home && install.home !== home && (path === home || path.startsWith(`${home}/`))) {
    const mapped = join(install.home, path.slice(home.length));
    if (await exists(mapped)) return mapped;
  }
  return path;
}

async function libraryFolders(install) {
  const folders = [install.root];
  try {
    const vdf = parseVdf(await readFile(join(install.root, 'steamapps', 'libraryfolders.vdf'), 'utf8'));
    for (const entry of Object.values(vdf.libraryfolders ?? {})) {
      if (entry?.path) folders.push(await hostPath(entry.path, install));
    }
  } catch {
    // sin libraryfolders.vdf: sólo la carpeta principal
  }
  // Sin repetir (la principal suele aparecer también en el archivo).
  const unique = new Map();
  for (const folder of folders) {
    let key = folder;
    try {
      key = await realpath(folder);
    } catch {
      // no existe: se descarta al leerla
    }
    if (!unique.has(key)) unique.set(key, folder);
  }
  return [...unique.values()];
}

// ── Carátulas ──

// Imágenes en caché de un juego, por nombre de archivo. Steam usa
// librarycache/<appid>/<nombre>, a veces dentro de subcarpetas con hash, y en
// versiones antiguas librarycache/<appid>_<nombre>.
async function cachedArt(root, appid) {
  const cache = join(root, 'appcache', 'librarycache');
  const found = new Map();
  const dir = join(cache, appid);
  try {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isFile()) {
        found.set(entry.name.toLowerCase(), join(dir, entry.name));
      } else if (entry.isDirectory()) {
        for (const name of await readdir(join(dir, entry.name))) {
          const key = name.toLowerCase();
          if (!found.has(key)) found.set(key, join(dir, entry.name, name));
        }
      }
    }
  } catch {
    // sin carpeta propia: se prueba el formato antiguo
  }
  const pick = async (names) => {
    for (const name of names) {
      if (found.has(name)) return found.get(name);
      const legacy = join(cache, `${appid}_${name}`);
      if (await exists(legacy)) return legacy;
    }
    return null;
  };
  return {
    header: await pick(['header_spanish.jpg', 'header.jpg', 'library_header.jpg']),
    hero: await pick(['library_hero.jpg']),
    logo: await pick(['logo.png']),
  };
}

// ── Juegos instalados ──

export async function scanSteam() {
  const games = [];
  const seen = new Set();
  for (const install of await steamInstalls()) {
    for (const folder of await libraryFolders(install)) {
      const apps = join(folder, 'steamapps');
      let files = [];
      try {
        files = (await readdir(apps)).filter((f) => /^appmanifest_\d+\.acf$/.test(f));
      } catch {
        continue;
      }
      for (const file of files) {
        try {
          const state = parseVdf(await readFile(join(apps, file), 'utf8')).appstate;
          const appid = state?.appid;
          if (!/^\d+$/.test(appid ?? '') || !state.name || seen.has(appid)) continue;
          if ((Number(state.stateflags) & STATE_INSTALLED) === 0) continue;
          if (TOOL_IDS.has(appid) || TOOL_NAME.test(state.name)) continue;
          seen.add(appid);
          games.push({
            id: `steam:${appid}`,
            source: 'steam',
            name: state.name,
            lastPlayed: Number(state.lastplayed) || 0,
            sizeOnDisk: Number(state.sizeondisk) || 0,
            art: await cachedArt(install.root, appid),
            launch: { uri: `steam://rungameid/${appid}` },
            watch: { steamAppId: Number(appid) },
          });
        } catch {
          // manifiesto ilegible: se ignora
        }
      }
    }
  }
  return games;
}

// ── Juego en marcha ──

// Steam en Linux arranca cada juego (nativo o con Proton) a través de su
// proceso «reaper», que vive mientras dure la partida:
//   …/ubuntu12_32/reaper SteamLaunch AppId=<appid> -- …
async function reaperRunning(appid) {
  const tag = `AppId=${appid}`;
  return (await listProcesses()).some((proc) => proc.argv.includes('SteamLaunch') && proc.argv.includes(tag));
}

// Copia en disco del «registro» de Steam en Linux (registry.vdf), con el
// mismo RunningAppID que en Windows. Sólo de respaldo: Steam no siempre lo
// escribe al momento.
async function registryRunningAppIds() {
  const home = homedir();
  const files = [
    join(home, '.steam', 'registry.vdf'),
    join(home, '.var', 'app', 'com.valvesoftware.Steam', '.steam', 'registry.vdf'),
    join(home, 'snap', 'steam', 'common', '.steam', 'registry.vdf'),
  ];
  const ids = new Set();
  for (const file of files) {
    try {
      const vdf = parseVdf(await readFile(file, 'utf8'));
      const id = Number(vdf.registry?.hkcu?.software?.valve?.steam?.runningappid);
      if (id) ids.add(id);
    } catch {
      // no existe o no se puede leer
    }
  }
  return ids;
}

/**
 * Función que dice si el juego `appid` de Steam está en marcha, para
 * sondearla. En Linux, en cuanto se ha visto su «reaper», sólo cuenta él
 * (registry.vdf puede tardar en actualizarse al cerrar el juego).
 */
export function steamRunningProbe(appid) {
  if (IS_WINDOWS) return async () => (await regValue(STEAM_KEY, 'RunningAppID')) === appid;
  let sawReaper = false;
  return async () => {
    if (await reaperRunning(appid)) {
      sawReaper = true;
      return true;
    }
    if (sawReaper) return false;
    return (await registryRunningAppIds()).has(appid);
  };
}

/**
 * appid que vigilar para una URI de Steam (accesos directos de Steam y juegos
 * externos añadidos a Steam); null si no es una URI de lanzamiento de Steam.
 * Los juegos externos usan un id de 64 bits cuya mitad alta es su appid.
 */
export function steamAppIdFromUri(uri) {
  const match = /^steam:\/\/(?:rungameid|run)\/(\d+)/i.exec(uri ?? '');
  if (!match) return null;
  const id = BigInt(match[1]);
  return Number(id > 0xffffffffn ? id >> 32n : id) || null;
}

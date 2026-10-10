// Biblioteca de Steam: carpetas de biblioteca → manifiestos de cada app →
// juegos instalados, con sus carátulas de la caché local de Steam.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { parseVdf } from './vdf.js';
import { regValue } from './windows.js';

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

async function steamPath() {
  const path = await regValue(STEAM_KEY, 'SteamPath');
  return path ? path.replace(/\//g, '\\') : null;
}

async function libraryFolders(root) {
  try {
    const vdf = parseVdf(await readFile(join(root, 'steamapps', 'libraryfolders.vdf'), 'utf8'));
    const folders = Object.values(vdf.libraryfolders ?? {})
      .map((entry) => entry?.path)
      .filter(Boolean);
    return folders.length ? folders : [root];
  } catch {
    return [root];
  }
}

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

export async function scanSteam() {
  const root = await steamPath();
  if (!root || !(await exists(root))) return [];

  const games = [];
  for (const folder of await libraryFolders(root)) {
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
        if (!/^\d+$/.test(appid ?? '') || !state.name) continue;
        if ((Number(state.stateflags) & STATE_INSTALLED) === 0) continue;
        if (TOOL_IDS.has(appid) || TOOL_NAME.test(state.name)) continue;
        games.push({
          id: `steam:${appid}`,
          source: 'steam',
          name: state.name,
          lastPlayed: Number(state.lastplayed) || 0,
          sizeOnDisk: Number(state.sizeondisk) || 0,
          art: await cachedArt(root, appid),
          launch: { uri: `steam://rungameid/${appid}` },
          watch: { steamAppId: Number(appid) },
        });
      } catch {
        // manifiesto ilegible: se ignora
      }
    }
  }
  return games;
}

/** appid del juego de Steam en marcha (0 si ninguno). */
export async function steamRunningAppId() {
  return (await regValue(STEAM_KEY, 'RunningAppID')) ?? 0;
}

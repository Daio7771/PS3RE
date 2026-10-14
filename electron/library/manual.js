// Juegos añadidos a mano, desde Juego → Añadir juego o editando games.json
// (en la carpeta de datos de la app). Formato de cada juego:
//   {
//     "name": "Celeste",                       nombre en el XMB
//     "command": "~/Juegos/Celeste/Celeste",   programa (o "uri": "heroic://…")
//     "args": ["--fullscreen"],                opcional (lista o texto)
//     "cwd": "~/Juegos/Celeste",               opcional (por defecto, su carpeta)
//     "env": { "SDL_VIDEODRIVER": "x11" },     opcional
//     "process": ["Celeste"],                  opcional: qué proceso vigilar
//     "cover": "…jpg", "background": "…jpg", "logo": "…png"   opcional: imágenes
//   }
// El archivo es del usuario: si no se puede leer, no se sobrescribe nunca.
import { chmod, mkdir, open, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, extname, isAbsolute, join } from 'node:path';
import { parseDesktopEntry, splitCommandLine } from './desktopEntry.js';
import { baseName } from './linux.js';
import { IS_WINDOWS } from './platform.js';
import { steamAppIdFromUri } from './steam.js';

/** Error con un mensaje pensado para enseñárselo al usuario tal cual. */
export class ManualGameError extends Error {}

const MAX_SHORTCUT_BYTES = 256 * 1024;
const ID_PATTERN = /^manual:[\w-]{1,64}$/;

const WINDOWS_ON_LINUX =
  'Es un programa de Windows y Linux no puede abrirlo directamente.\n\n' +
  'Añádelo a Steam como juego externo (con Proton) o instálalo con Heroic o Lutris, ' +
  'crea su acceso directo y elige aquí ese archivo .desktop.';

const str = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

function expandHome(path) {
  if (!path) return null;
  if (path === '~') return homedir();
  if (path.startsWith('~/')) return join(homedir(), path.slice(2));
  return path;
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Argumentos de Windows: separados por espacios, comillas dobles y «\"».
// La barra invertida suelta es parte de las rutas, no un escape.
function splitWindowsArgs(line) {
  const args = [];
  let current = '';
  let started = false;
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '"') {
      current += '"';
      started = true;
      i++;
    } else if (c === '"') {
      quoted = !quoted;
      started = true;
    } else if (!quoted && /\s/.test(c)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += c;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}

const splitArgs = (line) => (IS_WINDOWS ? splitWindowsArgs(line) : splitCommandLine(line));

/** Nombre legible a partir de un archivo: «Celeste-1.4.0.0-x86_64.AppImage» → «Celeste». */
export function prettyName(path) {
  let name = baseName(path).replace(/\.(appimage|sh|x86_64|x86|exe|lnk|url|bat|cmd|desktop|bin|run)$/i, '');
  name = name
    .replace(/[\s._-]+v?\d+(?:\.\d+)+.*$/i, '') // versión y lo que venga detrás
    .replace(/[._-]+/g, ' ')
    .replace(/\b(x86 ?64|x64|amd64|i[3-6]86|arm64|aarch64|linux(?:64)?|win(?:32|64)?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return 'Juego';
  return name === name.toLowerCase() ? name[0].toUpperCase() + name.slice(1) : name;
}

// ── games.json ──

/** Juego del archivo, ya limpio; null si no sirve (sin programa ni URI). */
function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const command = expandHome(str(raw.command));
  const uri = str(raw.uri) && /^[a-z][a-z0-9+.-]*:/i.test(raw.uri.trim()) ? raw.uri.trim() : null;
  const openPath = expandHome(str(raw.open));
  if (!command && !uri && !openPath) return null;

  let args = [];
  if (Array.isArray(raw.args)) args = raw.args.filter((a) => typeof a === 'string');
  else if (typeof raw.args === 'string') args = splitArgs(raw.args);

  const env = {};
  if (raw.env && typeof raw.env === 'object' && !Array.isArray(raw.env)) {
    for (const [key, value] of Object.entries(raw.env)) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && typeof value === 'string') env[key] = value;
    }
  }

  const processes = (Array.isArray(raw.process) ? raw.process : [raw.process])
    .map(str)
    .filter(Boolean)
    .map((name) => name.toLowerCase());

  // Sin id propio (escrito a mano), uno estable a partir de cómo se lanza,
  // para que no se pierda la fecha de la última partida.
  const id =
    typeof raw.id === 'string' && ID_PATTERN.test(raw.id)
      ? raw.id
      : `manual:${createHash('sha1')
          .update(JSON.stringify([command, uri, openPath, args]))
          .digest('hex')
          .slice(0, 12)}`;

  return {
    id,
    name: str(raw.name) ?? prettyName(command ?? openPath ?? uri),
    command,
    uri: command ? null : uri,
    open: command || uri ? null : openPath,
    args,
    cwd: expandHome(str(raw.cwd)),
    env,
    process: processes,
    cover: expandHome(str(raw.cover)),
    background: expandHome(str(raw.background)),
    logo: expandHome(str(raw.logo)),
  };
}

// Lo que se escribe en el archivo: sólo los campos con valor.
function storedEntry(entry) {
  const out = { id: entry.id, name: entry.name };
  for (const key of ['command', 'uri', 'open', 'cwd', 'cover', 'background', 'logo']) {
    if (entry[key]) out[key] = entry[key];
  }
  if (entry.args?.length) out.args = entry.args;
  if (entry.env && Object.keys(entry.env).length) out.env = entry.env;
  if (entry.process?.length) out.process = entry.process;
  return out;
}

/**
 * Contenido de games.json: lista de juegos tal cual (sin limpiar). Si el
 * archivo no existe, lista vacía; si existe pero está roto, error.
 */
async function readStore(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new ManualGameError(`No se puede leer la lista de juegos añadidos:\n${file}`);
  }
  if (!text.trim()) return [];
  try {
    const data = JSON.parse(text);
    const games = Array.isArray(data) ? data : data?.games;
    if (Array.isArray(games)) return games;
  } catch {
    // se avisa abajo
  }
  throw new ManualGameError(
    `La lista de juegos añadidos tiene un error y no se ha tocado para no perder nada:\n${file}\n\n` +
      'Corrígela (es un archivo JSON) o bórrala para empezar de cero.',
  );
}

// Escritura atómica: primero a un temporal y luego se renombra, para que
// un corte a medias no deje el archivo vacío.
async function writeStore(file, games) {
  await mkdir(dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify({ games }, null, 2)}\n`, 'utf8');
  await rename(temp, file);
}

const launchKey = (entry) => JSON.stringify([entry.command, entry.uri, entry.open, entry.args]);

async function existing(path) {
  return path && isAbsolute(path) && (await exists(path)) ? path : null;
}

/** Juego en el formato de la biblioteca (como los de Steam). */
async function toGame(entry) {
  const art = {
    header: await existing(entry.cover),
    hero: await existing(entry.background),
    logo: await existing(entry.logo),
  };
  let launch;
  let watch;
  if (entry.command) {
    launch = { command: entry.command, args: entry.args, cwd: entry.cwd, env: entry.env };
    watch = { spawned: true, executables: entry.process };
  } else if (entry.uri) {
    launch = { uri: entry.uri };
    const steamAppId = steamAppIdFromUri(entry.uri);
    watch = steamAppId ? { steamAppId } : { spawned: true, executables: entry.process };
  } else {
    launch = { open: entry.open };
    watch = { executables: entry.process };
  }
  return { id: entry.id, source: 'manual', name: entry.name, lastPlayed: 0, sizeOnDisk: 0, art, launch, watch };
}

/** Juegos de games.json para la biblioteca. Nunca falla: si hay un problema, ninguno. */
export async function loadManualGames(file) {
  let raw;
  try {
    raw = await readStore(file);
  } catch (error) {
    console.warn(`[juegos añadidos] ${error.message}`);
    return [];
  }
  const games = [];
  const seen = new Set();
  for (const item of raw) {
    const entry = normalizeEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    games.push(await toGame(entry));
  }
  return games;
}

// ── Añadir desde un archivo ──

async function readHead(path, bytes) {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function entryFromDesktopFile(path, info) {
  if (info.size > MAX_SHORTCUT_BYTES) throw new ManualGameError('Ese archivo no parece un acceso directo.');
  const entry = parseDesktopEntry(await readFile(path, 'utf8'));
  const name = entry.name ?? prettyName(path);
  if (entry.type === 'Link') {
    if (!entry.url) throw new ManualGameError('El acceso directo no tiene ningún enlace.');
    return { name, uri: entry.url };
  }
  if (entry.type && entry.type !== 'Application') {
    throw new ManualGameError('Ese acceso directo no abre ningún programa.');
  }
  const argv = entry.exec ? splitCommandLine(entry.exec) : [];
  if (!argv.length) throw new ManualGameError('El acceso directo no tiene una orden válida (Exec).');
  // Accesos directos de Steam (también de juegos externos añadidos a Steam):
  // se guardan como su URI para poder vigilar la partida.
  const steamUri = argv.find((arg) => steamAppIdFromUri(arg));
  if (steamUri) return { name, uri: steamUri };
  return { name, command: argv[0], args: argv.slice(1), cwd: entry.path };
}

async function entryFromLinuxFile(path, ext, info) {
  const head = await readHead(path, 4);
  if (['.exe', '.msi', '.bat', '.cmd', '.lnk'].includes(ext) || head.toString('latin1', 0, 2) === 'MZ') {
    throw new ManualGameError(WINDOWS_ON_LINUX);
  }
  const isElf = head.length === 4 && head[0] === 0x7f && head.toString('latin1', 1, 4) === 'ELF';
  const isScript = head.toString('latin1', 0, 2) === '#!';
  const name = prettyName(path);
  const cwd = dirname(path);
  if (isElf || isScript) {
    // Un AppImage o un juego recién descomprimido suelen venir sin permiso
    // de ejecución; al añadirlo como juego se le da (sólo al dueño).
    if ((info.mode & 0o100) === 0) {
      try {
        await chmod(path, info.mode | 0o100);
      } catch {
        throw new ManualGameError(
          'El archivo no tiene permiso de ejecución y no se ha podido dárselo.\n\n' +
            'Dáselo desde sus propiedades (Permisos → Permitir ejecutar) y vuelve a probar.',
        );
      }
    }
    return { name, command: path, cwd };
  }
  if (ext === '.sh') return { name, command: '/bin/sh', args: [path], cwd };
  throw new ManualGameError(
    'Ese archivo no es un programa.\n\nElige el ejecutable del juego, un AppImage, un script .sh o un acceso directo .desktop.',
  );
}

async function entryFromWindowsFile(path, ext, info) {
  const name = prettyName(path);
  if (ext === '.exe') return { name, command: path, cwd: dirname(path) };
  if (ext === '.url') {
    if (info.size > MAX_SHORTCUT_BYTES) throw new ManualGameError('Ese archivo no parece un acceso directo.');
    const url = /^\s*URL\s*=\s*(.+?)\s*$/im.exec(await readFile(path, 'utf8'))?.[1];
    if (!url) throw new ManualGameError('El acceso directo no tiene ningún enlace.');
    return { name, uri: url };
  }
  if (ext === '.lnk') {
    // Si apunta a un .exe se guarda el programa, para poder vigilarlo.
    try {
      const { shell } = await import('electron');
      const link = shell.readShortcutLink(path);
      if (link.target && /\.exe$/i.test(link.target)) {
        return {
          name,
          command: link.target,
          args: link.args ? splitWindowsArgs(link.args) : [],
          cwd: link.cwd || dirname(link.target),
        };
      }
    } catch {
      // no se puede leer: se abre como acceso directo
    }
    return { name, open: path };
  }
  if (ext === '.bat' || ext === '.cmd') return { name, open: path };
  throw new ManualGameError('Ese archivo no es un programa.\n\nElige el .exe del juego o un acceso directo.');
}

/** Datos de un juego a partir del archivo elegido. Error con mensaje si no sirve. */
async function entryFromFile(path) {
  let info;
  try {
    info = await stat(path);
  } catch {
    throw new ManualGameError('No se encuentra el archivo.');
  }
  if (!info.isFile()) throw new ManualGameError('Elige un archivo, no una carpeta.');
  const ext = extname(path).toLowerCase();
  if (ext === '.desktop' && !IS_WINDOWS) return entryFromDesktopFile(path, info);
  return IS_WINDOWS ? entryFromWindowsFile(path, ext, info) : entryFromLinuxFile(path, ext, info);
}

/**
 * Añade el juego del archivo `path`. Devuelve { id, added } (added = false si
 * ya estaba en la lista). Error con mensaje para el usuario si no se puede.
 */
export async function addManualGame(file, path) {
  const raw = await readStore(file); // antes que nada: si está roto, no se toca
  const entry = normalizeEntry({ ...(await entryFromFile(path)), id: `manual:${randomUUID().slice(0, 13)}` });
  if (!entry) throw new ManualGameError('No se ha podido añadir el juego.');
  const key = launchKey(entry);
  for (const item of raw) {
    const other = normalizeEntry(item);
    if (other && launchKey(other) === key) return { id: other.id, added: false };
  }
  raw.push(storedEntry(entry));
  await writeStore(file, raw);
  return { id: entry.id, added: true };
}

/** Quita de la lista el juego `id`. Devuelve true si estaba. */
export async function removeManualGame(file, id) {
  const raw = await readStore(file);
  const kept = raw.filter((item) => normalizeEntry(item)?.id !== id);
  if (kept.length === raw.length) return false;
  await writeStore(file, kept);
  return true;
}

// Proceso principal: ventana del XMB a pantalla completa y lanzador de juegos.
// La interfaz no tiene acceso a Node: sólo a la API mínima de preload.cjs.
// El lanzador únicamente acepta ids de juegos de su propia biblioteca
// (detectados o añadidos a mano con el selector de archivos del sistema).
// Con `--build` (acceso directo, npm start) recompila la interfaz al arrancar.
// Apagado instantáneo: Ctrl+Q aquí; Select+Start del mando, desde la interfaz.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, shell } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ART_KINDS, loadRecent, saveRecent, scanLibrary, toPublic } from './library/index.js';
import { watchGame } from './library/watch.js';
import { launchGame, LaunchError } from './library/launch.js';
import { addManualGame, removeManualGame, ManualGameError } from './library/manual.js';
import { distroName } from './library/linux.js';
import { IS_LINUX, IS_WINDOWS } from './library/platform.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const DIST = join(ROOT, 'dist');
const ICON = join(ROOT, 'build', IS_WINDOWS ? 'icon.ico' : 'icon.png');
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const APP_URL = 'app://xmb/';
const BUILD_ON_START = process.argv.includes('--build');

// Política de contenido de la interfaz compilada: sólo código propio; las
// imágenes de juegos llegan por xmb-art: y Vite incrusta los trozos pequeños
// de la tipografía como data:. (En desarrollo la sirve Vite.)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' xmb-art: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

/** Apaga la consola al instante: sin despedidas ni esperas. */
const powerOff = () => app.exit(0);

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
  { scheme: 'xmb-art', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// Una sola consola: si ya hay una abierta, ésta se cierra y aquélla vuelve al
// frente (evento second-instance).
const isPrimary = app.requestSingleInstanceLock();
if (!isPrimary) app.exit(0);

let win = null;
let library = [];
let libraryReady = Promise.resolve([]);
let watcher = null;
let recent = {};
let fullScreenBeforeGame = true;
const recentFile = () => join(app.getPath('userData'), 'recent.json');
const manualFile = () => join(app.getPath('userData'), 'games.json');

// Qué se puede elegir en Juego → Añadir juego.
const ADD_GAME_FILTERS = IS_WINDOWS
  ? [
      { name: 'Juegos y accesos directos', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] },
      { name: 'Todos los archivos', extensions: ['*'] },
    ]
  : [
      { name: 'Todos los archivos', extensions: ['*'] },
      { name: 'Accesos directos (.desktop)', extensions: ['desktop'] },
      { name: 'AppImage', extensions: ['AppImage', 'appimage'] },
      { name: 'Scripts (.sh)', extensions: ['sh'] },
    ];

const findGame = (id) => library.find((g) => g.id === id) ?? null;
const status = (code) => new Response(null, { status: code });

// Ruta de una URL ya decodificada; null si trae una secuencia % rota.
function decodedPath(url) {
  try {
    return decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }
}

async function refreshLibrary() {
  recent = await loadRecent(recentFile());
  library = await scanLibrary({ recent, manualFile: manualFile() });
  return library;
}

/** Vuelve a leer la biblioteca (tras añadir o quitar un juego) y la devuelve lista para la interfaz. */
async function reloadLibrary() {
  libraryReady = refreshLibrary().catch(() => (library = []));
  return (await libraryReady).map(toPublic);
}

function registerProtocols() {
  // xmb-art://art/<id>/<header|hero|logo> → imagen en caché de un juego conocido.
  protocol.handle('xmb-art', (request) => {
    const [, id = '', kind] = (decodedPath(request.url) ?? '').split('/');
    const game = findGame(id);
    const file = game && ART_KINDS.includes(kind) ? game.art[kind] : null;
    return file ? net.fetch(pathToFileURL(file).toString()) : status(404);
  });

  // app://xmb/… → la interfaz compilada (dist), sin salir de esa carpeta y
  // con su política de contenido.
  protocol.handle('app', async (request) => {
    const path = decodedPath(request.url);
    if (path === null) return status(400);
    const target = normalize(join(DIST, path === '/' ? '/index.html' : path));
    if (!target.startsWith(DIST + sep)) return status(403);
    const response = await net.fetch(pathToFileURL(target).toString());
    const headers = new Headers(response.headers);
    headers.set('Content-Security-Policy', CSP);
    return new Response(response.body, { status: response.status, headers });
  });
}

function sendGameState(id, state, error) {
  if (win && !win.isDestroyed()) win.webContents.send('game:state', { id, state, error });
}

/** Aparta la consola mientras se juega. */
function minimizeForGame() {
  if (!win || win.isDestroyed() || win.isMinimized()) return;
  fullScreenBeforeGame = win.isFullScreen();
  win.minimize();
}

/** Trae la consola al frente (`afterGame`: al terminar una partida). */
function bringBack(afterGame = false) {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  win.show();
  // Al restaurar, algunos escritorios de Linux sacan la ventana de pantalla completa.
  if (afterGame && fullScreenBeforeGame && !win.isFullScreen()) win.setFullScreen(true);
  if (IS_LINUX) {
    // El gestor de ventanas puede negarse a dar el foco a una app que no lo
    // ha pedido el usuario (en Wayland casi siempre: avisa en vez de traerla).
    // En X11, un «siempre encima» momentáneo la sube por encima de Steam.
    win.setAlwaysOnTop(true);
    win.moveTop();
    win.focus();
    setTimeout(() => {
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(false);
    }, 400);
    return;
  }
  win.focus();
}

async function showWarning(title, message, detail) {
  if (!win || win.isDestroyed()) return;
  await dialog.showMessageBox(win, { type: 'warning', title, message, detail, buttons: ['Aceptar'], noLink: true });
}

function registerIpc() {
  const fromOurWindow = (event) => win && event.sender === win.webContents;

  ipcMain.handle('library:get', async (event) => {
    if (!fromOurWindow(event)) return [];
    return (await libraryReady).map(toPublic);
  });

  ipcMain.handle('game:launch', async (event, id) => {
    if (!fromOurWindow(event)) return { ok: false };
    const game = findGame(String(id));
    if (!game) return { ok: false, error: 'Juego desconocido' };
    watcher?.stop();
    watcher = null;
    let handle;
    try {
      handle = await launchGame(game);
    } catch (error) {
      return { ok: false, error: error instanceof LaunchError ? error.message : 'No se ha podido iniciar el juego' };
    }
    recent[game.id] = Math.floor(Date.now() / 1000);
    game.lastPlayed = recent[game.id];
    saveRecent(recentFile(), recent).catch(() => {});
    watcher = watchGame(game, handle, {
      onRunning() {
        sendGameState(game.id, 'running');
        minimizeForGame();
      },
      onExit() {
        watcher = null;
        bringBack(true);
        sendGameState(game.id, 'exited');
      },
      // Lo ha recogido otro programa (Heroic, Lutris…) y no se puede seguir:
      // la consola se aparta y no vuelve sola; al volver, menú.
      onHandoff() {
        watcher = null;
        minimizeForGame();
        sendGameState(game.id, 'exited');
      },
      onFailed(message) {
        watcher = null;
        bringBack(true);
        sendGameState(game.id, 'failed', message);
      },
    });
    return { ok: true };
  });

  // Juego → Añadir juego: selector de archivos del sistema. Los errores se
  // explican con un aviso del sistema (el mismo tipo de ventana que el selector).
  ipcMain.handle('game:add', async (event) => {
    if (!fromOurWindow(event)) return { ok: false };
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Añadir juego',
      buttonLabel: 'Añadir',
      defaultPath: app.getPath('home'),
      properties: ['openFile', 'dontAddToRecent'],
      filters: ADD_GAME_FILTERS,
    });
    if (canceled || !filePaths?.length) return { ok: false, canceled: true };
    try {
      const { id } = await addManualGame(manualFile(), filePaths[0]);
      return { ok: true, id, games: await reloadLibrary() };
    } catch (error) {
      const detail = error instanceof ManualGameError ? error.message : String(error?.message ?? error);
      await showWarning('Añadir juego', 'No se ha podido añadir el juego', detail);
      return { ok: false };
    }
  });

  ipcMain.handle('game:remove', async (event, id) => {
    if (!fromOurWindow(event)) return { ok: false };
    const game = findGame(String(id));
    if (game?.source !== 'manual') return { ok: false };
    try {
      await removeManualGame(manualFile(), game.id);
    } catch (error) {
      const detail = error instanceof ManualGameError ? error.message : String(error?.message ?? error);
      await showWarning('Quitar de la lista', 'No se ha podido quitar el juego', detail);
      return { ok: false };
    }
    return { ok: true, games: await reloadLibrary() };
  });

  // Nombre de la distribución para Información del sistema (sólo Linux).
  ipcMain.handle('system:distro', async (event) => {
    if (!fromOurWindow(event) || !IS_LINUX) return null;
    return distroName();
  });

  ipcMain.handle('game:cancel', (event) => {
    if (!fromOurWindow(event)) return;
    watcher?.stop();
    watcher = null;
  });

  ipcMain.handle('app:quit', (event) => {
    if (fromOurWindow(event)) app.quit();
  });

  ipcMain.handle('app:power-off', (event) => {
    if (fromOurWindow(event)) powerOff();
  });
}

// Compila la interfaz (dist) con Vite antes de abrir la ventana. Si falla y no
// hay una compilación anterior, no hay nada que mostrar: se avisa y se sale.
async function buildUi() {
  try {
    const { build } = await import('vite');
    await build({ root: ROOT, logLevel: 'error' });
  } catch (error) {
    if (!existsSync(join(DIST, 'index.html'))) {
      dialog.showErrorBox('PS3 Reimagined', `No se ha podido compilar la interfaz:\n\n${error.message}`);
      powerOff();
    }
  }
}

function createWindow() {
  const capture = process.env.XMB_CAPTURE; // sólo pruebas: captura sin mostrar nada
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    fullscreen: !capture,
    show: false,
    backgroundColor: '#000000',
    title: 'PS3 Reimagined',
    icon: ICON,
    autoHideMenuBar: true,
    ...(capture ? { opacity: 0, focusable: false, skipTaskbar: true } : {}),
    webPreferences: {
      preload: join(here, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required', // el arranque suena sin pantalla de «pulsa una tecla»
    },
  });

  const home = DEV_URL ?? APP_URL;
  win.loadURL(home);
  win.once('ready-to-show', () => (capture ? win.showInactive() : win.show()));

  // Nada de navegar fuera de la interfaz; los enlaces externos, al navegador del sistema.
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(home)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.control && input.code === 'KeyQ') {
      powerOff();
    } else if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12' && DEV_URL) {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  win.on('closed', () => {
    watcher?.stop();
    win = null;
  });

  if (capture) import('./devCapture.js').then((m) => m.runCapture(win, capture));
}

app.on('second-instance', () => bringBack());
app.on('window-all-closed', () => app.quit());

app.whenReady().then(async () => {
  if (!isPrimary) return;
  if (BUILD_ON_START && !DEV_URL) await buildUi();
  Menu.setApplicationMenu(null);
  registerProtocols();
  registerIpc();
  libraryReady = refreshLibrary().catch(() => (library = []));
  createWindow();
});

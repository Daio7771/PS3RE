import '@fontsource-variable/m-plus-1';
import './ui/base.css';
import './ui/xmb.css';
import './ui/boot.css';
import './ui/launch.css';

import { getConfig, onConfigChange } from './config/config.js';
import { createBackground } from './xmb/background.js';
import { buildMenu, buildGameItems, firstGameIndex } from './xmb/menu.js';
import { createNavigation } from './xmb/navigation.js';
import { createInput } from './xmb/input/input.js';
import { createSoundEffects } from './xmb/audio/audio.js';
import { soundForChange } from './xmb/audio/feedback.js';
import { createInfoSources } from './xmb/info/sources.js';
import { loadLibrary } from './launcher/library.js';
import { installIconSprite } from './ui/icons.js';
import { createXmbView } from './ui/xmbView.js';
import { createLaunchView } from './ui/launchView.js';
import { createBoot } from './ui/boot.js';
import { createClock } from './ui/clock.js';
import { createFpsMeter } from './ui/fpsMeter.js';
import { installDevHotkeys } from './ui/devHotkeys.js';

// Sólo existe en la app de escritorio (electron/preload.cjs); en el navegador
// el XMB funciona igual, con juegos de demostración que no lanzan nada.
const launcher = window.launcher ?? null;

// El color base también vive en CSS (fondo inicial y alternativa sin WebGL).
const applyBaseColor = (hex) => document.documentElement.style.setProperty('--xmb-base', hex);
applyBaseColor(getConfig('backgroundColor'));
onConfigChange('backgroundColor', applyBaseColor);

// El shader se compila ya; si hay arranque, no se dibuja hasta que empiece.
const background = createBackground(document.getElementById('xmb-background'));
const bootEnabled = getConfig('bootSequence');
if (bootEnabled) background?.setPaused(true);

const sfx = createSoundEffects({ autoplay: Boolean(launcher) });

// La biblioteca se carga mientras corre el arranque; el XMB no entra hasta tenerla.
const libraryReady = loadLibrary();

let bootSound = null;
const boot = createBoot({
  overlay: document.getElementById('boot'),
  enabled: bootEnabled,
  autoStart: Boolean(launcher), // en la app el audio no necesita gesto previo
  ready: libraryReady,
  onStart() {
    background?.setPaused(false);
    bootSound = sfx.play('boot');
  },
  onSkip() {
    bootSound?.stop();
  },
});

const library = await libraryReady;
const menu = buildMenu(library);

installIconSprite();
const gameColumn = menu.findIndex((c) => c.id === 'juego');
const navigation = createNavigation(menu, {
  category: gameColumn,
  items: { [gameColumn]: firstGameIndex(menu[gameColumn].items) },
});
createXmbView(document.getElementById('xmb'), menu, navigation, {
  infoSources: createInfoSources({ background, sfx }),
});

// ── Lanzamiento de juegos ──

const launchView = createLaunchView(document.getElementById('launch'), {
  onCancel() {
    launcher?.cancel();
    launchView.hide();
    sfx.play('back');
  },
});

async function launchGame(game) {
  launchView.show(game);
  const result = await launcher.launch(game.id);
  if (!result?.ok) {
    launchView.setState('failed', result?.error);
    sfx.play('error');
  }
}

// El proceso principal avisa cuando el juego arranca (y minimiza la app),
// cuando se cierra (y la vuelve a traer al frente) y si falla al empezar.
launcher?.onGameState(({ state, error }) => {
  if (!launchView.active) return;
  if (state === 'running') launchView.setState('running');
  else if (state === 'exited') launchView.hide();
  else if (state === 'failed') {
    launchView.setState('failed', error);
    sfx.play('error');
  }
});

// ── Juegos añadidos a mano ──

// Mientras está abierto el selector de archivos (o se guarda la lista), el
// XMB no atiende al mando: seguiría moviéndose por detrás.
let busy = false;

/** Rehace la columna «Juego» con la biblioteca nueva y selecciona `selectId` (o se queda cerca). */
function refreshGames(games, selectId) {
  const items = buildGameItems({ mode: library.mode, games });
  let index = selectId ? items.findIndex((item) => item.id === selectId) : -1;
  if (index < 0) index = Math.min(navigation.state.items[gameColumn], items.length - 1);
  // Nunca se queda en «Añadir juego» si hay algo debajo.
  if (items[index]?.action === 'add-game') index = firstGameIndex(items);
  navigation.replaceItems(gameColumn, items, index);
}

async function runBusy(task) {
  if (busy) return;
  busy = true;
  try {
    await task();
  } catch {
    sfx.play('error');
  } finally {
    busy = false;
  }
}

const addGame = () =>
  runBusy(async () => {
    const result = await launcher.addGame();
    if (result?.ok) refreshGames(result.games, result.id);
    else if (!result?.canceled) sfx.play('error');
  });

const removeGame = (id) =>
  runBusy(async () => {
    const result = await launcher.removeGame(id);
    if (result?.ok) refreshGames(result.games, null);
    else sfx.play('error');
  });

navigation.onChange((_, change) => {
  const sound = soundForChange(change);
  if (sound) sfx.play(sound);
  // Enlaces (Información → Abrir en GitHub): fuera de la app, sin acceso a ella.
  if (change.type === 'link') window.open(change.href, '_blank', 'noopener,noreferrer');
  if (change.type === 'launch' && launcher) launchGame(change.item.game);
  if (change.type === 'action' && change.action === 'quit') launcher?.quit();
  if (change.type === 'action' && change.action === 'add-game' && launcher) addGame();
  if (change.type === 'action' && change.action === 'remove-game' && launcher) removeGame(change.entry.gameId);
});

createInput((action) => {
  // Select+Start: apaga la consola al instante, esté donde esté (Ctrl+Q lo
  // atiende directamente el proceso principal).
  if (action === 'power') {
    launcher?.powerOff();
    return;
  }
  if (boot.active) {
    boot.handleAction(action);
    return;
  }
  if (launchView.active) {
    launchView.handleAction(action);
    return;
  }
  if (busy) return;
  // Confirmar algo que no hace nada (relleno, entrada desactivada) suena a error.
  if (!navigation.handle(action) && action === 'confirm') sfx.play('error');
});

createClock(document.getElementById('clock'));

const fpsMeter = background && createFpsMeter(document.getElementById('fps-meter'), background);
installDevHotkeys({ fpsMeter });

if (import.meta.env.DEV) window.__xmb = { background, navigation, sfx, boot, launchView, library };

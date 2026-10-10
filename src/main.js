import '@fontsource-variable/m-plus-1';
import './ui/base.css';
import './ui/xmb.css';
import './ui/boot.css';
import './ui/launch.css';

import { getConfig, onConfigChange } from './config/config.js';
import { createBackground } from './xmb/background.js';
import { buildMenu } from './xmb/menu.js';
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
const navigation = createNavigation(menu, { category: menu.findIndex((c) => c.id === 'juego') });
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

// El proceso principal avisa cuando el juego arranca (y minimiza la app) y
// cuando se cierra (y la vuelve a traer al frente).
launcher?.onGameState(({ state }) => {
  if (!launchView.active) return;
  if (state === 'running') launchView.setState('running');
  else if (state === 'exited') launchView.hide();
});

navigation.onChange((_, change) => {
  const sound = soundForChange(change);
  if (sound) sfx.play(sound);
  // Enlaces (Información → Abrir en GitHub): fuera de la app, sin acceso a ella.
  if (change.type === 'link') window.open(change.href, '_blank', 'noopener,noreferrer');
  if (change.type === 'launch' && launcher) launchGame(change.item.game);
  if (change.type === 'action' && change.action === 'quit') launcher?.quit();
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
  // Confirmar algo que no hace nada (relleno, entrada desactivada) suena a error.
  if (!navigation.handle(action) && action === 'confirm') sfx.play('error');
});

createClock(document.getElementById('clock'));

const fpsMeter = background && createFpsMeter(document.getElementById('fps-meter'), background);
installDevHotkeys({ fpsMeter });

if (import.meta.env.DEV) window.__xmb = { background, navigation, sfx, boot, launchView, library };

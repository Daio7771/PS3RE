// Secuencia de arranque:
//   pantalla de encendido («Pulsa cualquier tecla o botón»)
//   → sonido + línea de luz → título y subtítulo → el fondo se revela
//   → el XMB entra en escena.
// La pantalla de encendido existe porque el navegador no deja sonar audio
// sin un gesto previo. Pulsar durante la secuencia la salta.
//
// Estados en <html>: .boot-pending oculta la interfaz; .boot-entering lanza
// las animaciones de entrada (ver boot.css).

// title y reveal coinciden con HIT y FADE del sonido `boot` (xmb/audio/sounds.js).
const TIMELINE = {
  light: 250, // la línea de luz se abre
  title: 1500, // golpe del sonido: aparece «PS3 Reimagined»
  subtitle: 2100, // aparece «by Daio7771»
  reveal: 4300, // el texto se va, el negro se disuelve y aparece el fondo
  enter: 5300, // entra el XMB
  done: 6600, // fin: se libera la entrada
};
const SKIP_GUARD_MS = 400; // la misma pulsación que arranca no debe saltar
const SKIP_FADE_MS = 260;

/**
 * enabled   false → sin secuencia: el XMB aparece directamente.
 * autoStart true  → sin pantalla de encendido (en la app el audio no necesita gesto).
 * ready     promesa que debe cumplirse antes de que entre el XMB (p. ej. la biblioteca).
 */
export function createBoot({ overlay, enabled, autoStart = false, ready = null, onStart, onSkip }) {
  const root = document.documentElement;
  const timers = [];
  let phase = 'gate'; // gate → running → done
  let startedAt = 0;
  let resolveDone;
  const done = new Promise((resolve) => (resolveDone = resolve));

  const at = (ms, fn) => timers.push(setTimeout(fn, ms));

  function finish({ skipped = false } = {}) {
    if (phase === 'done') return;
    phase = 'done';
    timers.forEach(clearTimeout);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('pointerdown', trigger);
    root.classList.remove('boot-pending', 'boot-entering');
    if (skipped) {
      onSkip?.();
      overlay.classList.add('is-skipping');
      setTimeout(() => (overlay.hidden = true), SKIP_FADE_MS);
    } else {
      overlay.hidden = true;
    }
    resolveDone();
  }

  function start() {
    phase = 'running';
    startedAt = performance.now();
    overlay.classList.add('is-starting');
    onStart();
    at(TIMELINE.light, () => overlay.classList.add('is-light'));
    at(TIMELINE.title, () => overlay.classList.add('is-title'));
    at(TIMELINE.subtitle, () => overlay.classList.add('is-subtitle'));
    at(TIMELINE.reveal, () => overlay.classList.add('is-revealing'));
    at(TIMELINE.enter, async () => {
      await ready;
      if (phase !== 'running') return;
      root.classList.remove('boot-pending');
      root.classList.add('boot-entering');
      at(TIMELINE.done - TIMELINE.enter, () => finish());
    });
  }

  function trigger() {
    if (phase === 'gate') start();
    else if (phase === 'running' && performance.now() - startedAt > SKIP_GUARD_MS) {
      finish({ skipped: true });
    }
  }

  function onKey(event) {
    if (!event.repeat) trigger();
  }

  window.addEventListener('keydown', onKey);
  window.addEventListener('pointerdown', trigger);

  if (!enabled) finish();
  else if (autoStart) start();

  return {
    /** Se resuelve cuando el XMB ya acepta entrada. */
    done,
    get active() {
      return phase !== 'done';
    },
    /**
     * Acciones del mando/teclado mientras dura el arranque. En la pantalla de
     * encendido arranca cualquiera; durante la secuencia sólo confirmar o
     * volver la saltan (las direcciones repiten al mantenerlas).
     */
    handleAction(action) {
      if (phase === 'gate' || action === 'confirm' || action === 'back') trigger();
    },
  };
}

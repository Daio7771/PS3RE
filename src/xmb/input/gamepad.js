// Mando (Gamepad API, mapeo "standard"). Se sondea con requestAnimationFrame
// sólo mientras haya algún mando conectado y la pestaña esté visible.
// Ojo: Chromium no expone el mando hasta que se pulsa un botón en la página.
const BUTTONS = [
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
  [0, 'confirm'], // botón inferior
  [1, 'back'], // botón derecho
  [3, 'options'], // botón superior
];

// Select + Start a la vez (Share + Options, Vista + Menú): apagado instantáneo.
const POWER_COMBO = [8, 9];

export function attachGamepad({ press, release }, { stickPress, stickRelease }) {
  const active = new Map(); // fuente → acción pulsada
  const stickDir = new Map(); // índice de mando → dirección actual del stick
  let rafId = 0;
  let polling = false;

  function set(source, action, down) {
    const current = active.get(source);
    if (current === (down ? action : undefined)) return;
    if (current) release(current, source);
    if (down) {
      active.set(source, action);
      press(action, source);
    } else {
      active.delete(source);
    }
  }

  // Dirección dominante del stick izquierdo, con histéresis.
  function readStick(prev, x, y) {
    if (prev) {
      const along = { left: -x, right: x, up: -y, down: y }[prev];
      if (along > stickRelease) return prev;
    }
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (Math.max(ax, ay) < stickPress) return null;
    if (ax > ay) return x < 0 ? 'left' : 'right';
    return y < 0 ? 'up' : 'down';
  }

  function poll() {
    rafId = requestAnimationFrame(poll);
    for (const pad of navigator.getGamepads()) {
      if (!pad || !pad.connected) continue;
      for (const [index, action] of BUTTONS) {
        set(`pad${pad.index}:b${index}`, action, Boolean(pad.buttons[index]?.pressed));
      }
      const dir = readStick(stickDir.get(pad.index), pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      stickDir.set(pad.index, dir);
      set(`pad${pad.index}:stick`, dir, dir !== null);
      const combo = POWER_COMBO.every((i) => pad.buttons[i]?.pressed);
      set(`pad${pad.index}:power`, 'power', combo);
    }
  }

  function releasePad(prefix = '') {
    for (const [source, action] of active) {
      if (source.startsWith(prefix)) {
        release(action, source);
        active.delete(source);
      }
    }
  }

  function anyConnected() {
    return [...navigator.getGamepads()].some((pad) => pad?.connected);
  }

  function sync() {
    const shouldPoll = !document.hidden && anyConnected();
    if (shouldPoll === polling) return;
    polling = shouldPoll;
    if (polling) {
      rafId = requestAnimationFrame(poll);
    } else {
      cancelAnimationFrame(rafId);
      releasePad();
      stickDir.clear();
    }
  }

  window.addEventListener('gamepadconnected', sync);
  window.addEventListener('gamepaddisconnected', (event) => {
    releasePad(`pad${event.gamepad.index}:`);
    stickDir.delete(event.gamepad.index);
    sync();
  });
  document.addEventListener('visibilitychange', sync);
  sync();
}

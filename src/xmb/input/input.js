// Entrada unificada: teclado y mando producen las mismas acciones
// (up, down, left, right, confirm, back, options) con la misma repetición.
import { INPUT } from '../../config/input.js';
import { createRepeater } from './repeater.js';
import { attachKeyboard } from './keyboard.js';
import { attachGamepad } from './gamepad.js';

const REPEATABLE = new Set(['up', 'down', 'left', 'right']);

export function createInput(onAction) {
  const repeater = createRepeater({
    delay: INPUT.repeatDelay,
    interval: INPUT.repeatInterval,
    repeatable: REPEATABLE,
    onFire: onAction,
  });

  attachKeyboard(repeater);
  attachGamepad(repeater, INPUT);

  // Si se pierde el foco no llegan los keyup: no dejar nada "atascado".
  window.addEventListener('blur', repeater.releaseAll);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) repeater.releaseAll();
  });
}

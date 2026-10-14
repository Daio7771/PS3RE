// Teclado → acciones. Se usa `event.code` (posición física), así que funciona
// igual con distribución española o inglesa.
const KEYMAP = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  Escape: 'back',
  Backspace: 'back',
  KeyT: 'options', // △ (T de «triángulo»)
  ContextMenu: 'options',
};

export function attachKeyboard({ press, release }) {
  window.addEventListener('keydown', (event) => {
    const action = KEYMAP[event.code];
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    if (event.repeat) return; // la repetición la gestiona el repeater
    press(action, `key:${event.code}`);
  });

  window.addEventListener('keyup', (event) => {
    const action = KEYMAP[event.code];
    if (action) release(action, `key:${event.code}`);
  });
}

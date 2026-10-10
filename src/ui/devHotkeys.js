// Atajos de depuración:
//   F → medidor de fps
export function installDevHotkeys({ fpsMeter }) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'KeyF' && fpsMeter) fpsMeter.toggle();
  });
}

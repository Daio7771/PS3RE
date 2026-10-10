// Fuente de datos de un panel informativo.
// `run(render, signal)` pinta filas [etiqueta, valor] con render() tantas
// veces como quiera (datos asíncronos, medidas, relojes…) y cuelga sus
// temporizadores y escuchas de `signal`, que se aborta al cerrar el panel.
export function infoSource(title, run) {
  let controller = null;
  return {
    title,
    start(onChange) {
      this.stop();
      controller = new AbortController();
      const { signal } = controller;
      run((rows) => {
        if (!signal.aborted) onChange(rows);
      }, signal);
    },
    stop() {
      controller?.abort();
      controller = null;
    },
  };
}

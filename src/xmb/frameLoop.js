// Bucle de dibujo con tope de fps independiente de la frecuencia del monitor.
// requestAnimationFrame sigue disparando a la frecuencia nativa (p. ej. 200 Hz),
// pero `onFrame` sólo se ejecuta cuando ha pasado el intervalo objetivo.
// El ancla avanza en múltiplos exactos del intervalo, así que la media es de
// `fps` aunque el monitor no sea múltiplo (200 Hz → pasos de 15/20 ms).

const TOLERANCE_MS = 1; // absorbe la variación de los timestamps de vsync
const MAX_DT_MS = 100; // evita saltos tras un bloqueo largo

export function createFrameLoop(fps, onFrame) {
  const interval = 1000 / fps;
  let rafId = 0;
  let running = false;
  let anchor = 0;
  let lastFrame = 0;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    if (now - anchor < interval - TOLERANCE_MS) return;
    anchor += interval;
    if (now - anchor > interval) anchor = now; // nos hemos quedado atrás: re-sincroniza
    const dt = Math.min(now - lastFrame, MAX_DT_MS) / 1000;
    lastFrame = now;
    onFrame(dt, now);
  }

  return {
    start() {
      if (running) return;
      running = true;
      const now = performance.now();
      anchor = now - interval; // el primer tick dibuja de inmediato
      lastFrame = now;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    get running() {
      return running;
    },
  };
}

// Medidor de depuración: fotogramas del fondo por segundo frente a la
// frecuencia real de requestAnimationFrame (la del monitor).
export function createFpsMeter(root, background) {
  let rafId = 0;
  let windowStart = 0;
  let framesAtStart = 0;
  let ticks = 0;

  function reset(now) {
    windowStart = now;
    framesAtStart = background.frames;
    ticks = 0;
  }

  function loop(now) {
    rafId = requestAnimationFrame(loop);
    const elapsed = now - windowStart;
    if (elapsed > 2000) return reset(now); // vuelta de pestaña oculta
    ticks++;
    if (elapsed < 1000) return;
    const bgFps = ((background.frames - framesAtStart) * 1000) / elapsed;
    const hz = (ticks * 1000) / elapsed;
    root.textContent = `Fondo ${bgFps.toFixed(0)} fps · Pantalla ${hz.toFixed(0)} Hz`;
    reset(now);
  }

  return {
    toggle() {
      const show = root.hidden;
      root.hidden = !show;
      cancelAnimationFrame(rafId);
      if (show) {
        root.textContent = 'Midiendo…';
        reset(performance.now());
        rafId = requestAnimationFrame(loop);
      }
    },
  };
}

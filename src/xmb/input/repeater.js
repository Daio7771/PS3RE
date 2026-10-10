// Pulsar y mantener: dispara al pulsar y, en las acciones repetibles, repite
// tras un retardo. Varias fuentes (tecla, botón, stick) pueden sostener la
// misma acción; se suelta cuando la suelta la última. La última dirección
// pulsada es la única que repite.
export function createRepeater({ delay, interval, repeatable, onFire }) {
  const held = new Map(); // acción → { sources: Set, timer }

  function stopRepeating(except) {
    for (const [action, entry] of held) {
      if (action !== except) clearTimeout(entry.timer);
    }
  }

  function press(action, source) {
    const existing = held.get(action);
    if (existing) {
      existing.sources.add(source);
      return;
    }
    const entry = { sources: new Set([source]), timer: 0 };
    held.set(action, entry);
    onFire(action);
    if (!repeatable.has(action)) return;
    stopRepeating(action);
    const repeat = () => {
      onFire(action);
      entry.timer = setTimeout(repeat, interval);
    };
    entry.timer = setTimeout(repeat, delay);
  }

  function release(action, source) {
    const entry = held.get(action);
    if (!entry) return;
    entry.sources.delete(source);
    if (entry.sources.size > 0) return;
    clearTimeout(entry.timer);
    held.delete(action);
  }

  function releaseAll() {
    for (const entry of held.values()) clearTimeout(entry.timer);
    held.clear();
  }

  return { press, release, releaseAll };
}

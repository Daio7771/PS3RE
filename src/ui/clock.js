// Reloj y fecha de la esquina superior derecha (DD/MM HH:MM, 24 h).
// Se actualiza en el cambio de minuto y se detiene con la pestaña oculta.
const pad = (n) => String(n).padStart(2, '0');

export function createClock(root) {
  const dateEl = document.createElement('span');
  dateEl.className = 'clock__date';
  const timeEl = document.createElement('span');
  timeEl.className = 'clock__time';
  root.append(dateEl, timeEl);

  let timer = 0;

  function render() {
    const now = new Date();
    const dd = pad(now.getDate());
    const mm = pad(now.getMonth() + 1);
    const hh = pad(now.getHours());
    const mi = pad(now.getMinutes());
    dateEl.textContent = `${dd}/${mm}`;
    timeEl.textContent = `${hh}:${mi}`;
    root.dateTime = `${now.getFullYear()}-${mm}-${dd}T${hh}:${mi}`;
  }

  function tick() {
    render();
    clearTimeout(timer);
    const now = new Date();
    const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    timer = setTimeout(tick, msToNextMinute + 20);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearTimeout(timer);
    else tick();
  });

  tick();
}

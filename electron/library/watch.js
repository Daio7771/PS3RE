// Vigila un juego recién lanzado: avisa cuando arranca y cuando se cierra.
//   · Steam: valor RunningAppID del registro (lo mantiene Steam).
//   · EA / Ubisoft: si alguno de los ejecutables de su carpeta está en marcha.
// Sondea cada 2 s con herramientas ligeras (reg / tasklist), sin PowerShell.
import { steamRunningAppId } from './steam.js';
import { runningExecutables } from './windows.js';

const POLL_MS = 2000;

async function isRunning(game) {
  if (game.watch.steamAppId) return (await steamRunningAppId()) === game.watch.steamAppId;
  const exes = game.watch.executables ?? [];
  if (!exes.length) return false;
  const running = await runningExecutables();
  return exes.some((exe) => running.has(exe));
}

export function watchGame(game, { onRunning, onExit }) {
  let stopped = false;
  let running = false;
  let timer = 0;

  async function check() {
    if (stopped) return;
    let now = false;
    try {
      now = await isRunning(game);
    } catch {
      // fallo puntual de la consulta: se reintenta en el siguiente ciclo
    }
    if (stopped) return;
    if (now && !running) {
      running = true;
      onRunning();
    } else if (!now && running) {
      stopped = true;
      onExit();
      return;
    }
    timer = setTimeout(check, POLL_MS);
  }

  timer = setTimeout(check, POLL_MS);
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

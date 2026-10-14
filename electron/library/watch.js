// Vigila un juego recién lanzado: avisa cuando arranca y cuando se cierra.
//   · Steam: Windows, valor RunningAppID del registro; Linux, su proceso
//     «reaper» (con registry.vdf de respaldo).
//   · Por nombre de proceso: EA / Ubisoft en Windows y los juegos añadidos a
//     mano que lo indiquen («process» en games.json).
//   · Juegos añadidos a mano: el proceso lanzado y todo lo que abra (su
//     sesión en Linux; el propio proceso en Windows).
// Sondea cada 2 s con herramientas ligeras (/proc, reg, tasklist), sin PowerShell.
//
// Si lo lanzado termina enseguida, puede ser que haya fallado (código de
// error) o que haya pasado el juego a otro programa (Heroic, Lutris…) y ya no
// se pueda seguir: entonces se avisa con onHandoff y no se trae la app de vuelta.
import { IS_WINDOWS } from './platform.js';
import { steamRunningProbe } from './steam.js';
import { runningExecutables as windowsExecutables } from './windows.js';
import { runningExecutables as linuxExecutables, sessionAlive } from './linux.js';
import { exitMessage, failedExit } from './launch.js';

const POLL_MS = 2000;
// Cerrarse antes de esto cuenta como «terminó enseguida».
const QUICK_EXIT_MS = 8000;

const runningExecutables = IS_WINDOWS ? windowsExecutables : linuxExecutables;

/** Función que dice si el juego está en marcha; null si no hay forma de saberlo. */
function probeFor(game, handle) {
  const { watch } = game;
  if (watch.steamAppId) return { external: true, probe: steamRunningProbe(watch.steamAppId) };
  const exes = watch.executables ?? [];
  if (exes.length) {
    return {
      external: true,
      async probe() {
        const running = await runningExecutables();
        return exes.some((exe) => running.has(exe));
      },
    };
  }
  if (watch.spawned && handle?.pid) {
    return {
      external: false,
      probe: IS_WINDOWS ? async () => !handle.exited : () => sessionAlive(handle.pid),
    };
  }
  return { external: false, probe: null };
}

/**
 * `handle` es el proceso lanzado (launch.js) o null.
 * Avisos: onRunning(), onExit(), onHandoff(), onFailed(mensaje).
 */
export function watchGame(game, handle, { onRunning, onExit, onHandoff, onFailed }) {
  const { external, probe } = probeFor(game, handle);
  const startedAt = Date.now();
  let stopped = false;
  let running = false;
  let timer = 0;

  function finish(callback, ...args) {
    stopped = true;
    clearTimeout(timer);
    callback(...args);
  }

  async function check() {
    if (stopped) return;
    let now = false;
    try {
      now = probe ? await probe() : false;
    } catch {
      // fallo puntual de la consulta: se reintenta en el siguiente ciclo
    }
    if (stopped) return;
    const quick = Date.now() - startedAt < QUICK_EXIT_MS;

    if (now && !running) {
      running = true;
      onRunning();
    } else if (!now && running) {
      // Se ha cerrado. Si era un proceso propio y ha durado nada, o falló o
      // pasó el juego a otro programa.
      if (!external && quick) {
        if (failedExit(handle)) return finish(onFailed, exitMessage(handle));
        return finish(onHandoff);
      }
      return finish(onExit);
    } else if (!now && !running) {
      // Todavía no se ha visto en marcha.
      if (failedExit(handle) && quick) return finish(onFailed, exitMessage(handle));
      if (!probe) return finish(onHandoff); // nada que vigilar
      if (!external) return failedExit(handle) ? finish(onFailed, exitMessage(handle)) : finish(onHandoff);
      // Steam o un proceso con nombre: se sigue esperando (se puede cancelar).
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

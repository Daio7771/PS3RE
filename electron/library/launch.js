// Lanza un juego según cómo se abre:
//   · URI (steam://, heroic://…): con xdg-open en Linux; con el sistema en Windows.
//   · Programa (juegos añadidos a mano): proceso propio, en su propia sesión
//     para poder seguirlo a él y a todo lo que abra.
//   · Archivo (accesos directos de Windows que no apuntan a un .exe).
// Devuelve el proceso lanzado ({ pid, kind, exited, exitCode, signal }) o
// null si lo abre otro programa y no hay nada propio que seguir.
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { shell } from 'electron';
import { IS_LINUX, hostEnv } from './platform.js';

/** Error con un mensaje pensado para enseñárselo al usuario tal cual. */
export class LaunchError extends Error {}

function spawnMessage(error) {
  switch (error?.code) {
    case 'ENOENT':
      return 'No se encuentra el programa del juego. ¿Se ha movido o desinstalado?';
    case 'EACCES':
    case 'EPERM':
      return 'No hay permiso para ejecutar el programa del juego.';
    case 'ENOEXEC':
      return 'Ese archivo no es un programa que se pueda ejecutar.';
    default:
      return 'No se ha podido iniciar el juego.';
  }
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

function spawnDetached(command, args, { cwd, env, kind }) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(command, args, { cwd, env: hostEnv(env), detached: true, stdio: 'ignore' });
    } catch (error) {
      reject(error);
      return;
    }
    const handle = { pid: 0, kind, exited: false, exitCode: null, signal: null };
    // `on` y no `once`: un segundo error sin oyente tumbaría el proceso principal.
    child.on('error', (error) => {
      if (!handle.pid) reject(error); // no llegó a arrancar
    });
    child.once('spawn', () => {
      handle.pid = child.pid;
      child.unref(); // la app puede cerrarse sin esperar al juego
      resolve(handle);
    });
    child.once('exit', (code, signal) => {
      handle.exited = true;
      handle.exitCode = code;
      handle.signal = signal;
    });
  });
}

async function openUri(uri) {
  if (IS_LINUX) {
    try {
      return await spawnDetached('xdg-open', [uri], { cwd: homedir(), kind: 'uri' });
    } catch {
      // sin xdg-open: lo intenta Electron
    }
  }
  try {
    await shell.openExternal(uri);
  } catch {
    throw new LaunchError('No se ha podido abrir su lanzador');
  }
  return null;
}

export async function launchGame(game) {
  const { launch } = game;
  if (launch.uri) return openUri(launch.uri);
  if (launch.open) {
    const error = await shell.openPath(launch.open);
    if (error) throw new LaunchError('No se ha podido abrir el acceso directo del juego.');
    return null;
  }
  const cwd = launch.cwd && (await isDirectory(launch.cwd)) ? launch.cwd : homedir();
  try {
    return await spawnDetached(launch.command, launch.args ?? [], { cwd, env: launch.env, kind: 'command' });
  } catch (error) {
    throw new LaunchError(spawnMessage(error));
  }
}

/** Mensaje para un proceso lanzado que ha terminado mal nada más empezar. */
export function exitMessage(handle) {
  if (handle.kind === 'uri') return 'No hay ningún programa que sepa abrir este juego';
  const detail = handle.exitCode !== null ? `código ${handle.exitCode}` : handle.signal;
  return `El juego se ha cerrado nada más abrirse (${detail})`;
}

/** ¿El proceso lanzado ha terminado con error? */
export const failedExit = (handle) => Boolean(handle?.exited) && handle.exitCode !== 0;

// Acceso de sólo lectura a Linux: procesos en marcha (/proc) y nombre de la
// distribución (/etc/os-release). Sin programas externos: todo son lecturas
// de archivos, baratas aunque se repitan cada 2 s.
import { readdir, readFile } from 'node:fs/promises';

// Lecturas simultáneas como máximo: /proc puede tener cientos de procesos y
// no hace falta saturar el pool de hilos de libuv para leerlos.
const BATCH = 64;

/**
 * Datos de un proceso: { pid, ppid, session, state, name, argv }.
 *   · name: nombre corto del kernel (comm, máx. 15 caracteres).
 *   · argv: línea de órdenes completa ([] en hilos del kernel).
 * null si el proceso ya no existe o no se puede leer.
 */
async function readProcess(pid) {
  try {
    const [stat, cmdline] = await Promise.all([
      readFile(`/proc/${pid}/stat`, 'utf8'),
      readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => ''),
    ]);
    // «pid (nombre) estado ppid pgrp sesión …»: el nombre puede llevar
    // espacios y paréntesis, así que se corta por el último «)».
    const open = stat.indexOf('(');
    const close = stat.lastIndexOf(')');
    if (open < 0 || close < open) return null;
    const fields = stat.slice(close + 2).split(' ');
    return {
      pid: Number(pid),
      ppid: Number(fields[1]),
      session: Number(fields[3]),
      state: fields[0],
      name: stat.slice(open + 1, close),
      argv: cmdline.split('\0').filter(Boolean),
    };
  } catch {
    return null;
  }
}

/** Procesos vivos (sin zombis) que se pueden leer. */
export async function listProcesses() {
  let entries;
  try {
    entries = await readdir('/proc');
  } catch {
    return [];
  }
  const pids = entries.filter((entry) => /^\d+$/.test(entry));
  const processes = [];
  for (let i = 0; i < pids.length; i += BATCH) {
    const batch = await Promise.all(pids.slice(i, i + BATCH).map(readProcess));
    for (const proc of batch) {
      if (proc && proc.state !== 'Z' && proc.state !== 'X') processes.push(proc);
    }
  }
  return processes;
}

/** Último componente de una ruta, con «/» o «\» (programas de Wine/Proton). */
export const baseName = (path) => path.split(/[\\/]/).pop() ?? '';

/** Nombres (en minúsculas) con los que se puede reconocer un proceso. */
export function processNames(proc) {
  const names = new Set([proc.name.toLowerCase()]);
  if (proc.argv[0]) names.add(baseName(proc.argv[0]).toLowerCase());
  return names;
}

/** Nombres (en minúsculas) de los programas en marcha. */
export async function runningExecutables() {
  const names = new Set();
  for (const proc of await listProcesses()) {
    for (const name of processNames(proc)) names.add(name);
  }
  return names;
}

/** ¿Sigue vivo algún proceso de la sesión `sid`? (el juego y lo que haya abierto) */
export async function sessionAlive(sid) {
  return (await listProcesses()).some((proc) => proc.session === sid);
}

/** Nombre de la distribución («Ubuntu 24.04.1 LTS», «Arch Linux»…); null si no se sabe. */
export async function distroName() {
  for (const file of ['/etc/os-release', '/usr/lib/os-release']) {
    try {
      const text = await readFile(file, 'utf8');
      const fields = {};
      for (const line of text.split('\n')) {
        const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
        if (match) fields[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2').replace(/\\(.)/g, '$1');
      }
      const name = fields.PRETTY_NAME || [fields.NAME, fields.VERSION].filter(Boolean).join(' ');
      if (name) return name;
    } catch {
      // se prueba el siguiente
    }
  }
  return null;
}

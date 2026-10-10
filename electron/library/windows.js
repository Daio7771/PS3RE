// Acceso de sólo lectura a Windows: registro, PowerShell y lista de procesos.
import { execFile } from 'node:child_process';

function run(file, args, { timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/** Valor de registro sencillo (cadena o DWORD) con `reg query`; null si no existe. */
export async function regValue(key, name) {
  try {
    const out = await run('reg', ['query', key, '/v', name], { timeout: 5000 });
    const match = new RegExp(`^\\s*${name}\\s+(REG_\\w+)\\s+(.*)$`, 'mi').exec(out);
    if (!match) return null;
    const [, type, raw] = match;
    return type === 'REG_DWORD' ? parseInt(raw, 16) : raw.trim();
  } catch {
    return null;
  }
}

/**
 * Ejecuta un script de PowerShell que escribe JSON y lo devuelve ya analizado.
 * Se fuerza UTF-8 para que nombres con tildes o «™» lleguen bien.
 */
export async function powershellJson(script) {
  const prelude = '[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ErrorActionPreference = "SilentlyContinue";';
  const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', prelude + script], {
    timeout: 30000,
  });
  const text = out.trim();
  return text ? JSON.parse(text) : null;
}

/** Nombres (en minúsculas) de los ejecutables en marcha, con `tasklist`. */
export async function runningExecutables() {
  const out = await run('tasklist', ['/FO', 'CSV', '/NH'], { timeout: 8000 });
  const names = new Set();
  for (const line of out.split(/\r?\n/)) {
    const match = /^"([^"]+)"/.exec(line);
    if (match) names.add(match[1].toLowerCase());
  }
  return names;
}

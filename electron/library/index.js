// Biblioteca unificada: Steam + juegos añadidos a mano en todas partes, y
// EA app + Ubisoft Connect en Windows (en Linux no tienen versión propia).
// Los datos internos (rutas, URIs de lanzamiento) se quedan en el proceso
// principal; a la interfaz sólo llega toPublic().
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { IS_WINDOWS } from './platform.js';
import { scanSteam } from './steam.js';
import { scanPublishers } from './publishers.js';
import { loadManualGames } from './manual.js';

export async function scanLibrary({ recent = {}, manualFile } = {}) {
  const scans = [scanSteam(), loadManualGames(manualFile)];
  if (IS_WINDOWS) scans.push(scanPublishers());
  const results = await Promise.allSettled(scans);
  const games = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  for (const game of games) game.lastPlayed = Math.max(game.lastPlayed, recent[game.id] ?? 0);
  // Lo último jugado primero; lo nunca jugado, por nombre.
  games.sort((a, b) => b.lastPlayed - a.lastPlayed || a.name.localeCompare(b.name, 'es'));
  return games;
}

export const ART_KINDS = ['header', 'hero', 'logo'];

const artUrl = (id, kind) => `xmb-art://art/${encodeURIComponent(id)}/${kind}`;

/** Datos seguros para la interfaz: sin rutas del disco ni URIs de lanzamiento. */
export function toPublic(game) {
  return {
    id: game.id,
    source: game.source,
    name: game.name,
    lastPlayed: game.lastPlayed,
    sizeOnDisk: game.sizeOnDisk,
    art: Object.fromEntries(ART_KINDS.map((kind) => [kind, game.art[kind] ? artUrl(game.id, kind) : null])),
  };
}

// ── Últimos lanzamientos desde el XMB (segundos Unix por id de juego) ──

export async function loadRecent(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return {};
  }
}

export async function saveRecent(file, recent) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(recent));
}

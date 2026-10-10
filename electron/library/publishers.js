// Bibliotecas de EA app y Ubisoft Connect, a partir del registro de Windows.
//   · EA: entradas de desinstalación de «Electronic Arts» cuyo directorio tiene
//     __Installer\installerdata.xml (de ahí salen el contentID y el título).
//     Se lanza con link2ea://, como hace la propia EA app (antitrampas incluido).
//   · Ubisoft: clave Launcher\Installs (id → carpeta); el nombre sale de su
//     entrada de desinstalación «Uplay Install <id>». Se lanza con uplay://.
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { powershellJson } from './windows.js';

const QUERY = `
$keys = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
        'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*',
        'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*';
$uninstall = @(Get-ItemProperty $keys | Where-Object { $_.Publisher -match 'Electronic Arts|Ubisoft' } |
  ForEach-Object { [pscustomobject]@{ key = $_.PSChildName; name = $_.DisplayName; publisher = $_.Publisher; dir = $_.InstallLocation } });
$ubisoft = @(Get-ChildItem 'HKLM:\\SOFTWARE\\WOW6432Node\\Ubisoft\\Launcher\\Installs' |
  ForEach-Object { [pscustomobject]@{ id = $_.PSChildName; dir = (Get-ItemProperty $_.PSPath).InstallDir } });
[pscustomobject]@{ uninstall = $uninstall; ubisoft = $ubisoft } | ConvertTo-Json -Depth 4 -Compress
`;

// Ejecutables auxiliares que no indican que el juego esté abierto.
const HELPER_EXE = /^(cleanup|touchup|unins|uninstall|crash|setup|installer|eaanticheat|easyanticheat|vc_?redist|dxsetup|ubisoftgamelauncher|upc)/i;

const list = (value) => (value == null ? [] : Array.isArray(value) ? value : [value]);

async function gameExecutables(dir) {
  try {
    return (await readdir(dir)).filter((f) => /\.exe$/i.test(f) && !HELPER_EXE.test(f)).map((f) => f.toLowerCase());
  } catch {
    return [];
  }
}

async function eaGame(entry) {
  let xml;
  try {
    xml = await readFile(join(entry.dir, '__Installer', 'installerdata.xml'), 'utf8');
  } catch {
    return null; // no es un juego de la EA app (o falta su ficha)
  }
  const contentId = /<contentID>([^<]+)<\/contentID>/i.exec(xml)?.[1]?.trim();
  if (!contentId) return null;
  const title =
    /<gameTitle locale="es_ES">([^<]+)</i.exec(xml)?.[1] ??
    /<gameTitle locale="en_US">([^<]+)</i.exec(xml)?.[1] ??
    entry.name;
  return {
    id: `ea:${contentId}`,
    source: 'ea',
    name: title.trim(),
    lastPlayed: 0,
    sizeOnDisk: 0,
    art: { header: null, hero: null, logo: null },
    launch: { uri: `link2ea://launchgame/${encodeURIComponent(contentId)}?platform=pcwin` },
    watch: { executables: await gameExecutables(entry.dir) },
  };
}

async function ubisoftGame({ id, dir }, uninstall) {
  if (!id || !dir) return null;
  const entry = uninstall.find((u) => u.key === `Uplay Install ${id}`);
  return {
    id: `ubisoft:${id}`,
    source: 'ubisoft',
    name: entry?.name || basename(dir.replace(/[\\/]+$/, '')),
    lastPlayed: 0,
    sizeOnDisk: 0,
    art: { header: null, hero: null, logo: null },
    launch: { uri: `uplay://launch/${encodeURIComponent(id)}/0` },
    watch: { executables: await gameExecutables(dir) },
  };
}

export async function scanPublishers() {
  let data;
  try {
    data = await powershellJson(QUERY);
  } catch {
    return [];
  }
  const uninstall = list(data?.uninstall).filter((u) => u?.dir);
  const ea = await Promise.all(
    uninstall.filter((u) => /Electronic Arts/i.test(u.publisher ?? '')).map(eaGame),
  );
  const ubisoft = await Promise.all(list(data?.ubisoft).map((u) => ubisoftGame(u, uninstall)));
  return [...ea, ...ubisoft].filter(Boolean);
}

// Sondas del navegador y del equipo para los paneles informativos.
// Todo es local: ninguna sonda hace peticiones fuera de este servidor.
import { version } from '../../../package.json';

export const APP_VERSION = version;

const MEASURE_MS = 1200;
const MIN_SAMPLES = 20;
const COMMON_RATES = [50, 60, 75, 90, 100, 120, 144, 165, 170, 175, 180, 200, 240, 280, 360];

const pad2 = (n) => String(n).padStart(2, '0');

export const number = (n, digits = 0) => n.toLocaleString('es-ES', { maximumFractionDigits: digits });
export const media = (query) => window.matchMedia(query).matches;

// ── Utilidades de ciclo de vida (se limpian al cerrar el panel) ──

export function listen(target, type, fn, signal) {
  target.addEventListener(type, fn, { signal });
}

export function every(ms, fn, signal) {
  const id = setInterval(fn, ms);
  signal.addEventListener('abort', () => clearInterval(id));
}

// ── Pantalla y vídeo ──

export function physical(w, h) {
  const dpr = window.devicePixelRatio || 1;
  return `${Math.round(w * dpr)} × ${Math.round(h * dpr)}`;
}

export function screenText() {
  return `${physical(screen.width, screen.height)} · escala ${Math.round((window.devicePixelRatio || 1) * 100)} %`;
}

/** Tamaño en píxeles reales del lienzo 16:9 donde se dibuja el XMB. */
export function uiCanvas() {
  const u = Math.min(innerHeight / 100, (innerWidth * 0.5625) / 100);
  return physical(u * 177.7778, u * 100);
}

export function colorGamut() {
  if (media('(color-gamut: rec2020)')) return 'Rec. 2020';
  if (media('(color-gamut: p3)')) return 'Display P3';
  return 'sRGB';
}

// Redondea a la frecuencia comercial más cercana si está a ±1,5 Hz.
export function snapRate(hz) {
  return COMMON_RATES.find((r) => Math.abs(r - hz) <= 1.5) ?? Math.round(hz);
}

/**
 * Mide la frecuencia real de requestAnimationFrame (la del monitor) y los fps
 * del fondo en la misma ventana. Devuelve null si no hay muestras suficientes.
 */
export function measureFrames(background, signal) {
  return new Promise((resolve) => {
    const deltas = [];
    let start = 0;
    let last = 0;
    let frames0 = 0;
    let id = 0;
    signal.addEventListener('abort', () => {
      cancelAnimationFrame(id);
      resolve(null);
    });
    function tick(now) {
      if (!start) {
        start = last = now;
        frames0 = background?.frames ?? 0;
      } else {
        deltas.push(now - last);
        last = now;
      }
      if (now - start < MEASURE_MS) {
        id = requestAnimationFrame(tick);
        return;
      }
      if (deltas.length < MIN_SAMPLES) return resolve(null);
      deltas.sort((a, b) => a - b);
      resolve({
        hz: 1000 / deltas[deltas.length >> 1],
        bgFps: background ? ((background.frames - frames0) * 1000) / (now - start) : null,
      });
    }
    id = requestAnimationFrame(tick);
  });
}

// «ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 (0x00002882) Direct3D11 vs_5_0 ps_5_0, D3D11)»
// → «NVIDIA GeForce RTX 4060»
export function cleanGpuName(renderer) {
  const angle = /^ANGLE \((.*)\)$/.exec(renderer);
  const device = angle ? (angle[1].split(', ')[1] ?? angle[1]) : renderer;
  return device
    .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
    .replace(/\/PCIe.*$/i, '')
    .replace(/\s+(Direct3D|vs_\d|ps_\d|OpenGL|Vulkan|Metal).*$/i, '')
    .trim();
}

export async function detectGpu(background) {
  const renderer = background?.gpuRenderer();
  if (renderer) return cleanGpuName(renderer);
  // Si WebGL lo oculta, WebGPU al menos da fabricante y arquitectura.
  try {
    const info = (await navigator.gpu?.requestAdapter())?.info;
    if (info?.vendor) return [info.vendor.toUpperCase(), info.architecture].filter(Boolean).join(' · ');
  } catch {
    // WebGPU no disponible
  }
  return 'No disponible (oculto por el navegador)';
}

/** Soporte de decodificación de un formato (Media Capabilities, con respaldo canPlayType). */
export async function decodeSupport(kind, contentType) {
  const config =
    kind === 'video'
      ? { type: 'file', video: { contentType, width: 1920, height: 1080, bitrate: 8_000_000, framerate: 60 } }
      : { type: 'file', audio: { contentType, channels: '2', bitrate: 256_000, samplerate: 48_000 } };
  try {
    const result = await navigator.mediaCapabilities.decodingInfo(config);
    if (!result.supported) return 'No compatible';
    if (kind === 'audio') return 'Compatible';
    return result.powerEfficient ? 'Compatible · por hardware' : 'Compatible · por software';
  } catch {
    const answer = document.createElement(kind).canPlayType(contentType);
    return answer ? 'Compatible' : 'No compatible';
  }
}

// ── Navegador y sistema ──

function osName(platform, platformVersion, architecture, bitness) {
  const arch = architecture === 'arm' ? 'ARM64' : bitness === '64' ? 'x64' : architecture || '';
  let name = platform || 'Desconocido';
  if (platform === 'Windows' && platformVersion) {
    name = Number(platformVersion.split('.')[0]) >= 13 ? 'Windows 11' : 'Windows 10';
  } else if (platformVersion) {
    name = `${platform} ${platformVersion}`;
  }
  return [name, arch].filter(Boolean).join(' · ');
}

export async function detectBrowser() {
  const uad = navigator.userAgentData;
  if (!uad) return { browser: navigator.userAgent.split(' ').pop(), os: navigator.platform };
  let brands = uad.brands;
  let os = osName(uad.platform);
  try {
    const hi = await uad.getHighEntropyValues(['fullVersionList', 'platformVersion', 'architecture', 'bitness']);
    brands = hi.fullVersionList ?? brands;
    os = osName(uad.platform, hi.platformVersion, hi.architecture, hi.bitness);
  } catch {
    // datos de alta entropía denegados: nos quedamos con los básicos
  }
  const real = brands.filter((b) => !/not.?a.?brand/i.test(b.brand));
  let pick = real.find((b) => b.brand !== 'Chromium') ?? real[0];
  if (pick?.brand === 'Chromium' && (await navigator.brave?.isBrave?.())) pick = { ...pick, brand: 'Brave' };
  return { browser: pick ? `${pick.brand} ${pick.version}` : 'Desconocido', os };
}

export async function isBrave() {
  try {
    return Boolean(await navigator.brave?.isBrave?.());
  } catch {
    return false;
  }
}

// ── Mandos y accesorios ──

export function connectedPads() {
  return [...navigator.getGamepads()].filter((pad) => pad?.connected);
}

export function padName(pad) {
  return pad.id.replace(/\s*\(.*\)\s*$/, '').trim() || `Mando ${pad.index + 1}`;
}

export function padsText() {
  const names = connectedPads().map(padName);
  return names.length ? names.join(' · ') : 'Ninguno conectado';
}

export async function keyboardLayout() {
  try {
    const map = await navigator.keyboard?.getLayoutMap();
    if (!map) return 'No disponible';
    const base = map.get('KeyQ') === 'a' ? 'AZERTY' : map.get('KeyZ') === 'y' ? 'QWERTZ' : 'QWERTY';
    return map.get('Semicolon') === 'ñ' ? `${base} · español` : base;
  } catch {
    return 'No disponible';
  }
}

// ── Audio ──

export function channelsText(count) {
  return { 1: 'Mono', 2: 'Estéreo', 6: '5.1', 8: '7.1' }[count] ?? `${count} canales`;
}

// ── Energía ──

export async function batteryText() {
  if (!navigator.getBattery) return 'No disponible (el navegador no la expone)';
  try {
    const b = await navigator.getBattery();
    if (b.charging && b.level === 1) return 'Conectado a la corriente';
    const pct = `${Math.round(b.level * 100)} %`;
    if (b.charging) return `${pct} · cargando`;
    const left = Number.isFinite(b.dischargingTime) ? ` · ${Math.round(b.dischargingTime / 60)} min restantes` : '';
    return `${pct} · con batería${left}`;
  } catch {
    return 'No disponible';
  }
}

// ── Fecha y hora ──

export function longDate(date) {
  const text = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function timeWithSeconds(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function utcOffset(date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? '+' : '−';
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function dstText(date) {
  const year = date.getFullYear();
  const jan = new Date(year, 0, 1).getTimezoneOffset();
  const jul = new Date(year, 6, 1).getTimezoneOffset();
  if (jan === jul) return 'No se aplica en esta zona';
  return date.getTimezoneOffset() === Math.min(jan, jul) ? 'Activo' : 'No activo';
}

export function dateTimeText(date) {
  return `${date.toLocaleDateString('es-ES')} ${timeWithSeconds(date)}`;
}

// ── Almacenamiento y red ──

export function bytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${number(n / 1024, 1)} kB`;
  return `${number(n / 1024 ** 2, 1)} MB`;
}

export function navProtocol() {
  const protocol = performance.getEntriesByType('navigation')[0]?.nextHopProtocol;
  return protocol ? protocol.toUpperCase() : location.protocol.replace(':', '').toUpperCase();
}

/**
 * Prueba de conexión contra el propio servidor local (nunca sale a Internet).
 * Llama a onProgress(enviadas, tiemposOk) tras cada intento.
 */
export async function pingServer(count, signal, onProgress) {
  const times = [];
  for (let i = 1; i <= count; i++) {
    const t0 = performance.now();
    try {
      const res = await fetch(`/favicon.svg?ping=${Date.now()}-${i}`, { cache: 'no-store', signal });
      await res.arrayBuffer();
      if (res.ok) times.push(performance.now() - t0);
    } catch {
      if (signal.aborted) return null;
    }
    onProgress(i, times);
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (signal.aborted) return null;
  }
  return times;
}

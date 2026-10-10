// Iconos originales del XMB: glifos plateados dibujados en una rejilla de
// 64 × 64. Se instalan una vez como sprite (<symbol>) y se usan con <use>.
const SVG_NS = 'http://www.w3.org/2000/svg';

const S = 'fill="url(#xmb-silver)"';
const D = 'fill="url(#xmb-shade)"';
const SS = (w) => `fill="none" stroke="url(#xmb-silver)" stroke-width="${w}"`;
const DS = (w) => `fill="none" stroke="url(#xmb-shade)" stroke-width="${w}"`;

const GLYPHS = {
  // ── Categorías ───────────────────────────────────────────
  toolbox: `
    <path ${SS(4)} stroke-linejoin="round" d="M23 24v-6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6"/>
    <rect ${S} x="7" y="23" width="50" height="31" rx="4"/>
    <rect ${D} x="7" y="33" width="50" height="2.5"/>
    <rect ${S} x="28" y="29.5" width="8" height="10" rx="1.5" stroke="url(#xmb-shade)" stroke-width="1.5"/>`,
  gamepad: `
    <path ${S} d="M21 20h22c7.5 0 11.5 4 13.5 11l4 14.5c1.4 5.2-1.8 9.5-6.6 9.5-3 0-5.2-1.4-7.2-4l-3.7-4.8H20.9l-3.7 4.8c-2 2.6-4.2 4-7.2 4-4.8 0-8-4.3-6.6-9.5L7.5 31C9.5 24 13.5 20 21 20z"/>
    <g ${D}>
      <rect x="16.5" y="27" width="5" height="15" rx="1"/>
      <rect x="11.5" y="32" width="15" height="5" rx="1"/>
      <circle cx="46" cy="28.5" r="2.8"/><circle cx="46" cy="40.5" r="2.8"/>
      <circle cx="40" cy="34.5" r="2.8"/><circle cx="52" cy="34.5" r="2.8"/>
    </g>`,
  globe: `
    <circle ${S} cx="32" cy="32" r="23"/>
    <g ${DS(2.2)}>
      <ellipse cx="32" cy="32" rx="10" ry="23"/>
      <path d="M32 9v46M9 32h46M12.5 20.5c12 4 27 4 39 0M12.5 43.5c12-4 27-4 39 0"/>
    </g>`,

  // ── Ajustes ──────────────────────────────────────────────
  update: `
    <g ${SS(5.5)}>
      <path d="M16 26.2A17 17 0 0 1 46.7 23.5"/>
      <path d="M48 37.8A17 17 0 0 1 17.3 40.5"/>
    </g>
    <path ${S} d="M51 19.9l-.8 9.7-8.8-4.2z"/>
    <path ${S} d="M13 44.2l.8-9.8 8.8 4.3z"/>`,
  film: `
    <rect ${S} x="10" y="12" width="44" height="40" rx="3"/>
    <g ${D}>
      <rect x="13.5" y="15.5" width="4" height="4" rx=".8"/><rect x="13.5" y="22.5" width="4" height="4" rx=".8"/>
      <rect x="13.5" y="29.5" width="4" height="4" rx=".8"/><rect x="13.5" y="36.5" width="4" height="4" rx=".8"/>
      <rect x="13.5" y="43.5" width="4" height="4" rx=".8"/>
      <rect x="46.5" y="15.5" width="4" height="4" rx=".8"/><rect x="46.5" y="22.5" width="4" height="4" rx=".8"/>
      <rect x="46.5" y="29.5" width="4" height="4" rx=".8"/><rect x="46.5" y="36.5" width="4" height="4" rx=".8"/>
      <rect x="46.5" y="43.5" width="4" height="4" rx=".8"/>
      <rect x="20.5" y="12" width="1.5" height="40"/><rect x="42" y="12" width="1.5" height="40"/>
      <path d="M27 23.5L41 32l-14 8.5z"/>
    </g>`,
  music: `
    <g ${S}>
      <ellipse cx="21" cy="46" rx="7.5" ry="5.8" transform="rotate(-22 21 46)"/>
      <ellipse cx="45" cy="41" rx="7.5" ry="5.8" transform="rotate(-22 45 41)"/>
      <rect x="25.5" y="17" width="4" height="29"/>
      <rect x="49.5" y="12" width="4" height="29"/>
      <path d="M25.5 17l28-6v8l-28 6z"/>
    </g>`,
  chip: `
    <g ${S}>
      <rect x="23" y="8" width="4" height="8" rx="1"/><rect x="30" y="8" width="4" height="8" rx="1"/><rect x="37" y="8" width="4" height="8" rx="1"/>
      <rect x="23" y="48" width="4" height="8" rx="1"/><rect x="30" y="48" width="4" height="8" rx="1"/><rect x="37" y="48" width="4" height="8" rx="1"/>
      <rect x="8" y="23" width="8" height="4" rx="1"/><rect x="8" y="30" width="8" height="4" rx="1"/><rect x="8" y="37" width="8" height="4" rx="1"/>
      <rect x="48" y="23" width="8" height="4" rx="1"/><rect x="48" y="30" width="8" height="4" rx="1"/><rect x="48" y="37" width="8" height="4" rx="1"/>
      <rect x="15" y="15" width="34" height="34" rx="4"/>
    </g>
    <rect ${D} x="23" y="23" width="18" height="18" rx="2"/>`,
  clock: `
    <circle ${S} cx="32" cy="32" r="23"/>
    <g ${D}>
      <rect x="30.75" y="12" width="2.5" height="5" rx="1"/><rect x="30.75" y="47" width="2.5" height="5" rx="1"/>
      <rect x="12" y="30.75" width="5" height="2.5" rx="1"/><rect x="47" y="30.75" width="5" height="2.5" rx="1"/>
      <circle cx="32" cy="32" r="2.8"/>
    </g>
    <path ${DS(3.2)} stroke-linecap="round" d="M32 32V19M32 32l9 6"/>`,
  power: `
    <g ${SS(5.5)} stroke-linecap="round">
      <path d="M41 18.4A18 18 0 1 1 23 18.4"/>
      <path d="M32 10v22"/>
    </g>`,
  display: `
    <rect ${S} x="7" y="11" width="50" height="33" rx="3"/>
    <rect ${D} x="11" y="15" width="42" height="25" rx="1.5"/>
    <path ${S} d="M27 44h10l2 7H25z"/>
    <rect ${S} x="19" y="50" width="26" height="4" rx="2"/>`,
  speaker: `
    <path ${S} d="M9 25h9l13-11v36L18 39H9a2 2 0 0 1-2-2V27a2 2 0 0 1 2-2z"/>
    <g ${SS(4.5)} stroke-linecap="round">
      <path d="M39 24.5c4 4.5 4 10.5 0 15"/>
      <path d="M45.5 18.5c7.5 8 7.5 19 0 27"/>
    </g>`,
  palette: `
    <path ${S} d="M32 9c13.8 0 24 9.4 24 21 0 7.6-5.6 11.2-11.4 10.2-3.8-.7-6.6 1.9-4.9 5.6 2.2 4.6-1.3 9.2-7.7 9.2C18.6 55 8 44.7 8 32 8 19 18.7 9 32 9z"/>
    <g ${D}>
      <circle cx="19.5" cy="29" r="4.2"/><circle cx="27" cy="18.5" r="4.2"/>
      <circle cx="39.5" cy="18.5" r="4.2"/><circle cx="47.5" cy="28" r="3.8"/>
      <circle cx="21.5" cy="42" r="4.2"/>
    </g>`,
  padlock: `
    <path ${SS(5)} d="M21.5 30v-7a10.5 10.5 0 0 1 21 0v7"/>
    <rect ${S} x="14" y="28" width="36" height="26" rx="4"/>
    <g ${D}>
      <circle cx="32" cy="38.5" r="3.6"/>
      <rect x="30.3" y="39" width="3.4" height="8" rx="1.2"/>
    </g>`,
  nodes: `
    <path ${SS(4)} d="M32 15L14 47M32 15l18 32M14 47h36"/>
    <g ${S}><circle cx="32" cy="15" r="8"/><circle cx="14" cy="47" r="8"/><circle cx="50" cy="47" r="8"/></g>
    <g ${D}><circle cx="32" cy="15" r="3"/><circle cx="14" cy="47" r="3"/><circle cx="50" cy="47" r="3"/></g>`,
  plug: `
    <g ${S}>
      <rect x="25" y="9" width="4.5" height="13" rx="1.5"/>
      <rect x="34.5" y="9" width="4.5" height="13" rx="1.5"/>
      <path d="M19 20h26v10a13 13 0 0 1-26 0z"/>
    </g>
    <path ${SS(5)} stroke-linecap="round" d="M32 42v6c0 4 3 6 7 6h8"/>`,

  // ── Juego ────────────────────────────────────────────────
  trophy: `
    <path ${SS(3.6)} d="M20 17h-6c0 9 3.5 13.5 9 14M44 17h6c0 9-3.5 13.5-9 14"/>
    <path ${S} d="M19 11h26v11c0 9.5-5.5 16-13 17-7.5-1-13-7.5-13-17z"/>
    <rect ${S} x="29.5" y="38" width="5" height="7"/>
    <rect ${S} x="20" y="45" width="24" height="8" rx="2"/>
    <path ${D} d="M32 16.5l2.1 4.3 4.7.7-3.4 3.3.8 4.7-4.2-2.2-4.2 2.2.8-4.7-3.4-3.3 4.7-.7z"/>`,
  card: `
    <path ${S} d="M17 9h22l11 11v32a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V12a3 3 0 0 1 3-3z"/>
    <g ${D}>
      <rect x="19" y="12" width="3" height="8" rx="1"/><rect x="24.5" y="12" width="3" height="8" rx="1"/>
      <rect x="30" y="12" width="3" height="8" rx="1"/><rect x="35.5" y="12" width="3" height="8" rx="1"/>
      <rect x="19" y="31" width="26" height="18" rx="2"/>
    </g>`,
  database: `
    <path ${S} d="M14 17v30a18 7 0 0 0 36 0V17a18 7 0 0 1-36 0z"/>
    <path ${DS(2)} d="M14 27a18 7 0 0 0 36 0M14 37a18 7 0 0 0 36 0"/>
    <ellipse ${S} cx="32" cy="17" rx="18" ry="7" stroke="url(#xmb-shade)" stroke-width="1.6"/>`,

  // ── Red ──────────────────────────────────────────────────
  book: `
    <path ${S} d="M31 17c-6-4-13.5-5-22-4v36c8.5-1 16 0 22 4z"/>
    <path ${S} d="M33 17c6-4 13.5-5 22-4v36c-8.5-1-16 0-22 4z"/>
    <path ${DS(1.8)} stroke-linecap="round" d="M14 21c4.5-.4 8.5 0 12 1.5M14 27c4.5-.4 8.5 0 12 1.5M14 33c4.5-.4 8.5 0 12 1.5M50 21c-4.5-.4-8.5 0-12 1.5M50 27c-4.5-.4-8.5 0-12 1.5M50 33c-4.5-.4-8.5 0-12 1.5"/>`,
  magnifier: `
    <circle ${D} cx="27" cy="27" r="13" opacity=".35"/>
    <circle ${SS(5.5)} cx="27" cy="27" r="14"/>
    <path ${SS(8)} stroke-linecap="round" d="M38 38l13 13"/>`,
  handheld: `
    <rect ${S} x="5" y="19" width="54" height="27" rx="13.5"/>
    <rect ${D} x="20" y="23" width="24" height="19" rx="1.5"/>
    <g ${D}>
      <rect x="12" y="28.5" width="2" height="8" rx=".6"/><rect x="9" y="31.5" width="8" height="2" rx=".6"/>
      <circle cx="51" cy="29.5" r="1.4"/><circle cx="51" cy="35.5" r="1.4"/>
      <circle cx="48" cy="32.5" r="1.4"/><circle cx="54" cy="32.5" r="1.4"/>
    </g>`,
  // ── Información ──────────────────────────────────────────
  // Marca de GitHub (Octicons «mark-github», licencia MIT), para enlazar al
  // perfil del autor. Rejilla original de 16 × 16 llevada a 48 px.
  github: `
    <path fill="url(#xmb-silver-box)" transform="translate(8 8) scale(3)" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>`,

  download: `
    <path ${S} d="M28 9h8v18h8.5L32 40.5 19.5 27H28z"/>
    <path ${SS(5)} stroke-linecap="round" stroke-linejoin="round" d="M11 39v10a4 4 0 0 0 4 4h34a4 4 0 0 0 4-4V39"/>`,
};

/** Inserta el sprite en el documento (una sola vez). */
export function installIconSprite() {
  if (document.getElementById('xmb-icon-sprite')) return;
  const symbols = Object.entries(GLYPHS)
    .map(([name, body]) => `<symbol id="xmb-i-${name}" viewBox="0 0 64 64">${body}</symbol>`)
    .join('');
  // No usar display:none: los degradados de un SVG oculto así no se pintan.
  document.body.insertAdjacentHTML(
    'afterbegin',
    `<svg id="xmb-icon-sprite" width="0" height="0" aria-hidden="true" style="position:absolute">
      <defs>
        <linearGradient id="xmb-silver" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="56">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset=".55" stop-color="#f0f2f6"/>
          <stop offset="1" stop-color="#c6cdd9"/>
        </linearGradient>
        <!-- Mismo plateado, relativo a la caja de la figura (para trazados escalados). -->
        <linearGradient id="xmb-silver-box" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffffff"/>
          <stop offset=".55" stop-color="#f0f2f6"/>
          <stop offset="1" stop-color="#c6cdd9"/>
        </linearGradient>
        <linearGradient id="xmb-shade" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="56">
          <stop offset="0" stop-color="#9ea7b6"/>
          <stop offset="1" stop-color="#6a7486"/>
        </linearGradient>
      </defs>
      ${symbols}
    </svg>`,
  );
}

/** Crea un <svg> que referencia el glifo `name` del sprite. */
export function glyphIcon(name, className) {
  if (!(name in GLYPHS)) throw new Error(`Icono desconocido: ${name}`);
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', className);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#xmb-i-${name}`);
  svg.append(use);
  return svg;
}

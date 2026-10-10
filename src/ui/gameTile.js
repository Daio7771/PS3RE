// Carátulas de juego en el formato apaisado de los iconos del XMB (≈ 1,81 : 1):
// la imagen real del juego si la hay; si no, una generada (degradado + motivo
// abstracto + título).
const MOTIFS = {
  orbit: `
    <g fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5">
      <ellipse cx="122" cy="40" rx="38" ry="14" transform="rotate(-18 122 40)"/>
      <ellipse cx="122" cy="40" rx="25" ry="9" transform="rotate(-18 122 40)"/>
    </g>
    <circle cx="122" cy="40" r="11" fill="#fff" fill-opacity=".9"/>
    <circle cx="154" cy="27" r="3.5" fill="#fff"/>`,
  waves: `
    <g fill="none" stroke="#fff" stroke-linecap="round">
      <path stroke-opacity=".8" stroke-width="2.5" d="M70 48c18-22 36-22 54 0s36 22 50 0"/>
      <path stroke-opacity=".4" stroke-width="1.5" d="M62 60c18-18 38-18 56 0s38 18 56 0"/>
    </g>
    <g fill="#fff"><circle cx="140" cy="18" r="1.6"/><circle cx="96" cy="22" r="1.2"/><circle cx="160" cy="34" r="1"/></g>`,
  city: `
    <g fill="#fff" fill-opacity=".82">
      <rect x="98" y="42" width="12" height="28"/><rect x="113" y="26" width="14" height="44"/>
      <rect x="130" y="36" width="10" height="34"/><rect x="143" y="18" width="13" height="52"/>
      <rect x="159" y="46" width="9" height="24"/>
    </g>
    <rect x="92" y="70" width="80" height="1.5" fill="#fff" fill-opacity=".6"/>`,
  stripes: `
    <g fill="#fff">
      <path fill-opacity=".9" d="M104 70l20-52h12l-20 52z"/>
      <path fill-opacity=".55" d="M126 70l20-52h12l-20 52z"/>
      <path fill-opacity=".3" d="M148 70l20-52h6l-20 52z"/>
    </g>`,
};

const escapeXml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Carátula de un juego: su imagen si la tiene (y carga); si no, una generada. */
export function gameTile(item) {
  if (!item.tile.image) return generatedTile(item);
  const img = document.createElement('img');
  img.className = 'xmb-tile xmb-tile--art';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.addEventListener('error', () => img.replaceWith(generatedTile(item)), { once: true });
  img.src = item.tile.image;
  return img;
}

function generatedTile({ id, label, tile }) {
  const { hue, motif } = tile;
  const gradId = `xmb-tile-${id.replace(/[^a-z0-9_-]/gi, '-')}`;
  const title = escapeXml(label.toUpperCase());
  const fontSize = label.length > 12 ? 10 : 13;
  const template = document.createElement('template');
  template.innerHTML = `
    <svg class="xmb-tile" viewBox="0 0 176 97" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 72% 58%)"/>
          <stop offset="1" stop-color="hsl(${(hue + 35) % 360} 70% 20%)"/>
        </linearGradient>
      </defs>
      <rect width="176" height="97" rx="5" fill="url(#${gradId})"/>
      ${MOTIFS[motif]}
      <text x="12" y="85" fill="#fff" font-size="${fontSize}" font-weight="700" letter-spacing="1.2">${title}</text>
      <rect x=".75" y=".75" width="174.5" height="95.5" rx="4.5" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>
    </svg>`;
  return template.content.firstElementChild;
}

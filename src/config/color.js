const HEX_RE = /^#[0-9a-f]{6}$/i;

export function isHexColor(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

/** '#1f5fc0' → [r, g, b] en 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

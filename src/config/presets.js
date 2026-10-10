// Valores seleccionables de los ajustes.

// Colores de fondo (Ajustes de tema → Color de fondo). Inspirados en la gama
// del XMB, pero el color es fijo: no cambia con la hora ni con el mes.
export const COLOR_PRESETS = Object.freeze([
  { id: 'azul', name: 'Azul', hex: '#1f5fc0' },
  { id: 'indigo', name: 'Índigo', hex: '#3d3fa8' },
  { id: 'purpura', name: 'Púrpura', hex: '#6a3cb4' },
  { id: 'rosa', name: 'Rosa', hex: '#b84a86' },
  { id: 'rojo', name: 'Rojo', hex: '#a8282f' },
  { id: 'ambar', name: 'Ámbar', hex: '#c27619' },
  { id: 'oro', name: 'Oro', hex: '#b08f27' },
  { id: 'lima', name: 'Lima', hex: '#7b9e2a' },
  { id: 'verde', name: 'Verde', hex: '#3a8f35' },
  { id: 'turquesa', name: 'Turquesa', hex: '#1d8a92' },
  { id: 'marron', name: 'Marrón', hex: '#85593a' },
  { id: 'plata', name: 'Plata', hex: '#878f9b' },
]);

export const DEFAULT_COLOR = COLOR_PRESETS[0].hex;

// Volumen de los sonidos del menú (Ajustes de sonido → Sonidos del menú).
export const VOLUME_LEVELS = Object.freeze([
  { value: 0, name: 'Desactivados' },
  { value: 0.35, name: 'Volumen bajo' },
  { value: 0.65, name: 'Volumen medio' },
  { value: 1, name: 'Volumen alto' },
]);

export const DEFAULT_VOLUME = 0.65;

export function findPresetByHex(hex) {
  const needle = hex.toLowerCase();
  return COLOR_PRESETS.find((p) => p.hex === needle) ?? null;
}

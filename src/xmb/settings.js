// Ajustes editables desde el XMB: opciones disponibles y cómo mostrar el valor.
// La clave coincide con la de config/config.js. `swatch` es opcional.
import { COLOR_PRESETS, VOLUME_LEVELS, findPresetByHex } from '../config/presets.js';

export const SETTINGS = Object.freeze({
  backgroundColor: {
    options: COLOR_PRESETS.map((p) => ({ value: p.hex, label: p.name, swatch: p.hex })),
    format: (hex) => findPresetByHex(hex)?.name ?? hex.toUpperCase(),
  },
  soundVolume: {
    options: VOLUME_LEVELS.map((v) => ({ value: v.value, label: v.name })),
    format: (v) => VOLUME_LEVELS.find((l) => l.value === v)?.name ?? `${Math.round(v * 100)} %`,
  },
  bootSequence: {
    options: [
      { value: true, label: 'Activada' },
      { value: false, label: 'Desactivada' },
    ],
    format: (on) => (on ? 'Activada' : 'Desactivada'),
  },
});

// Configuración central del usuario: reactiva y persistida en localStorage.
// Cualquier módulo puede leer un valor, cambiarlo en caliente o suscribirse.
// Una vista previa (previewConfig) cambia el valor efectivo sin guardarlo;
// setConfig lo confirma y cancelPreview vuelve al valor guardado.
import { DEFAULT_COLOR, DEFAULT_VOLUME } from './presets.js';
import { isHexColor } from './color.js';

export const STORAGE_KEY = 'xmb.config.v1';

const DEFAULTS = Object.freeze({
  backgroundColor: DEFAULT_COLOR,
  soundVolume: DEFAULT_VOLUME,
  bootSequence: true,
});

const isUnitNumber = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
const isBoolean = (v) => typeof v === 'boolean';
const same = (v) => v;

const SCHEMA = {
  backgroundColor: { validate: isHexColor, normalize: (v) => v.toLowerCase() },
  soundVolume: { validate: isUnitNumber, normalize: same },
  bootSequence: { validate: isBoolean, normalize: same },
};

const saved = { ...DEFAULTS, ...load() };
const preview = {};
const listeners = new Map();

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      const field = SCHEMA[key];
      if (field && field.validate(value)) out[key] = field.normalize(value);
    }
    return out;
  } catch {
    return {};
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Almacenamiento no disponible (modo privado estricto): el valor vive en memoria.
  }
}

function field(key) {
  const f = SCHEMA[key];
  if (!f) throw new Error(`Clave de configuración desconocida: ${key}`);
  return f;
}

function checked(key, value) {
  const f = field(key);
  if (!f.validate(value)) throw new Error(`Valor no válido para ${key}: ${value}`);
  return f.normalize(value);
}

// Aplica `mutate` y avisa a los suscriptores si cambia el valor efectivo.
function update(key, mutate) {
  const before = getConfig(key);
  mutate();
  const after = getConfig(key);
  if (after !== before) listeners.get(key)?.forEach((fn) => fn(after));
}

/** Valor efectivo (la vista previa, si la hay; si no, el guardado). */
export function getConfig(key) {
  field(key);
  return key in preview ? preview[key] : saved[key];
}

/** Valor guardado, ignorando cualquier vista previa. */
export function getSavedConfig(key) {
  field(key);
  return saved[key];
}

/** Cambia y guarda el valor (descarta la vista previa). */
export function setConfig(key, value) {
  const next = checked(key, value);
  update(key, () => {
    delete preview[key];
    if (saved[key] !== next) {
      saved[key] = next;
      save();
    }
  });
}

/** Muestra un valor sin guardarlo. */
export function previewConfig(key, value) {
  const next = checked(key, value);
  update(key, () => {
    preview[key] = next;
  });
}

/** Descarta la vista previa y vuelve al valor guardado. */
export function cancelPreview(key) {
  field(key);
  update(key, () => {
    delete preview[key];
  });
}

/** Suscribe `fn` a los cambios del valor efectivo de `key`. Devuelve la función para desuscribirse. */
export function onConfigChange(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

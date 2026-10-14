// Estado de navegación del XMB.
//   · Nivel 0: categoría seleccionada y, por categoría, el elemento
//     seleccionado (cada columna recuerda su posición).
//   · `stack`: niveles abiertos encima. Un marco 'list' es una lista de
//     entradas; un marco 'options' es el panel de valores de un ajuste, que
//     previsualiza en vivo y sólo guarda al confirmar; un marco 'info' es un
//     panel de sólo lectura (p. ej. Información del sistema).
// Sin vuelta al llegar a los extremos, como en la consola.
// Una columna puede cambiar en marcha (juego añadido o quitado) con
// replaceItems; la vista la reconstruye al recibir el cambio 'refresh'.
import { getSavedConfig, previewConfig, cancelPreview, setConfig } from '../config/config.js';
import { SETTINGS } from './settings.js';

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function createNavigation(menu, { category = 0, items = {} } = {}) {
  const state = {
    category: clamp(category, 0, menu.length - 1),
    // Elemento seleccionado al empezar en cada columna (por defecto, el primero).
    items: menu.map((c, ci) => clamp(items[ci] ?? 0, 0, Math.max(0, c.items.length - 1))),
    stack: [],
  };
  const listeners = new Set();

  function emit(change) {
    listeners.forEach((fn) => fn(state, change));
  }

  const top = () => state.stack.at(-1);
  const currentItem = () => menu[state.category].items[state.items[state.category]];

  function moveCategory(dir) {
    const next = clamp(state.category + dir, 0, menu.length - 1);
    if (next === state.category) return false;
    state.category = next;
    emit({ type: 'category', dir });
    return true;
  }

  function moveSelection(dir) {
    const frame = top();
    if (!frame) {
      const c = state.category;
      const next = clamp(state.items[c] + dir, 0, menu[c].items.length - 1);
      if (next === state.items[c]) return false;
      state.items[c] = next;
      emit({ type: 'item', dir });
      return true;
    }
    if (frame.kind === 'info') return false;
    const length = frame.kind === 'list' ? frame.entries.length : frame.options.length;
    const next = clamp(frame.index + dir, 0, length - 1);
    if (next === frame.index) return false;
    frame.index = next;
    if (frame.kind === 'options') previewConfig(frame.key, frame.options[next].value);
    emit({ type: 'move', dir });
    return true;
  }

  function openList(entries) {
    state.stack.push({ kind: 'list', entries, index: 0 });
    emit({ type: 'open', kind: 'list' });
    return true;
  }

  function openOptions(key) {
    const { options } = SETTINGS[key];
    const saved = getSavedConfig(key);
    const index = Math.max(0, options.findIndex((o) => o.value === saved));
    state.stack.push({ kind: 'options', key, options, index });
    emit({ type: 'open', kind: 'options' });
    return true;
  }

  function openInfo(source) {
    state.stack.push({ kind: 'info', source });
    emit({ type: 'open', kind: 'info' });
    return true;
  }

  function confirm() {
    const frame = top();
    if (!frame) {
      const item = currentItem();
      if (item.children) return openList(item.children);
      if (item.info) return openInfo(item.info);
      if (item.game) {
        emit({ type: 'launch', item }); // lo lanza main.js a través del lanzador
        return true;
      }
      if (item.action) {
        emit({ type: 'action', action: item.action, item });
        return true;
      }
      return false;
    }
    if (frame.kind === 'list') {
      const entry = frame.entries[frame.index];
      if (entry.disabled) return false;
      if (entry.children) return openList(entry.children);
      if (entry.setting) return openOptions(entry.setting);
      if (entry.info) return openInfo(entry.info);
      if (entry.href) {
        emit({ type: 'link', href: entry.href }); // lo abre main.js
        return true;
      }
      if (entry.action) {
        emit({ type: 'action', action: entry.action, entry });
        return true;
      }
      return false;
    }
    // Panel informativo: confirmar lo cierra, como un «Aceptar».
    if (frame.kind === 'info') return back();
    // Panel de opciones: guarda el valor resaltado.
    setConfig(frame.key, frame.options[frame.index].value);
    state.stack.pop();
    emit({ type: 'commit' });
    return true;
  }

  // △ sobre un elemento del XMB: su lista de acciones, si tiene.
  function openItemOptions() {
    if (top()) return false;
    const item = currentItem();
    return item?.options?.length ? openList(item.options) : false;
  }

  /**
   * Cambia los elementos de la columna `ci` (p. ej. tras añadir o quitar un
   * juego), cierra lo que hubiera abierto encima y selecciona `index`.
   */
  function replaceItems(ci, items, index = state.items[ci]) {
    menu[ci].items = items;
    if (ci === state.category) {
      for (const frame of state.stack) if (frame.kind === 'options') cancelPreview(frame.key);
      state.stack.length = 0;
    }
    state.items[ci] = clamp(index, 0, Math.max(0, items.length - 1));
    emit({ type: 'refresh', category: ci });
  }

  function back() {
    const frame = top();
    if (!frame) return false;
    if (frame.kind === 'options') cancelPreview(frame.key);
    state.stack.pop();
    emit({ type: 'close' });
    return true;
  }

  return {
    state,
    /** Traduce una acción de entrada. Devuelve false si no tuvo efecto. */
    handle(action) {
      const frame = top();
      switch (action) {
        case 'up':
          return moveSelection(-1);
        case 'down':
          return moveSelection(1);
        case 'left':
          return frame ? back() : moveCategory(-1);
        case 'right':
          if (!frame) return moveCategory(1);
          return frame.kind === 'list' ? confirm() : false;
        case 'confirm':
          return confirm();
        case 'back':
          return back();
        case 'options':
          return openItemOptions();
        default:
          return false;
      }
    },
    replaceItems,
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

// Niveles abiertos encima del XMB: la lista de entradas (a la derecha del
// icono abierto), el panel de opciones de un ajuste y el panel informativo
// (ambos en el borde derecho). En lista y opciones, la fila resaltada se queda
// fija y la lista se desplaza.
import { LAYOUT as L } from '../config/layout.js';
import { getConfig, getSavedConfig } from '../config/config.js';
import { SETTINGS } from '../xmb/settings.js';

const CHECK_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

const entryValue = (entry) =>
  entry.setting ? SETTINGS[entry.setting].format(getConfig(entry.setting)) : (entry.value ?? '');

export function createSubMenuView(root, { infoSources = {} } = {}) {
  const list = el('div', 'xmb-sub');
  const listRows = el('div', 'xmb-sub__rows');
  list.setAttribute('role', 'listbox');
  list.append(el('div', 'xmb-sub__bar'), listRows);

  const panel = el('div', 'xmb-options');
  const panelRows = el('div', 'xmb-options__rows');
  panel.setAttribute('role', 'listbox');
  panel.append(el('div', 'xmb-options__bar'), panelRows);

  const info = el('div', 'xmb-info');
  const infoTitle = el('h2', 'xmb-info__title');
  const infoRows = el('dl', 'xmb-info__rows');
  info.append(infoTitle, infoRows);

  root.append(list, panel, info);

  let listFrame = null;
  let entryRows = [];
  let optionsFrame = null;
  let optionRows = [];
  let infoFrame = null;
  let infoSource = null;

  function renderInfoRows(rows) {
    if (infoRows.children.length !== rows.length * 2) {
      infoRows.replaceChildren(
        ...rows.flatMap(() => [el('dt', 'xmb-info__label'), el('dd', 'xmb-info__value')]),
      );
    }
    rows.forEach(([label, value], i) => {
      infoRows.children[i * 2].textContent = label;
      infoRows.children[i * 2 + 1].textContent = value;
    });
  }

  // El panel informativo recoge datos sólo mientras está abierto.
  function syncInfo(frame) {
    if (frame === infoFrame) return;
    infoSource?.stop();
    infoFrame = frame;
    infoSource = frame ? (infoSources[frame.source] ?? null) : null;
    if (!infoSource) return;
    infoTitle.textContent = infoSource.title;
    infoSource.start(renderInfoRows);
  }

  function buildList(frame) {
    entryRows = frame.entries.map((entry) => {
      const row = el('div', 'xmb-entry');
      row.setAttribute('role', 'option');
      row.classList.toggle('is-disabled', Boolean(entry.disabled));
      const value = el('span', 'xmb-entry__value');
      row.append(el('span', 'xmb-entry__label', entry.label), value);
      return { row, value, entry };
    });
    listRows.replaceChildren(...entryRows.map((r) => r.row));
  }

  function buildOptions(frame) {
    optionRows = frame.options.map((option) => {
      const row = el('div', 'xmb-option');
      row.setAttribute('role', 'option');
      const check = el('span', 'xmb-option__check');
      check.innerHTML = CHECK_SVG;
      row.append(check);
      if (option.swatch) {
        const swatch = el('span', 'xmb-option__swatch');
        swatch.style.background = option.swatch;
        row.append(swatch);
      }
      row.append(el('span', 'xmb-option__label', option.label));
      return { row, option };
    });
    panelRows.replaceChildren(...optionRows.map((r) => r.row));
  }

  function place(rows, index, gap) {
    rows.forEach(({ row }, i) => {
      const offset = i - index;
      row.style.setProperty('--y', L.selectedY + offset * gap);
      row.classList.toggle('is-selected', offset === 0);
      row.setAttribute('aria-selected', String(offset === 0));
    });
  }

  return {
    render(stack) {
      const lastList = stack.findLast((f) => f.kind === 'list') ?? null;
      const options = stack.at(-1)?.kind === 'options' ? stack.at(-1) : null;
      syncInfo(stack.at(-1)?.kind === 'info' ? stack.at(-1) : null);
      // Un panel abierto directamente desde el XMB no tiene lista debajo.
      list.classList.toggle('is-open', Boolean(lastList));

      // Al cerrar se conservan las filas para que se desvanezcan; al abrir
      // un marco nuevo se reconstruyen.
      if (lastList && lastList !== listFrame) buildList(lastList);
      if (lastList) listFrame = lastList;
      if (options && options !== optionsFrame) buildOptions(options);
      if (options) optionsFrame = options;

      if (lastList) {
        place(entryRows, lastList.index, L.entryGap);
        entryRows.forEach(({ value, entry }) => (value.textContent = entryValue(entry)));
      }
      if (options) {
        place(optionRows, options.index, L.optionGap);
        const saved = getSavedConfig(options.key);
        optionRows.forEach(({ row, option }) => row.classList.toggle('is-current', option.value === saved));
      }
    },
  };
}

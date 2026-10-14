// Vista del XMB: fila de categorías + columna de elementos de la categoría
// seleccionada. JS sólo calcula posiciones (en u) y clases; las transiciones
// CSS animan a la frecuencia nativa del monitor.
import { LAYOUT as L } from '../config/layout.js';
import { glyphIcon } from './icons.js';
import { gameTile } from './gameTile.js';
import { createSubMenuView } from './subMenuView.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text) node.textContent = text;
  return node;
}

// Posición vertical (u) de un elemento según su distancia al seleccionado.
// Los anteriores suben por encima de la barra de categorías.
function itemY(offset) {
  if (offset === 0) return L.selectedY;
  if (offset > 0) return L.selectedY + L.gapBelowSelected + (offset - 1) * L.itemGap;
  return L.barY - L.gapAboveBar + (offset + 1) * L.itemGap;
}

export function createXmbView(root, menu, navigation, { infoSources } = {}) {
  const metrics = {
    '--bar-y': L.barY,
    '--cat-gap': L.categoryGap,
    '--cat-size': L.categorySize,
    '--cat-idle-scale': L.categoryIdleScale,
    '--item-w': L.itemWidth,
    '--item-h': L.itemHeight,
    '--item-idle-scale': L.itemIdleScale,
    '--label-x': L.labelX,
    '--selected-y': L.selectedY,
    '--sub-list-x': L.subListX,
    '--sub-value-x': L.subValueX,
    '--options-w': L.optionsWidth,
    '--info-w': L.infoWidth,
  };
  for (const [name, value] of Object.entries(metrics)) root.style.setProperty(name, value);

  const track = el('div', 'xmb-track');
  const categories = menu.map((category, ci) => {
    const section = el('section', 'xmb-cat');
    section.style.setProperty('--i', ci);
    section.setAttribute('aria-label', category.label);

    const head = el('div', 'xmb-cat__head');
    head.append(glyphIcon(category.icon, 'xmb-cat__icon'), el('span', 'xmb-cat__label', category.label));

    const column = el('ul', 'xmb-col');
    column.setAttribute('role', 'listbox');
    column.setAttribute('aria-label', category.label);

    section.append(head, column);
    track.append(section);
    return { section, column, items: buildItems(category, column) };
  });
  root.append(track);
  const subMenu = createSubMenuView(root, { infoSources });

  // Elementos de una columna (al arrancar y cuando cambia, p. ej. un juego añadido).
  function buildItems(category, column) {
    const items = category.items.map((item, ii) => {
      const li = el('li', 'xmb-item');
      li.setAttribute('role', 'option');
      li.style.setProperty('--n', ii); // escalonado de la entrada al arrancar
      const icon = el('div', 'xmb-item__icon');
      icon.append(item.tile ? gameTile(item) : glyphIcon(item.icon, 'xmb-glyph'));
      li.append(icon, el('span', 'xmb-item__label', item.label));
      return li;
    });
    column.replaceChildren(...items);
    return items;
  }

  function render() {
    const { category, items: selection, stack } = navigation.state;
    const inSubmenu = stack.length > 0;
    root.classList.toggle('is-sub', inSubmenu);
    root.classList.toggle('is-options', stack.at(-1)?.kind === 'options');
    root.classList.toggle('is-info', stack.at(-1)?.kind === 'info');
    const axis = inSubmenu ? L.subColumnX : L.columnX;
    root.style.setProperty('--track-x', axis - category * L.categoryGap);
    categories.forEach(({ section, items }, ci) => {
      const isCurrent = ci === category;
      section.classList.toggle('is-selected', isCurrent);
      section.setAttribute('aria-hidden', String(!isCurrent));
      items.forEach((li, ii) => {
        const offset = ii - selection[ci];
        li.style.setProperty('--y', itemY(offset));
        li.classList.toggle('is-selected', offset === 0);
        li.classList.toggle('is-above', offset < 0);
        li.setAttribute('aria-selected', String(offset === 0));
      });
    });
    subMenu.render(stack);
  }

  // Colocación sin animar (la primera, y tras rehacer una columna).
  function placeInstantly() {
    root.classList.add('no-anim');
    render();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));
  }
  placeInstantly();

  navigation.onChange((_, change) => {
    if (change?.type !== 'refresh') {
      render();
      return;
    }
    const entry = categories[change.category];
    entry.items = buildItems(menu[change.category], entry.column);
    placeInstantly();
  });
}

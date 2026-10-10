// Pantalla de lanzamiento: fondo del juego, su logo (o nombre) y el estado.
//   launching → «Iniciando…» con indicador de actividad
//   running   → «En juego» (la app se minimiza; se ve si vuelves a ella)
//   failed    → mensaje de error
// Mientras está visible sólo atiende «volver», que regresa al menú.
const STATUS = {
  launching: 'Iniciando…',
  running: 'En juego',
};

function el(tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

export function createLaunchView(root, { onCancel }) {
  const hero = el('div', 'launch__hero');
  const logo = el('img', 'launch__logo');
  logo.alt = '';
  const name = el('h2', 'launch__name');
  const status = el('p', 'launch__status');
  const hint = el('p', 'launch__hint');
  hint.textContent = 'Esc o botón derecho: volver al menú';
  const busy = el('div', 'launch__busy');
  const content = el('div', 'launch__content');
  content.append(logo, name, status, hint);
  root.append(hero, el('div', 'launch__shade'), content, busy);

  let state = null;

  function setState(next, detail) {
    state = next;
    root.dataset.state = next;
    status.textContent = next === 'failed' ? (detail ?? 'No se ha podido iniciar el juego') : STATUS[next];
  }

  return {
    get active() {
      return state !== null;
    },

    show(game) {
      const background = game.art?.hero ?? game.art?.header;
      hero.style.backgroundImage = background ? `url("${background}")` : '';
      root.classList.toggle('has-hero', Boolean(background));
      name.textContent = game.name;
      // Con logo se muestra el logo; si falla o no hay, el nombre.
      root.classList.remove('has-logo');
      if (game.art?.logo) {
        logo.onload = () => root.classList.add('has-logo');
        logo.onerror = () => root.classList.remove('has-logo');
        logo.src = game.art.logo;
      } else {
        logo.removeAttribute('src');
      }
      setState('launching');
      root.hidden = false;
      requestAnimationFrame(() => root.classList.add('is-visible'));
    },

    setState,

    hide() {
      state = null;
      root.classList.remove('is-visible');
      setTimeout(() => {
        if (state === null) root.hidden = true;
      }, 400);
    },

    handleAction(action) {
      if (action === 'back') onCancel();
    },
  };
}

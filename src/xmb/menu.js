import { ABOUT } from '../config/about.js';

// Contenido del XMB. `icon` es un glifo de ui/icons.js; `tile` es una
// carátula (imagen o generada). Al confirmar, un elemento con `children` abre
// una lista, uno con `info` abre directamente un panel informativo (fuentes en
// xmb/info/sources.js) y uno con `game` lanza ese juego.
// En una lista, una entrada con `setting` abre el panel de opciones de ese
// ajuste (xmb/settings.js), una con `info` abre un panel informativo, una con
// `href` abre el enlace fuera, una con `action` ejecuta una acción de la app y
// una con `disabled` es de relleno.

const MOTIFS = ['orbit', 'waves', 'city', 'stripes'];

// Número estable a partir de un texto, para dar a cada juego sin carátula
// siempre el mismo color y motivo.
function hash(text) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h;
}

function gameItem(game) {
  const h = hash(game.name);
  return {
    id: game.id,
    label: game.name,
    tile: game.tile ?? { image: game.art?.header ?? null, hue: h % 360, motif: MOTIFS[h % MOTIFS.length] },
    game: game.demo ? null : game, // los de demostración no lanzan nada
  };
}

/** Monta el menú. `library` = { mode: 'app' | 'web', games } (launcher/library.js). */
export function buildMenu({ mode, games }) {
  const inApp = mode === 'app';
  const gameItems = games.length
    ? games.map(gameItem)
    : [{ id: 'no-games', label: 'No se han encontrado juegos', icon: 'gamepad' }];

  return Object.freeze([
    {
      id: 'ajustes',
      label: 'Ajustes',
      icon: 'toolbox',
      items: [
        { id: 'update', label: 'Actualización del sistema', icon: 'update', info: 'update' },
        {
          id: 'game-settings',
          label: 'Ajustes de juegos',
          icon: 'gamepad',
          children: [
            { id: 'controllers', label: 'Mandos conectados', info: 'controllers' },
            { id: 'button-repeat', label: 'Repetición de botones', info: 'input' },
          ],
        },
        {
          id: 'video-settings',
          label: 'Ajustes de vídeo',
          icon: 'film',
          children: [
            { id: 'video-output', label: 'Salida de vídeo', info: 'videoOutput' },
            { id: 'video-formats', label: 'Formatos de vídeo compatibles', info: 'videoFormats' },
          ],
        },
        { id: 'music-settings', label: 'Ajustes de música', icon: 'music', info: 'audioFormats' },
        {
          id: 'system-settings',
          label: 'Ajustes del sistema',
          icon: 'chip',
          children: [
            { id: 'boot-sequence', label: 'Secuencia de arranque', setting: 'bootSequence' },
            { id: 'system-info', label: 'Información del sistema', info: 'system' },
            ...(inApp ? [{ id: 'quit', label: 'Apagar el sistema', action: 'quit' }] : []),
          ],
        },
        { id: 'datetime-settings', label: 'Ajustes de fecha y hora', icon: 'clock', info: 'datetime' },
        { id: 'power-settings', label: 'Ajustes de ahorro de energía', icon: 'power', info: 'power' },
        { id: 'display-settings', label: 'Ajustes de pantalla', icon: 'display', info: 'display' },
        {
          id: 'sound-settings',
          label: 'Ajustes de sonido',
          icon: 'speaker',
          children: [
            { id: 'menu-sounds', label: 'Sonidos del menú', setting: 'soundVolume' },
            { id: 'audio-output', label: 'Salida de audio', info: 'audioOutput' },
          ],
        },
        {
          id: 'theme-settings',
          label: 'Ajustes de tema',
          icon: 'palette',
          children: [
            { id: 'background-color', label: 'Color de fondo', setting: 'backgroundColor' },
            { id: 'theme', label: 'Tema', value: 'Predeterminado', disabled: true },
          ],
        },
        { id: 'security-settings', label: 'Ajustes de seguridad', icon: 'padlock', info: 'security' },
        {
          id: 'network-settings',
          label: 'Ajustes de red',
          icon: 'nodes',
          children: [
            { id: 'network-status', label: 'Estado de la red', info: 'network' },
            { id: 'connection-test', label: 'Prueba de conexión', info: 'connectionTest' },
          ],
        },
        { id: 'accessory-settings', label: 'Ajustes de accesorios', icon: 'plug', info: 'accessories' },
        {
          id: 'about',
          label: 'Información',
          icon: 'github',
          children: [
            { id: 'about-project', label: `Acerca de ${ABOUT.name}`, info: 'about' },
            {
              id: 'github',
              label: 'Abrir en GitHub',
              href: ABOUT.github,
              value: ABOUT.github.replace(/^https?:\/\//, ''),
            },
          ],
        },
      ],
    },
    {
      id: 'juego',
      label: 'Juego',
      icon: 'gamepad',
      items: gameItems,
    },
    {
      id: 'red',
      label: 'Red',
      icon: 'globe',
      items: [
        { id: 'manuals', label: 'Manuales en línea', icon: 'book' },
        { id: 'browser', label: 'Navegador de Internet', icon: 'globe' },
        { id: 'search', label: 'Búsqueda en Internet', icon: 'magnifier' },
        { id: 'remote-play', label: 'Remote Play', icon: 'handheld' },
        { id: 'downloads', label: 'Gestión de descargas', icon: 'download' },
      ],
    },
  ]);
}

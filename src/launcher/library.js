// Biblioteca para la columna «Juego».
//   · En la app de escritorio (existe window.launcher): los juegos instalados.
//   · En el navegador (npm run dev:web): juegos de demostración que no lanzan nada.
const DEMO_GAMES = [
  { id: 'demo:orbita-cero', name: 'Órbita Cero', tile: { hue: 205, motif: 'orbit' } },
  { id: 'demo:nebula-drift', name: 'Nebula Drift', tile: { hue: 275, motif: 'waves' } },
  { id: 'demo:ciudad-cristal', name: 'Ciudad de Cristal', tile: { hue: 168, motif: 'city' } },
  { id: 'demo:pixel-kart', name: 'Pixel Kart', tile: { hue: 18, motif: 'stripes' } },
];

export async function loadLibrary() {
  const launcher = window.launcher;
  if (!launcher) return { mode: 'web', games: DEMO_GAMES.map((g) => ({ ...g, demo: true })) };
  try {
    return { mode: 'app', games: await launcher.getLibrary() };
  } catch {
    return { mode: 'app', games: [] };
  }
}

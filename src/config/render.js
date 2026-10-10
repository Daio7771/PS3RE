// Parámetros de rendimiento del fondo WebGL (no persistentes).
export const RENDER = Object.freeze({
  // El fondo se dibuja a 60 fps aunque el monitor vaya a 200 Hz.
  // La interfaz (CSS) no pasa por este límite.
  backgroundFps: 60,
  // Tope de devicePixelRatio para el canvas: el fondo es suave y no gana
  // nitidez apreciable por encima de esto.
  maxPixelRatio: 1.5,
  // Constante de tiempo (s) del fundido al cambiar el color base.
  colorTransitionTau: 0.22,
  // Multiplicador global de la velocidad de las ondas.
  waveSpeed: 1,
});

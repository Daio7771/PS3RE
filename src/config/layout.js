// Métricas del XMB en unidades `u` (1 u = 1 % de la altura de un lienzo 16:9;
// el lienzo mide 177,8 × 100 u). La vista las pasa a CSS como custom properties.
export const LAYOUT = Object.freeze({
  columnX: 42, // eje vertical de la categoría seleccionada
  barY: 24, // centro de los iconos de categoría
  categoryGap: 19, // distancia entre categorías
  categorySize: 12, // icono de categoría seleccionada
  categoryIdleScale: 0.8, // categorías no seleccionadas

  itemWidth: 22, // caja del icono del elemento seleccionado (≈ 1,81 : 1)
  itemHeight: 12.1,
  itemIdleScale: 0.62, // elementos no seleccionados
  labelX: 14, // inicio del texto respecto al eje

  selectedY: 42, // centro del elemento seleccionado
  gapBelowSelected: 12, // del seleccionado al siguiente
  gapAboveBar: 12, // de la barra al elemento inmediatamente anterior
  itemGap: 9.5, // entre elementos no seleccionados

  // Submenús: el XMB se desplaza a la izquierda y la lista ocupa el centro.
  subColumnX: 14, // eje del icono del elemento abierto
  subListX: 32, // inicio del texto de la lista
  subValueX: 44, // columna de valores, desde el inicio de la lista
  entryGap: 6.5, // entre filas de la lista
  optionsWidth: 62, // panel de opciones, pegado al borde derecho
  optionGap: 6, // entre filas del panel
  infoWidth: 88, // panel informativo (Información del sistema)
});

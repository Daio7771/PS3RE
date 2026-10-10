// Tiempos y umbrales de entrada (comunes a teclado y mando).
export const INPUT = Object.freeze({
  repeatDelay: 380, // ms manteniendo pulsado hasta que empieza a repetir
  repeatInterval: 105, // ms entre repeticiones
  stickPress: 0.55, // inclinación del stick que cuenta como pulsación
  stickRelease: 0.35, // por debajo se suelta (histéresis contra rebotes)
});

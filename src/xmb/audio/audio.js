// Reproductor de efectos: un AudioContext compartido con un volumen maestro
// ligado a la configuración (soundVolume).
// Los navegadores sólo dejan arrancar el audio tras un gesto del usuario
// (tecla o clic); los botones del mando no cuentan como gesto en Chromium.
// En la app de escritorio (`autoplay: true`) no hay esa restricción.
import { getConfig, onConfigChange } from '../../config/config.js';
import { SOUNDS } from './sounds.js';

const MASTER_LEVEL = 0.6;

// Curva perceptiva: el volumen se oye más lineal elevando al cuadrado.
const masterGain = () => MASTER_LEVEL * getConfig('soundVolume') ** 2;

export function createSoundEffects({ autoplay = false } = {}) {
  let ctx = null;
  let master = null;

  function ensureContext() {
    if (!ctx) {
      ctx = new AudioContext({ latencyHint: 'interactive' });
      master = ctx.createGain();
      master.gain.value = masterGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    return ctx;
  }

  // Arranca (o reanuda) el contexto en el primer gesto válido.
  for (const type of ['keydown', 'pointerdown']) {
    window.addEventListener(type, ensureContext, { capture: true });
  }

  // Sin audio de fondo mientras la pestaña está oculta.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  onConfigChange('soundVolume', () => {
    if (master) master.gain.setTargetAtTime(masterGain(), ctx.currentTime, 0.005);
  });

  return {
    /** 'idle' hasta el primer gesto; luego el estado del AudioContext. */
    get state() {
      return ctx?.state ?? 'idle';
    },
    /** Datos del dispositivo de audio, o null si aún no hay contexto. */
    describe() {
      if (!ctx) return null;
      return {
        state: ctx.state,
        sampleRate: ctx.sampleRate,
        baseLatency: ctx.baseLatency,
        outputLatency: ctx.outputLatency,
        channels: ctx.destination.maxChannelCount,
      };
    },
    /** Reproduce un efecto. Devuelve lo que devuelva la receta (p. ej. { stop }). */
    play(name) {
      if (getConfig('soundVolume') === 0) return;
      const context = ensureContext();
      // Sin permiso para sonar (p. ej. sólo se ha usado el mando) no se
      // programa nada: si no, todo lo acumulado sonaría de golpe al desbloquear.
      if (!autoplay && context.state !== 'running' && !navigator.userActivation?.isActive) return;
      return SOUNDS[name](context, master, context.currentTime + 0.005);
    },
  };
}

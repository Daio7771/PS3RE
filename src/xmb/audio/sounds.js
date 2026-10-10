// Efectos del XMB sintetizados con Web Audio (sin muestras grabadas).
// Cada receta programa sus nodos a partir del instante `t` hacia `out` y los
// detiene ella misma al terminar. Aceptan cualquier BaseAudioContext, así que
// también se pueden renderizar con OfflineAudioContext.

const noiseBuffers = new WeakMap();

function noiseBuffer(ctx) {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseBuffers.set(ctx, buffer);
  }
  return buffer;
}

// Envolvente: subida lineal, meseta opcional y caída exponencial.
function envelope(ctx, t, attack, decay, peak, hold = 0) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.setValueAtTime(peak, t + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  return gain;
}

// Reverberación sintética: ruido estéreo con caída exponencial (sin grabaciones).
const impulses = new WeakMap();

function reverbImpulse(ctx) {
  let buffer = impulses.get(ctx);
  if (!buffer) {
    const length = Math.round(ctx.sampleRate * 3.6);
    buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
    }
    impulses.set(ctx, buffer);
  }
  return buffer;
}

function tone(ctx, out, t, { type = 'sine', freq, to, detune = 0, pan = 0, attack = 0.002, hold = 0, decay, gain }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  let node = osc.connect(envelope(ctx, t, attack, decay, gain, hold));
  if (pan) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    node = node.connect(panner);
  }
  node.connect(out);
  osc.start(t);
  osc.stop(t + attack + hold + decay + 0.02);
}

function hiss(ctx, out, t, { filter = 'bandpass', freq, to, q = 1, attack = 0.002, decay, gain }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true; // el búfer dura 0,5 s; los soplos largos lo repiten
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(freq, t);
  if (to) biquad.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  src.connect(biquad).connect(envelope(ctx, t, attack, decay, gain)).connect(out);
  src.start(t);
  src.stop(t + attack + decay + 0.02);
}

export const SOUNDS = {
  // Subir/bajar por una lista: «tic» corto y suave.
  move(ctx, out, t) {
    tone(ctx, out, t, { freq: 2300, to: 2050, decay: 0.035, gain: 0.2 });
    tone(ctx, out, t, { freq: 4600, decay: 0.018, gain: 0.045 });
    hiss(ctx, out, t, { filter: 'highpass', freq: 6500, decay: 0.012, gain: 0.06 });
  },

  // Cambiar de categoría: «toc» más grave con un soplo de aire.
  category(ctx, out, t) {
    tone(ctx, out, t, { type: 'triangle', freq: 1180, to: 1020, decay: 0.07, gain: 0.16 });
    tone(ctx, out, t, { freq: 2360, decay: 0.04, gain: 0.05 });
    hiss(ctx, out, t, { freq: 1800, to: 4200, q: 0.8, attack: 0.01, decay: 0.09, gain: 0.05 });
  },

  // Confirmar: campanilla de dos notas (quinta ascendente).
  confirm(ctx, out, t) {
    tone(ctx, out, t, { freq: 1046.5, attack: 0.003, decay: 0.3, gain: 0.18 });
    tone(ctx, out, t + 0.05, { freq: 1568, attack: 0.003, decay: 0.34, gain: 0.14 });
    tone(ctx, out, t + 0.05, { freq: 3136, decay: 0.09, gain: 0.03 });
  },

  // Volver: nota que cae.
  back(ctx, out, t) {
    tone(ctx, out, t, { freq: 880, to: 560, attack: 0.003, decay: 0.13, gain: 0.18 });
    tone(ctx, out, t, { type: 'triangle', freq: 440, to: 280, decay: 0.1, gain: 0.06 });
  },

  // Abrir el panel de opciones: barrido de aire que sube y un acorde breve.
  panel(ctx, out, t) {
    hiss(ctx, out, t, { freq: 700, to: 3800, q: 0.7, attack: 0.03, decay: 0.2, gain: 0.07 });
    tone(ctx, out, t + 0.02, { freq: 1318.5, attack: 0.01, decay: 0.22, gain: 0.1 });
    tone(ctx, out, t + 0.06, { freq: 1975.5, attack: 0.01, decay: 0.22, gain: 0.06 });
  },

  // Arranque, de carácter cinematográfico (composición original):
  //   0 → HIT  subida: ruido que se abre y un tono que asciende
  //   HIT      golpe: bajo profundo, acorde de la mayor con novena en estéreo
  //            (sierras desafinadas) y una cascada de destellos agudos
  //   FADE     el acorde se apaga con un soplo descendente y un último brillo
  // Todo pasa por una reverberación larga, que es lo que le da amplitud.
  // HIT y FADE coinciden con TIMELINE.title y TIMELINE.reveal de ui/boot.js.
  // Devuelve { stop() } para apagarlo con un fundido si se salta el arranque.
  boot(ctx, out, t) {
    const HIT = 1.5;
    const FADE = 4.3;

    const bus = ctx.createGain();
    bus.connect(out);
    const dry = ctx.createGain();
    dry.gain.value = 0.55;
    dry.connect(bus);
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.7;
    reverb.connect(wet).connect(bus);
    const mix = ctx.createGain(); // entrada común: seco + reverberación
    mix.connect(dry);
    mix.connect(reverb);
    const shimmer = ctx.createGain(); // destellos: casi todo reverberación
    shimmer.gain.value = 0.8;
    shimmer.connect(reverb);
    shimmer.connect(dry);

    // Subida: ruido de banda que se abre y crece, con un tono que asciende.
    const riser = ctx.createBufferSource();
    riser.buffer = noiseBuffer(ctx);
    riser.loop = true;
    const riserBand = ctx.createBiquadFilter();
    riserBand.type = 'bandpass';
    riserBand.Q.value = 0.9;
    riserBand.frequency.setValueAtTime(180, t);
    riserBand.frequency.exponentialRampToValueAtTime(7000, t + HIT);
    const riserGain = ctx.createGain();
    riserGain.gain.setValueAtTime(0.0001, t);
    riserGain.gain.exponentialRampToValueAtTime(0.22, t + HIT - 0.03);
    riserGain.gain.linearRampToValueAtTime(0.0001, t + HIT + 0.15);
    riser.connect(riserBand).connect(riserGain).connect(mix);
    riser.start(t);
    riser.stop(t + HIT + 0.2);

    const rise = ctx.createOscillator();
    rise.type = 'triangle';
    rise.frequency.setValueAtTime(220, t);
    rise.frequency.exponentialRampToValueAtTime(880, t + HIT);
    const riseGain = ctx.createGain();
    riseGain.gain.setValueAtTime(0.0001, t);
    riseGain.gain.exponentialRampToValueAtTime(0.06, t + HIT - 0.03);
    riseGain.gain.linearRampToValueAtTime(0.0001, t + HIT + 0.1);
    rise.connect(riseGain).connect(mix);
    rise.start(t);
    rise.stop(t + HIT + 0.15);

    // Golpe: bajo profundo.
    const h = t + HIT;
    tone(ctx, mix, h, { freq: 55, to: 51, attack: 0.02, hold: 0.6, decay: 3, gain: 0.32 });
    tone(ctx, mix, h, { freq: 110, attack: 0.02, hold: 0.4, decay: 2.4, gain: 0.1 });

    // Acorde: dos sierras desafinadas por nota, abiertas a izquierda y derecha,
    // con un filtro que se abre en el golpe y se cierra despacio.
    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.Q.value = 0.7;
    padFilter.frequency.setValueAtTime(700, h);
    padFilter.frequency.exponentialRampToValueAtTime(3800, h + 0.6);
    padFilter.frequency.exponentialRampToValueAtTime(1600, t + FADE + 2);
    padFilter.connect(mix);
    const chord = [110, 164.81, 220, 277.18, 329.63, 493.88, 659.25]; // la2 mi3 la3 do#4 mi4 si4 mi5
    for (const freq of chord) {
      for (const [detune, pan] of [
        [-7, -0.6],
        [7, 0.6],
      ]) {
        tone(ctx, padFilter, h, {
          type: 'sawtooth',
          freq,
          detune,
          pan,
          attack: 0.25,
          hold: FADE - HIT - 0.25,
          decay: 2.2,
          gain: 0.032,
        });
      }
    }

    // Destellos: arpegio agudo que cae en la reverberación.
    [1318.51, 1760, 1975.53, 2217.46, 2637.02].forEach((freq, i) => {
      tone(ctx, shimmer, h + 0.05 + i * 0.12, {
        freq,
        pan: i % 2 ? 0.5 : -0.5,
        attack: 0.005,
        decay: 1.6,
        gain: 0.035,
      });
    });
    hiss(ctx, mix, h, { filter: 'highpass', freq: 5000, attack: 0.01, decay: 1.2, gain: 0.05 });

    // Revelado: soplo descendente y un último brillo.
    const f = t + FADE;
    hiss(ctx, mix, f, { freq: 3000, to: 400, q: 0.7, attack: 0.4, decay: 1.5, gain: 0.05 });
    tone(ctx, shimmer, f + 0.1, { freq: 2637.02, attack: 0.01, decay: 1.8, gain: 0.03 });

    return {
      stop() {
        bus.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      },
    };
  },

  // Lanzar un juego: arpegio brillante ascendente que se pierde en la
  // reverberación, sobre un soplo que sube (~1,5 s).
  launch(ctx, out, t) {
    const reverb = ctx.createConvolver();
    reverb.buffer = reverbImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    reverb.connect(wet).connect(out);
    const mix = ctx.createGain();
    mix.connect(out);
    mix.connect(reverb);
    hiss(ctx, mix, t, { freq: 600, to: 5000, q: 0.7, attack: 0.25, decay: 0.5, gain: 0.05 });
    [659.25, 830.61, 987.77, 1318.51, 1661.22].forEach((freq, i) => {
      tone(ctx, mix, t + 0.06 * i, { freq, pan: i % 2 ? 0.4 : -0.4, attack: 0.004, decay: 0.9, gain: 0.07 });
    });
    tone(ctx, mix, t, { freq: 164.81, attack: 0.02, hold: 0.2, decay: 1, gain: 0.12 });
  },

  // Acción no disponible: dos golpes graves y apagados.
  error(ctx, out, t) {
    for (const dt of [0, 0.095]) {
      tone(ctx, out, t + dt, { type: 'triangle', freq: 196, attack: 0.004, decay: 0.075, gain: 0.28 });
      tone(ctx, out, t + dt, { freq: 392, attack: 0.004, decay: 0.05, gain: 0.1 });
    }
  },
};

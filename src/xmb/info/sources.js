// Paneles informativos de Ajustes, con datos reales del equipo y del navegador.
// La clave de cada fuente es la que usan las entradas `info` de xmb/menu.js.
// No se muestran núcleos de CPU ni memoria: Brave los falsea a propósito
// (protección contra el rastreo) y saldrían datos incorrectos.
import { RENDER } from '../../config/render.js';
import { INPUT } from '../../config/input.js';
import { getConfig, STORAGE_KEY } from '../../config/config.js';
import { ABOUT } from '../../config/about.js';
import { SETTINGS } from '../settings.js';
import { infoSource } from './source.js';
import * as P from './probes.js';

const VIDEO_FORMATS = [
  ['H.264 (AVC)', 'video/mp4; codecs="avc1.640028"'],
  ['H.265 (HEVC)', 'video/mp4; codecs="hvc1.1.6.L120.90"'],
  ['VP8', 'video/webm; codecs="vp8"'],
  ['VP9', 'video/webm; codecs="vp09.00.40.08"'],
  ['AV1', 'video/mp4; codecs="av01.0.08M.08"'],
];

const AUDIO_FORMATS = [
  ['MP3', 'audio/mpeg'],
  ['AAC', 'audio/mp4; codecs="mp4a.40.2"'],
  ['Opus', 'audio/webm; codecs="opus"'],
  ['Vorbis', 'audio/ogg; codecs="vorbis"'],
  ['FLAC', 'audio/flac'],
  ['WAV (PCM)', 'audio/wav; codecs="1"'],
];

const PING_COUNT = 5;

const percent = (v) => `${Math.round(v * 100)} %`;

// Fondo y frecuencia medidos a la vez, con el texto de «Midiendo…» mientras tanto.
function frameStats(background, signal, onDone) {
  P.measureFrames(background, signal).then((m) => {
    if (signal.aborted) return;
    onDone({
      refresh: m ? `${P.snapRate(m.hz)} Hz (medida)` : 'No se pudo medir',
      fps: m?.bgFps != null ? `${Math.round(m.bgFps)} fps` : '—',
      hz: m ? P.snapRate(m.hz) : null,
    });
  });
}

// Panel de formatos: una fila por formato que se rellena al responder el navegador.
function formatsSource(title, kind, formats) {
  return infoSource(title, (render) => {
    const values = formats.map(() => 'Comprobando…');
    const emit = () => render(formats.map(([name], i) => [name, values[i]]));
    emit();
    formats.forEach(([, type], i) =>
      P.decodeSupport(kind, type).then((v) => {
        values[i] = v;
        emit();
      }),
    );
  });
}

function savedSettingsText() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 'Ninguno (valores predeterminados)';
    const count = Object.keys(JSON.parse(raw)).length;
    return `${count} ${count === 1 ? 'ajuste' : 'ajustes'} · ${P.bytes(raw.length)} en localStorage`;
  } catch {
    return 'No disponible';
  }
}

export function createInfoSources({ background, sfx }) {
  return {
    system: infoSource('Información del sistema', (render, signal) => {
      const state = { browser: '…', os: '…', gpu: '…', refresh: 'Midiendo…', fps: 'Midiendo…' };
      const emit = () => {
        const [w, h] = background?.renderSize ?? [0, 0];
        const audio = sfx?.describe();
        render([
          ['Software del sistema', `PS3 Reimagined ${P.APP_VERSION}`],
          ['Navegador', state.browser],
          ['Sistema operativo', state.os],
          ['GPU', state.gpu],
          ['Pantalla', P.screenText()],
          ['Frecuencia de la pantalla', state.refresh],
          ['Fondo animado', background ? `${state.fps} (límite ${RENDER.backgroundFps}) · ${w} × ${h}` : 'Sin WebGL2'],
          ['Audio', audio ? `${P.number(audio.sampleRate / 1000, 1)} kHz · ${audio.state === 'running' ? 'activo' : 'en pausa'}` : 'Sin iniciar'],
          ['Mandos', P.padsText()],
        ]);
      };
      emit();
      P.detectBrowser().then((r) => Object.assign(state, r), () => {}).then(emit);
      P.detectGpu(background).then((gpu) => (state.gpu = gpu)).then(emit);
      frameStats(background, signal, (s) => {
        Object.assign(state, s);
        emit();
      });
      P.listen(window, 'gamepadconnected', emit, signal);
      P.listen(window, 'gamepaddisconnected', emit, signal);
    }),

    about: infoSource(`Acerca de ${ABOUT.name}`, (render) => {
      render([
        ['Proyecto', ABOUT.name],
        ['Versión', P.APP_VERSION],
        ['Autor', ABOUT.author],
        ['Licencia', 'MIT'],
        ['GitHub', ABOUT.github.replace(/^https?:\/\//, '')],
        ['Descripción', 'Réplica fan-made del XMB de la PS3 (firmware final)'],
        ['Tecnología', 'Vite · HTML, CSS y JavaScript · WebGL2 · Web Audio'],
        ['Gráficos y sonido', 'Originales: SVG propios y síntesis en tiempo real'],
        ['Tipografía', 'M PLUS 1 (SIL Open Font License)'],
        ['Aviso', 'Proyecto de fans sin relación con Sony Interactive Entertainment. PlayStation y PS3 son marcas de sus propietarios.'],
      ]);
    }),

    update: infoSource('Actualización del sistema', (render) => {
      render([
        ['Versión instalada', `PS3 Reimagined ${P.APP_VERSION}`],
        ['Entorno', window.launcher ? 'Aplicación de escritorio (Electron)' : 'Navegador (sin lanzador de juegos)'],
        ['Modo', import.meta.env.DEV ? 'Desarrollo' : 'Producción (compilada)'],
        [import.meta.env.DEV ? 'Servidor iniciado' : 'Compilada', P.dateTimeText(new Date(__BUILD_TIME__))],
        ['Búsqueda de actualizaciones', 'No disponible (proyecto local)'],
      ]);
    }),

    controllers: infoSource('Mandos conectados', (render, signal) => {
      const emit = () => {
        const pads = P.connectedPads();
        if (!pads.length) {
          render([
            ['Mandos', 'Ninguno conectado'],
            ['Para detectarlo', 'Conéctalo y pulsa cualquier botón'],
          ]);
          return;
        }
        render(
          pads.flatMap((pad, i) => [
            [`Mando ${i + 1}`, P.padName(pad)],
            ['Mapeo', pad.mapping === 'standard' ? 'Estándar (compatible con el XMB)' : 'Propio del fabricante'],
            ['Botones · ejes', `${pad.buttons.length} · ${pad.axes.length}`],
            ['Vibración', pad.vibrationActuator ? 'Compatible' : 'No compatible'],
          ]),
        );
      };
      emit();
      P.listen(window, 'gamepadconnected', emit, signal);
      P.listen(window, 'gamepaddisconnected', emit, signal);
    }),

    input: infoSource('Repetición de botones', (render) => {
      render([
        ['Retardo antes de repetir', `${INPUT.repeatDelay} ms`],
        ['Intervalo de repetición', `${INPUT.repeatInterval} ms (≈ ${P.number(1000 / INPUT.repeatInterval, 1)} pasos/s)`],
        ['Umbral del stick', `${percent(INPUT.stickPress)} al pulsar · ${percent(INPUT.stickRelease)} al soltar`],
        ['Teclado', 'Flechas · Intro o Espacio confirma · Esc o Retroceso vuelve'],
        ['Mando', 'Cruceta o stick · botón inferior confirma · botón derecho vuelve'],
        ['Apagado instantáneo', 'Ctrl+Q · Select+Start en el mando'],
      ]);
    }),

    videoOutput: infoSource('Salida de vídeo', (render, signal) => {
      const state = { refresh: 'Midiendo…', fps: 'Midiendo…', gpu: '…' };
      const emit = () => {
        const [w, h] = background?.renderSize ?? [0, 0];
        render([
          ['Resolución de pantalla', P.screenText()],
          ['Frecuencia de la pantalla', state.refresh],
          ['Fondo animado', background ? `${state.fps} (límite ${RENDER.backgroundFps})` : 'Sin WebGL2'],
          ['Resolución del fondo', background ? `${w} × ${h} (escala máx. ${P.number(RENDER.maxPixelRatio, 1)})` : '—'],
          ['Profundidad de color', `${screen.colorDepth} bits`],
          ['Gama de color', P.colorGamut()],
          ['HDR', P.media('(dynamic-range: high)') ? 'Compatible' : 'No compatible'],
          ['GPU', state.gpu],
        ]);
      };
      emit();
      P.detectGpu(background).then((gpu) => (state.gpu = gpu)).then(emit);
      frameStats(background, signal, (s) => {
        Object.assign(state, s);
        emit();
      });
    }),

    videoFormats: formatsSource('Formatos de vídeo compatibles', 'video', VIDEO_FORMATS),

    audioFormats: formatsSource('Formatos de audio compatibles', 'audio', AUDIO_FORMATS),

    audioOutput: infoSource('Salida de audio', (render) => {
      const a = sfx?.describe();
      const latency = a ? ((a.baseLatency ?? 0) + (a.outputLatency ?? 0)) * 1000 : 0;
      render([
        ['Estado', !a ? 'Sin iniciar (se activa con la primera tecla)' : a.state === 'running' ? 'Activo' : 'En pausa'],
        ['Frecuencia de muestreo', a ? `${P.number(a.sampleRate / 1000, 1)} kHz` : '—'],
        ['Canales de salida', a ? P.channelsText(a.channels) : '—'],
        ['Latencia', a && latency ? `${P.number(latency, 1)} ms` : '—'],
        ['Sonidos del menú', SETTINGS.soundVolume.format(getConfig('soundVolume'))],
        ['Síntesis', 'Web Audio en tiempo real, sin muestras grabadas'],
      ]);
    }),

    datetime: infoSource('Fecha y hora', (render, signal) => {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const emit = () => {
        const now = new Date();
        render([
          ['Fecha', P.longDate(now)],
          ['Hora', P.timeWithSeconds(now)],
          ['Zona horaria', zone],
          ['Desfase con UTC', P.utcOffset(now)],
          ['Horario de verano', P.dstText(now)],
          ['Formato del reloj', '24 horas · DD/MM'],
        ]);
      };
      emit();
      P.every(1000, emit, signal);
    }),

    power: infoSource('Ahorro de energía', (render, signal) => {
      const state = { battery: '…', saved: 'Midiendo…' };
      const emit = () =>
        render([
          ['Batería', state.battery],
          ['Fondo animado', `Limitado a ${RENDER.backgroundFps} fps`],
          ['Fotogramas ahorrados', state.saved],
          ['Resolución del fondo', `Escala limitada a ${P.number(RENDER.maxPixelRatio, 1)}`],
          ['Pestaña oculta', 'Fondo y audio en pausa'],
          ['Reducir movimiento (sistema)', P.media('(prefers-reduced-motion: reduce)') ? 'Activado' : 'Desactivado'],
        ]);
      emit();
      P.batteryText().then((b) => {
        state.battery = b;
        emit();
      });
      frameStats(background, signal, ({ hz }) => {
        if (!hz) state.saved = 'No se pudo medir';
        else if (hz <= RENDER.backgroundFps) state.saved = `Ninguno: la pantalla ya va a ${hz} Hz`;
        else state.saved = `${percent(1 - RENDER.backgroundFps / hz)} menos que a ${hz} Hz`;
        emit();
      });
    }),

    display: infoSource('Ajustes de pantalla', (render, signal) => {
      const emit = () => {
        let contrast = 'Normal';
        if (P.media('(forced-colors: active)')) contrast = 'Colores forzados';
        else if (P.media('(prefers-contrast: more)')) contrast = 'Alto';
        render([
          ['Pantalla completa', document.fullscreenElement ? 'Sí' : 'No (F11 para activarla)'],
          ['Ventana', P.physical(innerWidth, innerHeight)],
          ['Área útil de la pantalla', P.physical(screen.availWidth, screen.availHeight)],
          ['Varias pantallas', screen.isExtended === undefined ? 'Desconocido' : screen.isExtended ? 'Sí' : 'No'],
          ['Orientación', screen.orientation?.type.startsWith('portrait') ? 'Vertical' : 'Horizontal'],
          ['Lienzo del XMB', `${P.uiCanvas()} (16:9)`],
          ['Tema del sistema', P.media('(prefers-color-scheme: light)') ? 'Claro' : 'Oscuro'],
          ['Contraste', contrast],
        ]);
      };
      emit();
      P.listen(window, 'resize', emit, signal);
      P.listen(document, 'fullscreenchange', emit, signal);
    }),

    security: infoSource('Ajustes de seguridad', (render) => {
      const state = { storage: '…', persisted: '…', shields: '…' };
      const emit = () =>
        render([
          ['Contexto seguro', isSecureContext ? 'Sí' : 'No'],
          ['Origen', location.origin],
          ['Aislamiento entre orígenes', crossOriginIsolated ? 'Activado' : 'Desactivado'],
          ['Cookies', navigator.cookieEnabled ? 'Permitidas' : 'Bloqueadas'],
          ['Ajustes guardados', savedSettingsText()],
          ['Caché y bases de datos', state.storage],
          ['Almacenamiento persistente', state.persisted],
          ['Protección del navegador', state.shields],
        ]);
      emit();
      const fill = (key, promise) =>
        Promise.resolve(promise)
          .catch(() => null)
          .then((value) => {
            state[key] = value ?? 'No disponible';
            emit();
          });
      fill('storage', navigator.storage?.estimate().then((e) => `${P.bytes(e.usage ?? 0)} usados`));
      fill('persisted', navigator.storage?.persisted().then((p) => (p ? 'Sí' : 'No (el navegador podría borrarlo)')));
      fill('shields', P.isBrave().then((brave) => (brave ? 'Escudos de Brave' : 'La propia del navegador')));
    }),

    network: infoSource('Estado de la red', (render, signal) => {
      const emit = () => {
        const c = navigator.connection;
        render([
          ['Conexión', navigator.onLine ? 'Conectado' : 'Sin conexión'],
          ['Calidad estimada', c?.effectiveType ? c.effectiveType.toUpperCase() : 'No disponible'],
          ['Ancho de banda estimado', c?.downlink != null ? `${P.number(c.downlink, 1)} Mbps` : 'No disponible'],
          ['Latencia estimada', c?.rtt != null ? `${c.rtt} ms` : 'No disponible'],
          ['Ahorro de datos', c ? (c.saveData ? 'Activado' : 'Desactivado') : 'No disponible'],
          ['Servidor del XMB', location.host],
          ['Protocolo', P.navProtocol()],
        ]);
      };
      emit();
      P.listen(window, 'online', emit, signal);
      P.listen(window, 'offline', emit, signal);
      if (navigator.connection) P.listen(navigator.connection, 'change', emit, signal);
    }),

    connectionTest: infoSource('Prueba de conexión', (render, signal) => {
      const emit = (sent, times, done) => {
        const avg = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        let result = '…';
        if (done) result = times.length === PING_COUNT ? 'Correcta' : times.length ? 'Con pérdidas' : 'Sin respuesta';
        render([
          ['Destino', location.protocol === 'app:' ? 'La propia app (app://)' : `${location.host} (servidor local)`],
          ['Progreso', done ? 'Completada' : `Enviando ${sent} de ${PING_COUNT}…`],
          ['Respuestas', `${times.length} de ${sent}`],
          ['Latencia media', times.length ? `${P.number(avg, 1)} ms` : '—'],
          ['Mínima · máxima', times.length ? `${P.number(Math.min(...times), 1)} · ${P.number(Math.max(...times), 1)} ms` : '—'],
          ['Resultado', result],
          ['Internet', navigator.onLine ? 'Disponible según el sistema (no se prueba)' : 'Sin conexión'],
        ]);
      };
      emit(0, [], false);
      P.pingServer(PING_COUNT, signal, (sent, times) => emit(sent, times, false)).then((times) => {
        if (times) emit(PING_COUNT, times, true);
      });
    }),

    accessories: infoSource('Ajustes de accesorios', (render, signal) => {
      const state = { keyboard: '…' };
      const emit = () => {
        const pads = P.connectedPads();
        let pointer = 'Ninguno';
        if (P.media('(pointer: fine)')) pointer = 'Ratón o panel de precisión';
        else if (P.media('(pointer: coarse)')) pointer = 'Táctil';
        render([
          ['Mandos', P.padsText()],
          ['Vibración del mando', !pads.length ? '—' : pads.some((p) => p.vibrationActuator) ? 'Compatible' : 'No compatible'],
          ['Teclado', state.keyboard],
          ['Puntero', pointer],
          ['Pantalla táctil', navigator.maxTouchPoints > 0 ? `Sí (${navigator.maxTouchPoints} puntos)` : 'No'],
        ]);
      };
      emit();
      P.keyboardLayout().then((k) => {
        state.keyboard = k;
        emit();
      });
      P.listen(window, 'gamepadconnected', emit, signal);
      P.listen(window, 'gamepaddisconnected', emit, signal);
    }),
  };
}

// Fondo animado del XMB: canvas WebGL2 a pantalla completa.
import vertexSource from '../shaders/background.vert?raw';
import fragmentSource from '../shaders/background.frag?raw';
import { RENDER } from '../config/render.js';
import { getConfig, onConfigChange } from '../config/config.js';
import { hexToRgb } from '../config/color.js';
import { createFrameLoop } from './frameLoop.js';

const CONTEXT_OPTIONS = {
  alpha: false,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
};

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Error compilando shader:\n${log}`);
  }
  return shader;
}

function createProgram(gl) {
  const vs = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) {
    throw new Error(`Error enlazando programa:\n${gl.getProgramInfoLog(program)}`);
  }
  return program;
}

/**
 * Crea el fondo sobre `canvas`. Devuelve null si no hay WebGL2
 * (el CSS deja entonces un degradado estático como alternativa).
 */
export function createBackground(canvas) {
  const gl = canvas.getContext('webgl2', CONTEXT_OPTIONS);
  if (!gl) {
    document.documentElement.classList.add('no-webgl');
    return null;
  }

  let program = null;
  let uniforms = null;
  let sizeDirty = true;
  let time = 0;
  let frames = 0;
  let paused = false;

  const target = hexToRgb(getConfig('backgroundColor'));
  const current = [...target];

  function init() {
    program = createProgram(gl);
    uniforms = {
      resolution: gl.getUniformLocation(program, 'uResolution'),
      time: gl.getUniformLocation(program, 'uTime'),
      color: gl.getUniformLocation(program, 'uColor'),
    };
    gl.bindVertexArray(gl.createVertexArray());
    gl.useProgram(program);
    sizeDirty = true;
  }

  // Tamaño de dibujo: la ventana con devicePixelRatio limitado.
  function targetSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, RENDER.maxPixelRatio);
    return [Math.max(1, Math.round(window.innerWidth * dpr)), Math.max(1, Math.round(window.innerHeight * dpr))];
  }

  function resize() {
    const [width, height] = targetSize();
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.resolution, width, height);
    sizeDirty = false;
  }

  function draw(dt) {
    if (sizeDirty) resize();
    time += dt * RENDER.waveSpeed;

    // Fundido exponencial hacia el color objetivo.
    const k = 1 - Math.exp(-dt / RENDER.colorTransitionTau);
    for (let i = 0; i < 3; i++) current[i] += (target[i] - current[i]) * k;

    gl.uniform1f(uniforms.time, time);
    gl.uniform3f(uniforms.color, current[0], current[1], current[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++;
  }

  const loop = createFrameLoop(RENDER.backgroundFps, draw);

  function syncRunning() {
    if (paused || document.hidden || gl.isContextLost()) loop.stop();
    else loop.start();
  }

  init();
  syncRunning();

  window.addEventListener('resize', () => {
    sizeDirty = true;
  });
  document.addEventListener('visibilitychange', syncRunning);
  onConfigChange('backgroundColor', (hex) => {
    target.splice(0, 3, ...hexToRgb(hex));
  });

  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); // permite que el navegador lo restaure
    loop.stop();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    init();
    syncRunning();
  });

  return {
    /** Fotogramas dibujados desde el inicio (para medir el tope de fps). */
    get frames() {
      return frames;
    },
    get running() {
      return loop.running;
    },
    /** Resolución de dibujo (ya con el tope de devicePixelRatio). */
    get renderSize() {
      return targetSize();
    },
    /** Nombre de la GPU según WebGL, o null si el navegador lo oculta. */
    gpuRenderer() {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null;
    },
    /** Detiene o reanuda el dibujo (p. ej. mientras lo tapa la pantalla de encendido). */
    setPaused(value) {
      paused = value;
      syncRunning();
    },
    /** Tiempo de la animación en segundos (asignable para depurar). */
    get time() {
      return time;
    },
    set time(seconds) {
      time = seconds;
    },
  };
}

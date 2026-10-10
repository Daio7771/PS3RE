#version 300 es
// Fondo del XMB: degradado del color base + cintas de luz translúcidas que
// ondulan despacio + motas brillantes que flotan alrededor de la onda.
precision highp float;

uniform vec2 uResolution; // tamaño del canvas en píxeles
uniform float uTime;      // segundos (sólo avanza mientras se dibuja)
uniform vec3 uColor;      // color base, sRGB 0..1

out vec4 outColor;

const float TAU = 6.28318530718;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

// Degradado del color base: más claro arriba, más oscuro abajo, con un
// ligero sesgo diagonal y viñeteado suave.
vec3 backdrop(vec2 uv, vec3 base) {
  float g = clamp(uv.y * 0.82 + (1.0 - uv.x) * 0.18, 0.0, 1.0);
  vec3 dark = base * 0.46;
  vec3 light = base * 1.10 + 0.05;
  vec3 col = mix(dark, light, smoothstep(0.0, 1.0, g));
  vec2 q = uv - 0.5;
  col *= 1.0 - 0.7 * dot(q, q);
  return col;
}

// Línea central de una cinta (suma de senos inconmensurables → nunca se repite).
float ribbonCenter(float x, float t, float base, float amp, float seed) {
  return base + amp * (0.58 * sin(x * 4.4 + t * 0.18 + seed)
                     + 0.30 * sin(x * 7.9 - t * 0.13 + seed * 2.3)
                     + 0.12 * sin(x * 12.1 + t * 0.23 + seed * 4.1));
}

// Cinta translúcida que se retuerce. `twist` es el semiancho con signo:
// al pasar por 0 la cinta se ve de canto y se concentra en una línea brillante.
// Dentro es lechosa (se ve "de frente") y brilla hacia los bordes, como el
// reflejo rasante sobre una lámina de seda.
//   shape = (altura base, amplitud, semiancho máx., semilla)
//   look  = (radio del halo, peso del filo nítido, opacidad del interior)
float ribbon(float x, float y, float t, vec4 shape, vec3 look, float px) {
  float seed = shape.w;
  float c = ribbonCenter(x, t, shape.x, shape.y, seed);
  float twist = 0.30 + 0.70 * sin(x * 3.3 - t * 0.11 + seed * 1.3
                                  + 0.6 * sin(x * 1.7 + t * 0.07 + seed));
  float hw = max(abs(twist) * shape.z, px);
  float d = y - c;
  float ad = abs(d);

  float facing = 1.0 - abs(twist);            // 1 = de canto, 0 = de frente
  float haze = look.z * (0.55 + 0.45 * facing);
  float inside = haze + (1.0 - haze) * pow(clamp(ad / hw, 0.0, 1.0), 4.0);

  float o = max(ad - hw, 0.0);
  float outside = look.y * exp(-o / (2.0 * px)) + (1.0 - look.y) * exp(-o / look.x);

  float light = mix(inside, outside, step(hw, ad));
  float upper = mix(0.75, 1.0, step(0.0, d)); // borde superior algo más vivo
  return light * upper;
}

// Motas: una por celda (no todas), derivan y titilan cerca de la onda.
float sparkles(vec2 p, float t, float band, float px) {
  const float CELL = 0.045;
  vec2 q = p + vec2(t * 0.010, 0.0);
  vec2 id = floor(q / CELL);
  vec2 f = fract(q / CELL);
  vec2 r = hash22(id);
  if (r.x > 0.14) return 0.0;
  vec2 r2 = hash22(id + 17.31);
  vec2 pos = 0.22 + 0.56 * r2
           + 0.14 * vec2(sin(t * 0.37 + r.y * TAU), cos(t * 0.29 + r2.x * TAU));
  float dpx = length((f - pos) * CELL) / px;
  float core = exp(-dpx * dpx * 0.55);
  float tw = 0.5 + 0.5 * sin(t * (0.7 + 1.6 * r.y) + r2.y * TAU);
  tw *= tw * tw;
  float near = exp(-pow((p.y - band) / 0.13, 2.0));
  return core * tw * near;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  float px = 1.0 / uResolution.y;
  float x = uv.x;
  float y = uv.y - 0.5;
  float t = uTime;

  vec3 base = uColor;
  vec3 col = backdrop(uv, base);

  float w = 0.0;
  // Cinta principal, un filo fino más rápido y una lámina ancha y tenue detrás.
  w += 0.52 * ribbon(x, y, t,        vec4(-0.035, 0.085, 0.075, 0.0), vec3(0.022, 0.40, 0.22), px);
  w += 0.34 * ribbon(x, y, t * 1.20, vec4(-0.015, 0.100, 0.012, 2.7), vec3(0.012, 0.55, 0.30), px);
  w += 0.22 * ribbon(x, y, t * 0.80, vec4(-0.060, 0.060, 0.160, 5.3), vec3(0.045, 0.12, 0.22), px);

  // Halo amplio alrededor de la onda.
  float mid = ribbonCenter(x, t, -0.035, 0.085, 0.0);
  w += 0.07 * exp(-pow((y - mid) / 0.20, 2.0));

  w += 0.85 * sparkles(vec2(x * aspect, y), t, mid, px);

  vec3 tint = mix(vec3(1.0), base * 0.4 + 0.6, 0.35);
  col += (1.0 - col) * tint * clamp(w, 0.0, 1.0); // mezcla "trama" (screen)

  // Tramado triangular para evitar bandas en el degradado.
  vec2 fc = gl_FragCoord.xy;
  col += (hash12(fc) + hash12(fc + 71.7) - 1.0) / 255.0;

  outColor = vec4(col, 1.0);
}

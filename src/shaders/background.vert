#version 300 es
// Triángulo a pantalla completa generado a partir de gl_VertexID (sin buffers).
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}

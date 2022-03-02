precision mediump float;

uniform float u_alpha;

void main() {
  gl_FragColor = vec4(0.0, 1.0, 0.0, u_alpha);
}
precision mediump float;

uniform vec2 u_resolution;
uniform float u_numSides;

attribute float a_vertexID;
attribute vec2 a_center;
attribute float a_radius;

#define PI 3.14159265
#define THICKNESS 1.0

void main() {
  float i = floor(a_vertexID / 2.0);
  float j = floor(mod(a_vertexID, 2.0));

  float halfThickness = THICKNESS / a_radius / 2.0;
  float outerThickness = 1.0 + halfThickness;
  float innerThickness = 1.0 - halfThickness;

  float step = 2.0 * PI / u_numSides;
  float angle = i * step;
  vec2 cur = vec2(cos(angle), sin(angle));
  vec2 inner = cur * innerThickness;
  vec2 outer = cur * outerThickness;
  vec2 position = float(j < 0.5) * inner + float(0.5 < j) * outer;

  position = position * a_radius + a_center;
  vec2 normalizedPosition = ((position / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = vec4(normalizedPosition, 0.0, 1.0);
}
precision mediump float;

uniform vec2 u_resolution;
uniform vec2 u_start;
uniform vec2 u_end;

attribute float a_vertexID;

#define THICKNESS 2.0

void main() {
  vec2 v = u_end - u_start;
  vec2 norm = normalize(v) * (THICKNESS / 2.0);
  vec2 norm1 = mat2(0.0, -1.0, 1.0, 0.0) * norm;
  vec2 norm2 = mat2(0.0, 1.0, -1.0, 0.0) * norm;

  vec2 position = float(a_vertexID < 0.5) * (u_start + norm1)
              + float(0.5 < a_vertexID && a_vertexID < 1.5) * (u_start + norm2)
              + float(1.5 < a_vertexID && a_vertexID < 2.5) * (u_end + norm1)
              + float(2.5 < a_vertexID && a_vertexID < 3.5) * (u_end + norm2);

  vec2 normalizedPosition = ((position / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = vec4(normalizedPosition, 0.0, 1.0);
}
precision mediump float;

uniform vec2 u_resolution;
uniform vec2 u_start;
uniform vec2 u_end;

attribute float a_vertexID;

#define THICKNESS 1.0
#define ONE_OVER_SQRT_3 0.5773502691896258

void main() {
  vec2 v = u_end - u_start;
  vec2 norm_v = normalize(v);
  float length_v = length(v);
  float h = min(0.1 * length_v, 16.0);
  float a = ONE_OVER_SQRT_3 * h;
  vec2 end = u_end - h * norm_v;

  vec2 rect_v = norm_v * (THICKNESS / 2.0);
  vec2 rect_1 = mat2(0.0, -1.0, 1.0, 0.0) * rect_v;
  vec2 rect_2 = mat2(0.0, 1.0, -1.0, 0.0) * rect_v;

  vec2 tri_v = norm_v * a;
  vec2 tri_1 = mat2(0.0, -1.0, 1.0, 0.0) * tri_v;
  vec2 tri_2 = mat2(0.0, 1.0, -1.0, 0.0) * tri_v;

  vec2 position = float(a_vertexID < 0.5) * (u_start + rect_1)
              + float(0.5 < a_vertexID && a_vertexID < 1.5) * (u_start + rect_2)
              + float(1.5 < a_vertexID && a_vertexID < 2.5) * (end + rect_1)
              + float(2.5 < a_vertexID && a_vertexID < 3.5) * (end + rect_2)
              + float(3.5 < a_vertexID && a_vertexID < 4.5) * (end + tri_1)
              + float(4.5 < a_vertexID && a_vertexID < 5.5) * (end + tri_2)
              + float(5.5 < a_vertexID && a_vertexID < 6.5) * u_end;

  vec2 normalizedPosition = ((position / u_resolution) * 2.0 - 1.0) * vec2(1.0, -1.0);
  gl_Position = vec4(normalizedPosition, 0.0, 1.0);
}
export function makeProgram(gl, vertexShaderSrc, fragmentShaderSrc) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexShaderSrc);
  gl.compileShader(vertexShader);

  if (gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.log("vertex shader compiled successfully");
  } else {
    console.log("error while compiling vertex shader");
  }

  console.log(gl.getShaderInfoLog(vertexShader));

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, fragmentShaderSrc);
  gl.compileShader(fragmentShader);

  if (gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.log("fragment shader compiled successfully");
  } else {
    console.log("error while compiling fragment shader");
  }

  console.log(gl.getShaderInfoLog(fragmentShader)); 

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  return program;  
}
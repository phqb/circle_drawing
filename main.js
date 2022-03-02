import { add, sub, exp, mul, abs } from './complex.js';
import { fourierCycles } from './fourierCycles.js';
import { makeProgram } from './webglutils.js';
import init, { wasm_image_to_cycle } from './lib/oneliner/oneliner.js';

const canvas = document.getElementById('canvas');
const imageCanvas = document.getElementById('imageCanvas');
const imageChooser = document.getElementById('image');
const imageElement = document.getElementById('imageElement');
const followCheckbox = document.getElementById('follow');
followCheckbox.checked = false;
const centerButton = document.getElementById('center');
const seekBar = document.getElementById('time');
const pauseButton = document.getElementById('pause');
const description = document.getElementById('desc');

const gresture = new Hammer.Manager(canvas, { recognizers: [[Hammer.Pan]] });

const rgb_to_grayscale = (r, g, b) => Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

let stopper;

Promise.all([
  fetch('shaders/circle_vert.glsl'),
  fetch('shaders/circle_frag.glsl'),
  fetch('shaders/line_vert.glsl'),
  fetch('shaders/line_frag.glsl'),
  fetch('shaders/arrow_vert.glsl'),
  fetch('shaders/arrow_frag.glsl'),
].map((fut) => fut.then((resp) => resp.text()))).then(async (shaders) => {
  const [circleVert, circleFrag, lineVert, lineFrag, arrowVert, arrowFrag] = shaders;

  const [width, height] = [window.innerWidth, window.innerHeight];

  canvas.width = width;
  canvas.height = height;

  const gl = canvas.getContext("webgl");
  const ext = gl.getExtension('ANGLE_instanced_arrays');

  const circleProgram = makeProgram(gl, circleVert, circleFrag);
  const lineProgram = makeProgram(gl, lineVert, lineFrag);
  const arrowProgram = makeProgram(gl, arrowVert, arrowFrag);

  await init();

  const processImageThenDraw = (data, width, height) => {
    // convert image to grayscale
    const input = new Uint8Array(height * width);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      input[i / 4] = rgb_to_grayscale(r, g, b);
    }

    const points = wasm_image_to_cycle(input, height, width, 1, 5, 20, 300);

    // centering the image
    const maxSide = Math.max(width, height);
    const padX = (width < height) * (maxSide - width) / 2;
    const padY = (height < width) * (maxSide - height) / 2;

    // calculate x coords and y coords
    const xs = [];
    const ys = [];
    for (let i = 0; i < points.length; i += 2) {
      const x = points[i];
      const y = points[i + 1];
      xs.push((x + padX) / maxSide);
      ys.push((y + padY) / maxSide);
    }

    description.style.display = 'none';

    if (stopper) stopper();
    stopper = startDraw(xs, ys);
  };

  if (imageChooser) {
    imageChooser.onchange = async () => {
      if (imageChooser.files && imageChooser.files.length == 1) {
        if (window.createImageBitmap) {
          const image = await window.createImageBitmap(imageChooser.files[0]);
          const { height, width } = image;

          if (height < 50 || width < 50) {
            alert(`The image is too small (${width}x${height})!`);
            return;
          }

          imageCanvas.width = width;
          imageCanvas.height = height;

          const imageCtx = imageCanvas.getContext('2d');
          imageCtx.drawImage(image, 0, 0, width, height);
          const data = imageCtx.getImageData(0, 0, width, height).data;

          processImageThenDraw(data, width, height);
        } else {
          const imageReader = new FileReader();
          imageReader.onload = (e) => {
            imageElement.src = e.target.result;
            imageElement.onload = () => {
              const { height, width } = imageElement;

              if (height < 50 || width < 50) {
                alert(`The image is too small (${width}x${height})!`);
                return;
              }

              imageCanvas.width = width;
              imageCanvas.height = height;

              const imageCtx = imageCanvas.getContext('2d');
              imageCtx.drawImage(imageElement, 0, 0, width, height);
              const data = imageCtx.getImageData(0, 0, width, height).data;

              processImageThenDraw(data, width, height);
            };
          };
          imageReader.readAsDataURL(imageChooser.files[0]);
        }
      }
    };
  }

  let followEndPoint = false;
  followCheckbox.onchange = () => {
    followEndPoint = followCheckbox.checked;
  };

  function startDraw(xs, ys) {
    const [zero, pos, neg] = fourierCycles(xs, ys);

    const numCircles = 2 * Math.min(pos.length, neg.length);

    const circleNumSides = 64;
    const circleVertexIds = new Float32Array(circleNumSides * 2 + 2);
    circleVertexIds.forEach((_, i) => {
      circleVertexIds[i] = i;
    });

    const circleRadiuses = new Float32Array(numCircles);
    const circleCenters = new Float32Array(2 * numCircles);
    const lineVertexIds = new Float32Array([0, 1, 2, 3]);
    const arrowVertexIds = new Float32Array([0, 1, 2, 3, 4, 5, 6]);

    const circleVertexIdAttrib = gl.getAttribLocation(circleProgram, "a_vertexID");
    const circleVertexIdBuffer = gl.createBuffer();

    const circleRadiusAttrib = gl.getAttribLocation(circleProgram, "a_radius");
    const circleRadiusBuffer = gl.createBuffer();

    const circleCenterAttrib = gl.getAttribLocation(circleProgram, "a_center");
    const circleCenterBuffer = gl.createBuffer();

    const circleResolutionUniform = gl.getUniformLocation(circleProgram, "u_resolution");
    const circleNumSidesUniform = gl.getUniformLocation(circleProgram, "u_numSides");

    const lineVertexIdAttrib = gl.getAttribLocation(lineProgram, "a_vertexID");
    const lineVertexIdBuffer = gl.createBuffer();

    const lineStartUniform = gl.getUniformLocation(lineProgram, "u_start");
    const lineEndUniform = gl.getUniformLocation(lineProgram, "u_end");
    const lineResolutionUniform = gl.getUniformLocation(lineProgram, "u_resolution");

    const arrowVertexIdAttrib = gl.getAttribLocation(arrowProgram, "a_vertexID");
    const arrowVertexIdBuffer = gl.createBuffer();

    const arrowStartUniform = gl.getUniformLocation(arrowProgram, "u_start");
    const arrowEndUniform = gl.getUniformLocation(arrowProgram, "u_end");
    const arrowResolutionUniform = gl.getUniformLocation(arrowProgram, "u_resolution");

    function drawLine(start_x, start_y, end_x, end_y) {
      gl.uniform2f(lineStartUniform, start_x, start_y);
      gl.uniform2f(lineEndUniform, end_x, end_y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function drawArrow(start_x, start_y, end_x, end_y) {
      gl.uniform2f(arrowStartUniform, start_x, start_y);
      gl.uniform2f(arrowEndUniform, end_x, end_y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 7);
    }

    gl.useProgram(circleProgram);
    gl.uniform2f(circleResolutionUniform, canvas.width, canvas.height);
    gl.uniform1f(circleNumSidesUniform, circleNumSides);

    gl.useProgram(lineProgram);
    gl.uniform2f(lineResolutionUniform, canvas.width, canvas.height);

    gl.useProgram(arrowProgram);
    gl.uniform2f(arrowResolutionUniform, canvas.width, canvas.height);

    const minSide = Math.min(width, height);
    const duration = 128 * xs.length;
    seekBar.max = duration;

    let prevTimestamp;
    let t = 0;
    let zoom = 1;
    let follow = [0.5, 0.5];
    let translate = [0, 0];
    let lastTranslate = [0, 0];
    let pausing = false;
    let stopped = false;

    const transform = (p) => {
      const s = zoom * minSide;
      const t = [width / 2 - follow[0] * s, height / 2 - follow[1] * s];
      return [p[0] * s + t[0] + translate[0], p[1] * s + t[1] + translate[1]];
    };

    function f(t) {
      const twoPIMulT = 2 * Math.PI * t / duration;
      let r = zero;
      for (let c = 1, n = Math.min(pos.length, neg.length); c <= n; c += 1) {
        r = add(r, mul(pos[c - 1], exp([0, c * twoPIMulT])));
        r = add(r, mul(neg[c - 1], exp([0, -c * twoPIMulT])));
      }
      return r;
    }

    const points = [];
    for (let t = 0; t < duration; t += 16) {
      points.push(f(t));
    }

    const render = (timestamp) => {
      if (stopped) return;

      if (!prevTimestamp) prevTimestamp = timestamp;
      const delta = timestamp - prevTimestamp;
      prevTimestamp = timestamp;

      if (t > duration) t = 0;

      seekBar.value = t;

      const twoPIMulT = 2 * Math.PI * t / duration;

      const centers = [zero];
      let r = zero;
      for (let c = 1, n = Math.min(pos.length, neg.length); c <= n; c += 1) {
        r = add(r, mul(pos[c - 1], exp([0, c * twoPIMulT])));
        centers.push(r);
        r = add(r, mul(neg[c - 1], exp([0, -c * twoPIMulT])));
        centers.push(r);
      }

      // points.push(r);
      if (followEndPoint) {
        follow = [r[0], r[1]];
      }

      for (let i = 0, n = centers.length - 1; i < n; i += 1) {
        const from = transform(centers[i]);
        const to = transform(centers[i + 1]);
        const radius = abs(sub(to, from));
        circleCenters[i * 2] = from[0];
        circleCenters[i * 2 + 1] = from[1];
        circleRadiuses[i] = radius;
      }

      // enable alpha blending
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendEquation(gl.FUNC_ADD);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(circleProgram);

      gl.bindBuffer(gl.ARRAY_BUFFER, circleVertexIdBuffer);
      gl.enableVertexAttribArray(circleVertexIdAttrib);
      gl.vertexAttribPointer(circleVertexIdAttrib, 1, gl.FLOAT, false, 0, 0);
      ext.vertexAttribDivisorANGLE(circleVertexIdAttrib, 0);

      gl.bufferData(gl.ARRAY_BUFFER, circleVertexIds, gl.STATIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, circleRadiusBuffer);
      gl.enableVertexAttribArray(circleRadiusAttrib);
      gl.vertexAttribPointer(circleRadiusAttrib, 1, gl.FLOAT, false, 0, 0);
      ext.vertexAttribDivisorANGLE(circleRadiusAttrib, 1);

      gl.bufferData(gl.ARRAY_BUFFER, circleRadiuses, gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, circleCenterBuffer);
      gl.enableVertexAttribArray(circleCenterAttrib);
      gl.vertexAttribPointer(circleCenterAttrib, 2, gl.FLOAT, false, 0, 0);
      ext.vertexAttribDivisorANGLE(circleCenterAttrib, 1);

      gl.bufferData(gl.ARRAY_BUFFER, circleCenters, gl.DYNAMIC_DRAW);

      ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, circleNumSides * 2 + 2, numCircles);

      gl.useProgram(arrowProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, arrowVertexIdBuffer);
      gl.enableVertexAttribArray(arrowVertexIdAttrib);
      gl.vertexAttribPointer(arrowVertexIdAttrib, 1, gl.FLOAT, false, 0, 0);
      // set divisor to 0 prevent the "attempt to draw with all attributes having non-zero divisors" error
      ext.vertexAttribDivisorANGLE(arrowVertexIdAttrib, 0);
      gl.bufferData(gl.ARRAY_BUFFER, arrowVertexIds, gl.STATIC_DRAW);

      for (let i = 0, n = centers.length - 1; i < n; i += 1) {
        const from = transform(centers[i]);
        const to = transform(centers[i + 1]);
        drawArrow(from[0], from[1], to[0], to[1]);
      }

      gl.useProgram(lineProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineVertexIdBuffer);
      gl.enableVertexAttribArray(lineVertexIdAttrib);
      gl.vertexAttribPointer(lineVertexIdAttrib, 1, gl.FLOAT, false, 0, 0);
      // set divisor to 0 prevent the "attempt to draw with all attributes having non-zero divisors" error
      ext.vertexAttribDivisorANGLE(lineVertexIdAttrib, 0);
      gl.bufferData(gl.ARRAY_BUFFER, lineVertexIds, gl.STATIC_DRAW);

      const n = Math.min(t / 16, points.length);
      for (let i = 0; i < n; i += 1) {
        const from = transform(points[i]);
        let to;
        if (i + 1 < n) {
          to = transform(points[i + 1]);
        } else {
          to = transform(r);
        }
        drawLine(from[0], from[1], to[0], to[1]);
      }

      if (!pausing) t += delta;

      window.requestAnimationFrame(render);
    };

    window.requestAnimationFrame(render);

    canvas.onwheel = (ev) => {
      zoom = Math.min(Math.max(0.125, zoom + ev.deltaY * -0.01), 1000);
    };

    centerButton.onclick = () => {
      follow = [0.5, 0.5];
      translate = [0, 0];
      lastTranslate = [0, 0];
    };

    gresture.on('pan', (ev) => {
      translate[0] = lastTranslate[0] + ev.deltaX;
      translate[1] = lastTranslate[1] + ev.deltaY;
      if (ev.isFinal) {
        lastTranslate[0] += ev.deltaX;
        lastTranslate[1] += ev.deltaY;
      }
    });

    pauseButton.onclick = () => { pausing = !pausing; };

    seekBar.oninput = (ev) => {
      pausing = true;
      t = Math.max(0, Math.min(seekBar.value, duration));
      pausing = false;
    };

    return () => {
      stopped = true;
    }
  }
})
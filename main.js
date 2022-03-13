import { add, sub, exp, mul, abs } from './complex.js';
import { fourierCycles } from './fourierCycles.js';
import { makeProgram } from './webglutils.js';
import init, { wasm_image_to_cycle } from './lib/oneliner/oneliner.js';
import { compress2d, decompress2d } from './lib/zfp_wasm/zfp.js';

const canvas = document.getElementById('canvas');
const imageCanvas = document.getElementById('imageCanvas');
const inputFileChooser = document.getElementById('image');
const imageElement = document.getElementById('imageElement');
const followCheckbox = document.getElementById('follow');
followCheckbox.checked = false;
const centerButton = document.getElementById('center');
const seekBar = document.getElementById('time');
const pauseButton = document.getElementById('pause');
const examples = document.getElementById('examples');
const numCirclesLabel = document.getElementById('numCircles');
const numCirclesSlider = document.getElementById('numCirclesSlider');
const description = document.getElementById('desc');
const control = document.getElementById('control');
const share = document.getElementById('share');
const exportBtn = document.getElementById('export');

const gresture = new Hammer.Manager(canvas, { recognizers: [[Hammer.Pan]] });

const rgb_to_grayscale = (r, g, b) => Math.floor(0.299 * r + 0.587 * g + 0.114 * b);

const alpha = (t) => Math.max(0.15, 3 * t * t * t - 2 * t * t);

const clampDimensions = (width, height, maxSide) => {
  const ratio = maxSide / Math.max(width, height, maxSide);
  return [Math.trunc(width * ratio), Math.trunc(height * ratio)];
};

const GRAPH_DELTA_TIME = 64;

let stopper;

Promise.all([
  fetch('shaders/circle_vert.glsl').then((r) => r.text()),
  fetch('shaders/circle_frag.glsl').then((r) => r.text()),
  fetch('shaders/line_vert.glsl').then((r) => r.text()),
  fetch('shaders/line_frag.glsl').then((r) => r.text()),
  fetch('shaders/arrow_vert.glsl').then((r) => r.text()),
  fetch('shaders/arrow_frag.glsl').then((r) => r.text()),
  ZfpModule(),
]).then(async ([circleVert, circleFrag, lineVert, lineFrag, arrowVert, arrowFrag, zfp]) => {
  const [width, height] = [window.innerWidth, window.innerHeight];

  canvas.width = width;
  canvas.height = height;

  const gl = canvas.getContext("webgl");
  const ext = gl.getExtension('ANGLE_instanced_arrays');

  const circleProgram = makeProgram(gl, circleVert, circleFrag);
  const lineProgram = makeProgram(gl, lineVert, lineFrag);
  const arrowProgram = makeProgram(gl, arrowVert, arrowFrag);

  await init();

  examples.onclick = (e) => {
    if (e.target.tagName == "IMG") {
      imageElement.src = e.target.src;
      imageElement.onload = () => {
        inputFileChooser.disabled = true;

        const [width, height] = clampDimensions(imageElement.width, imageElement.height, 1000);

        imageCanvas.width = width;
        imageCanvas.height = height;

        const imageCtx = imageCanvas.getContext('2d');
        imageCtx.drawImage(imageElement, 0, 0, imageElement.width, imageElement.height, 0, 0, width, height);
        const data = imageCtx.getImageData(0, 0, width, height).data;

        processImageThenDraw(data, width, height);
      };
    }
  };

  const processImageThenDraw = (data, width, height) => {
    const [xs, ys] = imageToCoffs(data, width, height);
    if (xs && ys) prepareDraw(xs, ys);
  };

  const imageToCoffs = (data, width, height) => {
    // convert image to grayscale
    const input = new Uint8Array(height * width);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      input[i / 4] = rgb_to_grayscale(r, g, b);
    }

    const points = wasm_image_to_cycle(input, height, width, 1, 5, 20, 200);

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

    if (xs.length > 0) {
      const shift = fourierCycles(xs, ys);
      return [xs.slice(0, 2 * shift + 1), ys.slice(0, 2 * shift + 1)];
    }
  };

  const prepareDraw = (xs, ys) => {
    if (xs.length != ys.length) return;
    if (xs.length % 2 == 0) return;

    const exported = [];
    for (let i = 0; i < xs.length; i += 1) exported.push([xs[i], ys[i]]);
    const encodedData = encodeURIComponent(JSON.stringify(exported, null, 2));
    exportBtn.setAttribute('href', 'data:text/json;charset=utf-8,' + encodedData);
    exportBtn.setAttribute('download', 'coffs.json');

    const shift = xs.length >> 1;

    const zero = [xs[shift], ys[shift]];
    const pos = [];
    for (let i = shift + 1; i < 2 * shift + 1; i += 1) {
      pos.push([xs[i], ys[i]]);
    }
    const neg = [];
    for (let i = shift - 1; i >= 0; i -= 1) {
      neg.push([xs[i], ys[i]]);
    }

    share.onclick = () => {
      const spinner = document.getElementById('shareSpinner');
      spinner.style.display = 'block';
      share.disabled = true;

      const _shift = Math.min(shift, 200);
      const _xs = xs.slice(shift - _shift);
      const _ys = ys.slice(shift - _shift);
      const [nx, ny] = [2 * _shift + 1, 2];
      const nums = new Float32Array(nx * ny);
      nums.set(_xs.slice(0, nx), 0);
      nums.set(_ys.slice(0, nx), nx);

      const compressed = compress2d(zfp, nums, nx, ny, 1e-3);
      const encoded = encodeURIComponent(base64js.fromByteArray(compressed));
      const link = location.protocol + '//' + location.host + location.pathname + '?nx=' + nx + '&d=' + encoded;
      navigator.clipboard.writeText(link);

      new bootstrap.Toast(document.getElementById('shareToast')).show();
      spinner.style.display = 'none';
      share.disabled = false;
    }; 

    if (stopper) stopper();
    stopper = startDraw(zero, pos, neg);
  };

  if (inputFileChooser) {
    inputFileChooser.onchange = async () => {
      if (inputFileChooser.files && inputFileChooser.files.length == 1) {
        inputFileChooser.disabled = true;

        const inputFile = inputFileChooser.files[0];
        if (inputFile.type.toLowerCase() == 'application/json') {
          const jsonReader = new FileReader();
          jsonReader.onload = (e) => {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data)) {
              let valid = true;
              for (const z of data) {
                if (!Array.isArray(z) || z.length != 2 || typeof (z[0]) != 'number' || typeof (z[1]) != 'number') {
                  valid = false;
                  break;
                }
              }
              if (valid) {
                const xs = [], ys = [];
                for (const z of data) {
                  xs.push(z[0]);
                  ys.push(z[1]);
                }
                prepareDraw(xs, ys);
              }
            }
          };
          jsonReader.readAsText(inputFile);
        } else {
          if (window.createImageBitmap) {
            const image = await window.createImageBitmap(inputFile);

            if (image.height < 50 || image.width < 50) {
              alert(`The image is too small (${image.width}x${image.height})!`);
              return;
            }

            const [width, height] = clampDimensions(image.width, image.height, 1000);

            imageCanvas.width = width;
            imageCanvas.height = height;

            const imageCtx = imageCanvas.getContext('2d');
            imageCtx.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
            const data = imageCtx.getImageData(0, 0, width, height).data;

            processImageThenDraw(data, width, height);
          } else {
            const imageReader = new FileReader();
            imageReader.onload = (e) => {
              imageElement.src = e.target.result;
              imageElement.onload = () => {
                if (imageElement.height < 50 || imageElement.width < 50) {
                  alert(`The image is too small (${imageElement.width}x${imageElement.height})!`);
                  return;
                }

                const [width, height] = clampDimensions(imageElement.width, imageElement.height, 1000);

                imageCanvas.width = width;
                imageCanvas.height = height;

                const imageCtx = imageCanvas.getContext('2d');
                imageCtx.drawImage(imageElement, 0, 0, imageElement.width, imageElement.height, 0, 0, width, height);
                const data = imageCtx.getImageData(0, 0, width, height).data;

                processImageThenDraw(data, width, height);
              };
            };
            imageReader.readAsDataURL(inputFile);
          }
        }
      }
    };
  }

  let followEndPoint = false;
  followCheckbox.onchange = () => {
    followEndPoint = followCheckbox.checked;
  };

  {
    const params = new URLSearchParams(new URL(window.location).search);
    const nx = parseInt(params.get('nx'));
    const data = params.get('d');

    if (typeof (nx) == 'number' && typeof (data) == 'string') {
      const compressed = base64js.toByteArray(decodeURIComponent(data));
      const nums = decompress2d(zfp, compressed, nx, 2, 1e-3);
      const [xs, ys] = [nums.slice(0, nx), nums.slice(nx)];
      const shift = Math.trunc(nx / 2);
      const zero = [xs[shift], ys[shift]];
      const pos = [];
      const [_xs, _ys] = [xs.slice(shift + 1), ys.slice(shift + 1)];
      for (let i = 0; i < shift; i += 1) pos.push([_xs[i], _ys[i]]);
      const neg = [];
      for (let i = shift - 1; i >= 0; i -= 1) neg.push([xs[i], ys[i]]);

      if (stopper) stopper();
      stopper = startDraw(zero, pos, neg);
    }
  }

  function startDraw(zero, pos, neg) {
    if (pos.length != neg.length) throw 'pos.length must be equal neg.length';

    inputFileChooser.disabled = false;
    examples.style.display = 'none';
    description.style.display = 'none';
    control.style.display = 'block';

    const maxNumCircles = 2 * pos.length;

    const circleNumSides = 64;
    const circleVertexIds = new Float32Array(circleNumSides * 2 + 2);
    circleVertexIds.forEach((_, i) => {
      circleVertexIds[i] = i;
    });

    const circleRadiuses = new Float32Array(maxNumCircles);
    const circleCenters = new Float32Array(2 * maxNumCircles);
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
    const lineAlphaUniform = gl.getUniformLocation(lineProgram, "u_alpha");

    const arrowVertexIdAttrib = gl.getAttribLocation(arrowProgram, "a_vertexID");
    const arrowVertexIdBuffer = gl.createBuffer();

    const arrowStartUniform = gl.getUniformLocation(arrowProgram, "u_start");
    const arrowEndUniform = gl.getUniformLocation(arrowProgram, "u_end");
    const arrowResolutionUniform = gl.getUniformLocation(arrowProgram, "u_resolution");

    function drawLine(start_x, start_y, end_x, end_y, alpha) {
      gl.uniform2f(lineStartUniform, start_x, start_y);
      gl.uniform2f(lineEndUniform, end_x, end_y);
      gl.uniform1f(lineAlphaUniform, alpha);
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
    const duration = 128 * 4 * pos.length;

    let numCircles = maxNumCircles;
    let prevTimestamp;
    let t = 0;
    let zoom = 1;
    let follow = [0.5, 0.5];
    let translate = [0, 0];
    let lastTranslate = [0, 0];
    let pausing = false;
    let stopped = false;
    let firstTimeDone = false;

    const transform = (p) => {
      const s = zoom * minSide;
      const t = [width / 2 - follow[0] * s, height / 2 - follow[1] * s];
      return [p[0] * s + t[0] + translate[0], p[1] * s + t[1] + translate[1]];
    };

    const pointsByNumCircles = [null];
    for (let i = 0; i < numCircles; i += 1) {
      pointsByNumCircles.push([]);
    }

    const _time = performance.now();
    const length = Math.trunc(duration / GRAPH_DELTA_TIME) + 1;
    for (let i = 0; i < length; i += 1) {
      const t = i * GRAPH_DELTA_TIME;
      const twoPIMulT = 2 * Math.PI * t / duration;
      let r = zero;
      for (let c = 1; c <= pos.length; c += 1) {
        r = add(r, mul(pos[c - 1], exp([0, c * twoPIMulT])));
        pointsByNumCircles[2 * c - 1].push(r);
        r = add(r, mul(neg[c - 1], exp([0, -c * twoPIMulT])));
        pointsByNumCircles[2 * c].push(r);
      }
    }
    console.log('took', performance.now() - _time);

    const render = (timestamp) => {
      if (stopped) return;

      if (!prevTimestamp) prevTimestamp = timestamp;
      const delta = timestamp - prevTimestamp;
      prevTimestamp = timestamp;

      if (t > duration) {
        t = 0;
        firstTimeDone = true;
      }

      seekBar.value = t;

      const twoPIMulT = 2 * Math.PI * t / duration;

      const centers = [zero];
      let r = zero;
      let posIndex = 0, negIndex = 0;
      for (let i = 0; i < numCircles; i += 1) {
        if (i % 2 == 0) {
          const c = posIndex + 1;
          r = add(r, mul(pos[posIndex], exp([0, c * twoPIMulT])));
          posIndex += 1;
        } else {
          const c = negIndex + 1;
          r = add(r, mul(neg[negIndex], exp([0, -c * twoPIMulT])));
          negIndex += 1;
        }

        centers.push(r);
      }

      if (followEndPoint) {
        follow = [r[0], r[1]];
      }

      for (let i = 0; i < numCircles; i += 1) {
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

      gl.bufferData(gl.ARRAY_BUFFER, circleRadiuses.slice(0, numCircles), gl.DYNAMIC_DRAW);

      gl.bindBuffer(gl.ARRAY_BUFFER, circleCenterBuffer);
      gl.enableVertexAttribArray(circleCenterAttrib);
      gl.vertexAttribPointer(circleCenterAttrib, 2, gl.FLOAT, false, 0, 0);
      ext.vertexAttribDivisorANGLE(circleCenterAttrib, 1);

      gl.bufferData(gl.ARRAY_BUFFER, circleCenters.slice(0, 2 * numCircles), gl.DYNAMIC_DRAW);

      ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, circleNumSides * 2 + 2, numCircles);

      gl.useProgram(arrowProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, arrowVertexIdBuffer);
      gl.enableVertexAttribArray(arrowVertexIdAttrib);
      gl.vertexAttribPointer(arrowVertexIdAttrib, 1, gl.FLOAT, false, 0, 0);
      // set divisor to 0 prevent the "attempt to draw with all attributes having non-zero divisors" error
      ext.vertexAttribDivisorANGLE(arrowVertexIdAttrib, 0);
      gl.bufferData(gl.ARRAY_BUFFER, arrowVertexIds, gl.STATIC_DRAW);

      for (let i = 0; i < numCircles; i += 1) {
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

      const points = pointsByNumCircles[numCircles];
      if (firstTimeDone) {
        const n = Math.min(Math.trunc(t / GRAPH_DELTA_TIME), points.length - 1);
        for (let i = 0; i < points.length; i += 1) {
          let toIndex = i + n - (points.length - 1);
          if (toIndex < 0) toIndex += points.length;
          let fromIndex = toIndex - 1;
          if (fromIndex < 0) fromIndex += points.length;
          const from = transform(points[fromIndex]);
          const to = transform(points[toIndex]);
          drawLine(from[0], from[1], to[0], to[1], alpha((i + 1) / points.length));
        }
        {
          const from = transform(points[n]);
          const to = transform(r);
          drawLine(from[0], from[1], to[0], to[1], 1);
        }
      } else {
        const n = Math.min(Math.trunc(t / GRAPH_DELTA_TIME), points.length);
        for (let i = 0; i < n; i += 1) {
          const from = transform(points[i]);
          let to;
          if (i + 1 < n) {
            to = transform(points[i + 1]);
          } else {
            to = transform(r);
          }
          drawLine(from[0], from[1], to[0], to[1], alpha((i + points.length - n) / points.length));
        }
      }

      if (!pausing) t += delta;

      window.requestAnimationFrame(render);
    };

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

    numCirclesSlider.max = maxNumCircles;
    numCirclesSlider.value = maxNumCircles;
    numCirclesLabel.textContent = numCircles;

    numCirclesSlider.oninput = () => {
      numCircles = Math.max(1, Math.min(numCirclesSlider.value, maxNumCircles));
      numCirclesSlider.value = numCircles;
      numCirclesLabel.textContent = numCircles;
    };

    pauseButton.onclick = () => { pausing = !pausing; };

    seekBar.max = duration;

    seekBar.oninput = () => {
      const oldPausing = pausing;
      pausing = true;
      t = Math.max(0, Math.min(seekBar.value, duration));
      pausing = oldPausing;
    };

    window.requestAnimationFrame(render);

    return () => {
      stopped = true;
    }
  }
})

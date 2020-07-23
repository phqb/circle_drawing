'use strict';

const Complex = require('complex.js');
const { transform } = require('../lib/fft');

function matrixAdd(a, b) {
  if (a.length != b.length || a[0].length != b[0].length) {
    throw 'Can not add';
  }

  const n_r = a.length;
  const n_c = a[0].length;
  const result = [];

  for (let r = 0; r < n_r; r += 1) {
    result.push([]);
    for (let c = 0; c < n_c; c += 1) {
      result[r].push(a[r][c] + b[r][c]);
    }
  }

  return result;
}

function matrixMul(a, b) {
  if (a[0].length != b.length) {
    throw 'Can not multiply';
  }

  const n_r = a.length;
  const n_c = b[0].length;
  const n = a[0].length;
  const result = [];

  for (let r = 0; r < n_r; r += 1) {
    result.push([]);
    for (let c = 0; c < n_c; c += 1) {
      result[r].push(0);
      for (let k = 0; k < n; k += 1) {
        result[r][c] += a[r][k] * b[k][c];
      }
    }
  }

  return result;
}

function matrixTran(a) {
  const n_r = a.length;
  const n_c = a[0].length;
  const result = [];
  for (let r = 0; r < n_c; r += 1) {
    result.push([]);
    for (let c = 0; c < n_r; c += 1) {
      result[r].push(a[c][r]);
    }
  }
  return result;
}

function fftTransform(zs) {
  const zs_real = zs.map(z => z.re);
  const zs_imag = zs.map(z => z.im);

  transform(zs_real, zs_imag);

  const result = [];
  for (let i = 0, n = zs_real.length; i < n; i += 1) {
    result.push(new Complex({ re: zs_real[i], im: zs_imag[i] }));
  }

  return result;
}

function freqShift(zs, shift) {
  const n = zs.length;
  return zs.map((z, t) => z.mul(new Complex({ re: 0, im: -shift * 2 * Math.PI * t / n }).exp()));
}

function hidpiCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Make canvas's dimension 1.5x larger
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  // Scale canvas 1.5x down
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';

  // Drawing with 1.5x dimension
  canvas.getContext('2d').scale(dpr, dpr);
}

function makeSquarePoints(n_side) {
  const points = [];

  for (let i = 0; i < n_side; i += 1) {
    points.push(new Complex([0, i / n_side]));
  }

  for (let i = 0; i < n_side; i += 1) {
    points.push(new Complex([i / n_side, 1]));
  }

  for (let i = 0; i < 100; i += 1) {
    points.push(new Complex([1, 1 - i / n_side]));
  }

  for (let i = 0; i < 100; i += 1) {
    points.push(new Complex([1 - i / n_side, 0]));
  }

  return points;
}

const squarePoints = makeSquarePoints(100);

const n = squarePoints.length;
const shift = -200;
const bound = Math.min(Math.abs(shift), Math.abs(n - 1 + shift));

const cs = fftTransform(freqShift(squarePoints, shift)).map(z => z.div(n));

const canvas = document.getElementById('canvas');
hidpiCanvas(canvas);
const context = canvas.getContext('2d');

const transformationMatrix = [[500, 0], [0, -500]];
const translationVector = [[50], [550]];

function project(p) {
  const v = matrixAdd(translationVector, matrixMul(transformationMatrix, [[p.re], [p.im]]));
  return new Complex([v[0][0], v[1][0]]);
}

const points = [];

let t = 0;

function draw(delta) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  context.beginPath();
  context.moveTo(0, 0);
  let r = cs[-shift];
  context.lineTo(...project(r).toVector());
  context.stroke();

  for (let c = 1; c <= bound; c += 1) {
    let from = project(r);
    r = r.add(cs[c - shift].mul(new Complex({ re: 0, im: c * 2 * Math.PI * t / 10000 }).exp()));
    let to = project(r);

    context.beginPath();
    context.moveTo(from.re, from.im);
    context.lineTo(to.re, to.im);
    context.stroke();

    context.beginPath();
    context.arc(from.re, from.im, to.sub(from).abs(), 0, 2 * Math.PI);
    context.stroke();

    from = to;
    r = r.add(cs[-c - shift].mul(new Complex({ re: 0, im: -c * 2 * Math.PI * t / 10000 }).exp()));
    to = project(r);

    context.beginPath();
    context.moveTo(from.re, from.im);
    context.lineTo(to.re, to.im);
    context.stroke();

    context.beginPath();
    context.arc(from.re, from.im, to.sub(from).abs(), 0, 2 * Math.PI);
    context.stroke();
  }

  let z = Complex.ZERO;
  for (let c = -bound; c <= bound; c += 1) {
    z = z.add(cs[c - shift].mul(new Complex({ re: 0, im: c * 2 * Math.PI * t / 10000 }).exp()));
  }
  points.push(project(z).toVector());

  for (let i = 1, n = points.length; i < n; i += 1) {
    context.beginPath();
    context.moveTo(...points[i - 1]);
    context.lineTo(...points[i]);
    context.stroke();
  }
}

let prevTimestamp;

function loop(timestamp) {
  if (prevTimestamp == undefined) {
    prevTimestamp = timestamp;
    window.requestAnimationFrame(loop);

    return;
  }

  if (t > 10000) {
    return;
  }

  const delta = timestamp - prevTimestamp;
  if (delta > 1000 / 30) {
    prevTimestamp = timestamp;

    draw(delta);

    t += delta;
  }

  window.requestAnimationFrame(loop);
}

window.requestAnimationFrame(loop);
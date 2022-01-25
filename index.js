'use strict';

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

function div(a, d) {
  return [a[0] / d, a[1] / d];
}

function exp(a) {
  const e = Math.exp(a[0]);
  return [e * Math.cos(a[1]), e * Math.sin(a[1])];
}

function mul(a, b) {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function abs(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

function freqShift(re, im, shift) {
  const n = re.length;
  for (let t = 0; t < n; t += 1) {
    [re[t], im[t]] = mul([re[t], im[t]], exp([0, -shift * 2 * Math.PI * t / n]));
  }
}

function draw(wrapper, canvas, points, t, duration, zero, pos, neg) {
  const ctx = canvas.getContext('2d');
  const [paddingX, paddingY] = [50, 50];
  const rect = wrapper.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  const minSide = Math.min(rect.width, rect.height);
  const translationX = (rect.height < rect.width) * (rect.width - minSide) / 2;
  const translationY = (rect.width < rect.height) * (rect.height - minSide) / 2;

  const scaling = [minSide - paddingX * 2, minSide - paddingY * 2];
  const translation = [translationX + paddingX, translationY + paddingY];

  const transformer = (p) => {
    return [p[0] * scaling[0] + translation[0], p[1] * scaling[1] + translation[1]];
  }

  let r = zero;
  let p = transformer(r);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.moveTo(p[0], p[1]);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';

  const n = Math.min(pos.length, neg.length);
  for (let c = 1; c <= n; c += 1) {
    let from = transformer(r);
    r = add(r, mul(pos[c - 1], exp([0, c * 2 * Math.PI * t / duration])));
    let to = transformer(r);

    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(from[0], from[1], abs(sub(to, from)), 0, 2 * Math.PI);
    ctx.closePath();
    ctx.stroke();

    from = to;
    r = add(r, mul(neg[c - 1], exp([0, -c * 2 * Math.PI * t / duration])));
    to = transformer(r);

    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(from[0], from[1], abs(sub(to, from)), 0, 2 * Math.PI);
    ctx.closePath();
    ctx.stroke();
  }

  let z = mul(zero, exp([0, 0]));
  for (let c = 1; c <= n; c += 1) {
    z = add(z, mul(pos[c - 1], exp([0, c * 2 * Math.PI * t / duration])));
    z = add(z, mul(neg[c - 1], exp([0, -c * 2 * Math.PI * t / duration])));
  }
  points.push(transformer(z));

  ctx.strokeStyle = 'rgb(0, 0, 0)';

  for (let i = 1, n = points.length; i < n; i += 1) {
    ctx.beginPath();
    ctx.moveTo(points[i - 1][0], points[i - 1][1]);
    ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

function makePoints(points, length) {
  const xs = [];
  const ys = [];

  const n = points.length;
  for (let i = 0; i < n; i += 1) {
    const from = points[i];
    const to = points[(i + 1) % n];

    for (let ti = 0; ti < length; ti += 1) {
      const t = ti / length;
      xs.push((1 - t) * from[0] + t * to[0]);
      ys.push((1 - t) * from[1] + t * to[1]);
    }
  }

  return [xs, ys];
}

function makeSquarePoints(length) {
  return makePoints([[0, 0], [0, 1], [1, 1], [1, 0]], length);
}

function makeTrianglePoints(length) {
  return makePoints([[0, 0], [0.5, 1], [1, 0]], length);
}

function makeStarPoints(length) {
  return makePoints([[0, 0], [0.5, 1], [1, 0], [0, 0.6], [1, 0.6]], length);
}

function startDraw(wrapper, canvas, xs, ys) {
  const n = xs.length;
  const shift = n >> 4;
  console.log(n);
  const duration = 20 * n;

  freqShift(xs, ys, -shift);
  transform(xs, ys);

  const zs = [];
  for (let i = 0; i < n; i += 1) {
    const z = [xs[i], ys[i]];
    zs.push(div(z, n));
  }

  const zero = zs[shift];
  const pos = zs.slice(shift + 1);
  const neg = zs.slice(0, shift).reverse();

  let points = [];
  let prevTimestamp;
  let t = 0;

  function loop(timestamp) {
    if (!prevTimestamp) prevTimestamp = timestamp;
    const delta = timestamp - prevTimestamp;

    if (delta > 1000 / 60) {
      if (t > duration) {
        points = [];
        t = 0;
      }

      prevTimestamp = timestamp;

      draw(wrapper, canvas, points, t, duration, zero, pos, neg);

      t += delta;
    }

    window.requestAnimationFrame(loop);
  }

  window.requestAnimationFrame(loop);
}

// const [pointXs, pointYs] = makeSquarePoints(100);
// const [pointXs, pointYs] = makeTrianglePoints(100);
const [pointXs, pointYs] = makeStarPoints(100);
startDraw(document.getElementById('canvas-wrapper'), document.getElementById('canvas'), pointXs, pointYs);

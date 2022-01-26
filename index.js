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

function fourierCycles(xs, ys) {
  const n = xs.length;
  const shift = n >> 4;

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

  return [zero, pos, neg];
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

function makeCabbitPoints() {
  const width = 720;
  const height = 1280;
  const maxSide = Math.max(width, height);
  const padX = (width < height) * (maxSide - width) / 2;
  const padY = (height < width) * (maxSide - height) / 2;
  return [cabbitPoints.map((p) => (p[0] + padX) / maxSide), cabbitPoints.map((p) => (p[1] + padY) / maxSide)];
}

function calcTransformer(wrapper) {
  const [paddingX, paddingY] = [50, 50];
  const rect = wrapper.getBoundingClientRect();

  const minSide = Math.min(rect.width, rect.height);
  const translationX = (rect.height < rect.width) * (rect.width - minSide) / 2;
  const translationY = (rect.width < rect.height) * (rect.height - minSide) / 2;

  const scaling = [minSide - paddingX * 2, minSide - paddingY * 2];
  const translation = [translationX + paddingX, translationY + paddingY];

  return (p) => {
    return [p[0] * scaling[0] + translation[0], p[1] * scaling[1] + translation[1]];
  };
}

function makePixi(wrapper, n) {
  const pixi = new PIXI.Application({
    width: wrapper.getBoundingClientRect().width,
    height: wrapper.getBoundingClientRect().height,
    backgroundColor: 0xffffff,
    antialias: true,
    resolution: 1,
  });

  wrapper.appendChild(pixi.view);

  const container = new PIXI.Graphics();
  pixi.stage.addChild(container);
  const linesContainer = new PIXI.Container();
  container.addChild(linesContainer);
  const circlesContainer = new PIXI.Container();
  container.addChild(circlesContainer);
  const pathContainer = new PIXI.Container();
  container.addChild(pathContainer);

  const posCircles = [];
  const negCircles = [];

  for (let i = 0; i < n; i += 1) {
    const posCircle = new PIXI.Graphics();
    posCircles.push(posCircle);
    circlesContainer.addChild(posCircle);
    const negCircle = new PIXI.Graphics();
    negCircles.push(negCircle);
    circlesContainer.addChild(negCircle);
  }

  return [pixi, container, linesContainer, circlesContainer, pathContainer, posCircles, negCircles];
}

function startDraw(wrapper, xs, ys) {
  const [zero, pos, neg] = fourierCycles(xs, ys);
  const numCircles = Math.min(pos.length, neg.length);
  const [pixi, container, linesContainer, circlesContainer, pathContainer, posCircles, negCircles] = makePixi(wrapper, numCircles);

  const transformer = calcTransformer(wrapper);
  const duration = 2 * xs.length;

  let lastPoint;
  let t = 0;
  let firstTime = true;

  const draw = () => {
    const n = numCircles;

    linesContainer.removeChildren();

    const twoPIMulT = 2 * Math.PI * t / duration;
    let r = zero;

    for (let c = 1; c <= n; c += 1) {
      let from = transformer(r);
      r = add(r, mul(pos[c - 1], exp([0, c * twoPIMulT])));
      let to = transformer(r);

      const posLine = new PIXI.Graphics();
      posLine.lineStyle(1, 0x000000, 0.3);
      posLine.moveTo(from[0], from[1]);
      posLine.lineTo(to[0], to[1]);
      linesContainer.addChild(posLine);

      const posCircle = posCircles[c - 1];
      if (firstTime) {
        posCircle.lineStyle(1, 0x000000, 0.3);
        posCircle.arc(0, 0, abs(sub(to, from)), 0, 2 * Math.PI);
      }
      posCircle.x = from[0];
      posCircle.y = from[1];
      
      from = to;
      r = add(r, mul(neg[c - 1], exp([0, -c * twoPIMulT])));
      to = transformer(r);

      const negLine = new PIXI.Graphics();
      negLine.lineStyle(1, 0x000000, 0.3);
      negLine.moveTo(from[0], from[1]);
      negLine.lineTo(to[0], to[1]);
      linesContainer.addChild(negLine);

      const negCircle = negCircles[c - 1];
      if (firstTime) {
        negCircle.lineStyle(1, 0x000000, 0.3);
        negCircle.arc(0, 0, abs(sub(to, from)), 0, 2 * Math.PI);
      }

      negCircle.x = from[0];
      negCircle.y = from[1];
    }

    let z = mul(zero, exp([0, 0]));
    for (let c = 1; c <= n; c += 1) {
      z = add(z, mul(pos[c - 1], exp([0, c * twoPIMulT])));
      z = add(z, mul(neg[c - 1], exp([0, -c * twoPIMulT])));
    }
    const point = transformer(z);

    if (lastPoint) {
      const p = new PIXI.Graphics();
      p.lineStyle(1, 0x000000, 1);
      p.moveTo(lastPoint[0], lastPoint[1]);
      p.lineTo(point[0], point[1]);
      pathContainer.addChild(p);
    }

    lastPoint = point;
    firstTime = false;
  };

  pixi.ticker.add((delta) => {
    if (t > duration) {
      pathContainer.removeChildren();
      t = 0;
    }

    draw();

    t += delta;
  });
}

// const [pointXs, pointYs] = makeSquarePoints(100);
const [pointXs, pointYs] = makeTrianglePoints(100);
// const [pointXs, pointYs] = makeStarPoints(100);
// const [pointXs, pointYs] = makeCabbitPoints();
startDraw(document.getElementById('wrapper'), pointXs, pointYs);

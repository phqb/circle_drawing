import { cabbitPoints } from './cabbit2.js';

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

export function makeSquarePoints(length) {
  return makePoints([[0, 0], [0, 1], [1, 1], [1, 0]], length);
}

export function makeTrianglePoints(length) {
  return makePoints([[0, 0], [0.5, 1], [1, 0]], length);
}

export function makeStarPoints(length) {
  return makePoints([[0, 0], [0.5, 1], [1, 0], [0, 0.6], [1, 0.6]], length);
}

export function makeCabbitPoints() {
  const width = 720;
  const height = 1280;
  const maxSide = Math.max(width, height);
  const padX = (width < height) * (maxSide - width) / 2;
  const padY = (height < width) * (maxSide - height) / 2;
  return [cabbitPoints.map((p) => (p[0] + padX) / maxSide), cabbitPoints.map((p) => (p[1] + padY) / maxSide)];
}
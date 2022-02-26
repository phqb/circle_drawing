import { div, mul, exp } from './complex.js';

function freqShift(re, im, shift) {
  const n = re.length;
  for (let t = 0; t < n; t += 1) {
    [re[t], im[t]] = mul([re[t], im[t]], exp([0, -shift * 2 * Math.PI * t / n]));
  }
}

export function fourierCycles(xs, ys) {
  const n = xs.length;
  const shift = n >> 2;

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
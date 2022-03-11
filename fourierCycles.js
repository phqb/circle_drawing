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

  for (let i in xs) xs[i] /= n;
  for (let i in ys) ys[i] /= n;

  return shift;
}
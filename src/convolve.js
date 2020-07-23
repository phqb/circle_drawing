const ndarray = require('ndarray');

function convolve2d(output, input, kernel, wrap) {
  if (input.dimension != 2 || kernel.dimension != 2)
    throw "input and kernel's dimensions must be 2";

  if (output.shape[0] != input.shape[0] || output.shape[1] != input.shape[1])
    throw "input and output's dimensions must be the same";

  if (kernel.shape[0] != kernel.shape[1] || kernel.shape[0] % 2 == 0)
    throw 'kernel must be a odd-side square';

  wrap = wrap ? 1 : 0;
  const [h, w] = input.shape;
  const k = (kernel.shape[0] - 1) / 2;

  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      let r = 0;

      for (let dy = -k; dy <= k; dy += 1) {
        const cy = y + dy, ky = dy + k;

        for (let dx = -k; dx <= k; dx += 1) {
          const cx = x + dx, kx = dx + k;

          if (cy < 0 || cy >= h || cx < 0 || cx >= w)
            r += input.get((cy + h) % h, (cx + w) % w) * kernel.get(ky, kx) * wrap;
          else
            r += input.get(cy, cx) * kernel.get(ky, kx);
        }
      }

      output.set(y, x, r);
    }
}

module.exports = convolve2d;
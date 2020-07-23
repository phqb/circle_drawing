'use strict';

const ndarray = require('ndarray');
const { divseq, expeq, mulseq, assign, addeq, atan2, powseq, add, sqrteq, sup, gts, bxors, band, gtseq, bandeq, boreq, assigns, muls } = require('ndarray-ops');
const convolve2d = require('./convolve');

const imageInput = document.getElementById('image-input');
imageInput.onchange = onImageChange;
const imagePreview = document.getElementById('image-preview');
imagePreview.onclick = () => edgeDetection(imagePreview);

async function previewImage(imageFile, canvas) {
  const imageBitmap = await createImageBitmap(imageFile);
  imagePreview.width = imageBitmap.width;
  imagePreview.height = imageBitmap.height;
  canvas.getContext('2d').drawImage(imageBitmap, 0, 0);
}

async function onImageChange() {
  const files = imageInput.files;
  if (files.length === 1) {
    const imageFile = files[0];
    await previewImage(imageFile, imagePreview);
  }
}

function newArray(type, shape) {
  return new ndarray(new type(shape.reduce((a, e) => a * e)), shape);
}

function gaussianKernel(size, sigma) {
  if (size % 2 == 0) throw 'size must be odd';
  sigma = sigma || 1;

  const k = (size - 1) / 2;
  const k_p1 = k + 1;
  const sigma_sqr_2 = 2 * sigma * sigma;
  const kernel = newArray(Float64Array, [size, size]);

  for (let i = 0; i < size; i += 1)
    for (let j = 0; j < size; j += 1)
      kernel.set(i, j, Math.pow(i + 1 - k_p1, 2) + Math.pow(j + 1 - k_p1, 2));

  divseq(kernel, -sigma_sqr_2);
  expeq(kernel);
  mulseq(kernel, 1 / (Math.PI * sigma_sqr_2));

  return kernel;
}

function toGreyScaleArray(imageData) {
  const w = imageData.width, h = imageData.height;
  const data = new ndarray(imageData.data, [h, w, 4]);
  window.data = data;
  const reds = newArray(Float64Array, [h, w]);
  const greens = newArray(Float64Array, [h, w]);
  const blues = newArray(Float64Array, [h, w]);
  const result = newArray(Uint8ClampedArray, [h, w]);

  assign(reds, data.pick(null, null, 0));
  mulseq(reds, 0.2126);
  assign(greens, data.pick(null, null, 1));
  mulseq(greens, 0.7152);
  assign(blues, data.pick(null, null, 2));
  mulseq(blues, 0.0722);

  addeq(reds, greens);
  addeq(reds, blues);
  assign(result, reds);

  return result;
}

function sobelFilter(input) {
  const Ix = newArray(Int32Array, input.shape);
  const Iy = newArray(Int32Array, input.shape);
  const magnitudes = newArray(Float64Array, input.shape);
  const thetas = newArray(Float64Array, input.shape);

  convolve2d(Ix, input, new ndarray(new Int32Array([-1, 0, 1, -2, 0, 2, -1, 0, 1]), [3, 3]), true);
  convolve2d(Iy, input, new ndarray(new Int32Array([1, 2, 1, 0, 0, 0, -1, -2, -1]), [3, 3]), true);

  atan2(thetas, Iy, Ix);
  powseq(Ix, 2);
  powseq(Iy, 2);
  add(magnitudes, Ix, Iy);
  sqrteq(magnitudes);

  return [magnitudes, thetas];
}

function nonMaxSuppression(magnitudes, thetas) {
  const [h, w] = magnitudes.shape;
  const result = newArray(Float64Array, magnitudes.shape);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const m = magnitudes.get(y, x);
      let theta = thetas.get(y, x);
      if (theta < 0) theta += Math.PI;
      let m1, m2;

      if (theta < Math.PI / 4) {
        m1 = (y > 0 && x > 0) ? magnitudes.get(y - 1, x - 1) : 0;
        m2 = (y + 1 < h && x + 1 < w) ? magnitudes.get(y + 1, x + 1) : 0;
      } else if (theta < Math.PI / 2) {
        m1 = y > 0 ? magnitudes.get(y - 1, x) : 0;
        m2 = y + 1 < h ? magnitudes.get(y + 1, x) : 0;
      } else if (theta < 3 * Math.PI / 4) {
        m1 = (y > 0 && x + 1 < w) ? magnitudes.get(y - 1, x + 1) : 0;
        m2 = (y + 1 < h && x > 0) ? magnitudes.get(y + 1, x - 1) : 0;
      } else {
        m1 = x > 0 ? magnitudes.get(y, x - 1) : 0;
        m2 = x + 1 < w ? magnitudes.get(y, x + 1) : 0;
      }

      if (Math.max(m, m1, m2) != m)
        result.set(y, x, 0);
      else
        result.set(y, x, m);
    }
  }

  return result;
}

function threshold(input, loRatio, hiRatio) {
  const max = sup(input)
  const hi = max * hiRatio;
  const lo = max * loRatio

  const strongs = newArray(Uint8ClampedArray, input.shape);
  gts(strongs, input, hi);

  const nonStrongs = newArray(Uint8ClampedArray, input.shape);
  bxors(nonStrongs, strongs, 1);

  const relevants = newArray(Uint8ClampedArray, input.shape);
  gts(relevants, input, lo);

  const weaks = newArray(Uint8ClampedArray, input.shape);
  band(weaks, nonStrongs, relevants);

  return [weaks, strongs];
}

function hysteresis(weaks, strongs) {
  const result = newArray(Uint8ClampedArray, strongs.shape);

  convolve2d(result, strongs, new ndarray(new Uint8ClampedArray([1, 1, 1, 1, 1, 1, 1, 1, 1]), [3, 3]));
  gtseq(result, 0);
  bandeq(result, weaks);
  boreq(result, strongs);

  return result;
}

function greyScaleToRGBA(input) {
  const result = newArray(Uint8ClampedArray, [...input.shape, 4]);

  assign(result.pick(null, null, 0), input);
  assign(result.pick(null, null, 1), input);
  assign(result.pick(null, null, 2), input);
  assigns(result.pick(null, null, 3), 255);

  return result;
}

function toImageData(input) {
  return new ImageData(input.data, input.shape[1]);
}

function edgeDetection(canvas) {
  const w = canvas.width, h = canvas.height;
  const imageData = canvas.getContext('2d').getImageData(0, 0, w, h);

  console.time('toGreyScaleArray()')
  const greys = toGreyScaleArray(imageData);
  console.timeEnd('toGreyScaleArray()');

  console.time('blur');
  const blurred = newArray(Float64Array, [h, w]);
  convolve2d(blurred, greys, gaussianKernel(5, 1.4), true);
  console.timeEnd('blur');

  console.time('sobelFilter()');
  const [G, theta] = sobelFilter(blurred);
  console.timeEnd('sobelFilter()');

  console.time('nonMaxSuppression()');
  const suppressed = nonMaxSuppression(G, theta);
  console.timeEnd('nonMaxSuppression()');

  console.time('threshold()');
  const [weaks, strongs] = threshold(suppressed, 0.05, 0.2);
  console.timeEnd('threshold()');

  console.time('hysteresis()');
  const newStrongs = hysteresis(weaks, strongs);
  console.timeEnd('hysteresis()');

  console.time('strong values to grey');
  const strongValues = newArray(Uint8ClampedArray, [h, w]);
  muls(strongValues, newStrongs, 255);
  console.timeEnd('strong values to grey');

  console.time('greyScaleToRGBA()');
  const rgba = greyScaleToRGBA(strongValues);
  console.timeEnd('greyScaleToRGBA()');

  canvas.getContext('2d').putImageData(toImageData(rgba), 0, 0);
  document.getElementById('image').src = canvas.toDataURL('image/jpeg');
}
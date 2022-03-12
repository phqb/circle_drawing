export function compress2d(module, input, nx, ny, tolerance) {
  if (input.length != nx * ny) return null;

  const inputPtr = module._malloc(input.length * Float32Array.BYTES_PER_ELEMENT);
  module.HEAPF32.set(input, inputPtr / Float32Array.BYTES_PER_ELEMENT);

  const sizePtr = module._malloc(Uint32Array.BYTES_PER_ELEMENT);
  const statusPtr = module._malloc(Uint32Array.BYTES_PER_ELEMENT);

  const outputPtr = module.ccall(
    'compress_2d', 
    'number', 
    ['number', 'number', 'number', 'number', 'number', 'number'], 
    [inputPtr, nx, ny, tolerance, sizePtr, statusPtr]
  );

  module._free(inputPtr);

  const status = module.HEAPU32[statusPtr / Uint32Array.BYTES_PER_ELEMENT];
  module._free(statusPtr);
  const size = module.HEAPU32[sizePtr / Uint32Array.BYTES_PER_ELEMENT];
  module._free(sizePtr);

  if (status != 0) return null;

  const output = new Uint8Array(size);
  const outputOffset = outputPtr / Uint8Array.BYTES_PER_ELEMENT;
  for (let i = 0; i < size; i += 1) output[i] = module.HEAPU8[outputOffset + i];

  module._free(outputPtr);

  return output;
}

export function decompress2d(module, input, nx, ny, tolerance) {
  const inputPtr = module._malloc(input.length * Uint8Array.BYTES_PER_ELEMENT);
  module.HEAPU8.set(input, inputPtr / Uint8Array.BYTES_PER_ELEMENT);

  const statusPtr = module._malloc(Uint32Array.BYTES_PER_ELEMENT);

  const outputPtr = module.ccall(
    'decompress_2d',
    'number',
    ['number', 'number', 'number', 'number', 'number', 'number'],
    [inputPtr, nx, ny, tolerance, input.length, statusPtr]
  );

  module._free(inputPtr);

  const status = module.HEAPU32[statusPtr / Uint32Array.BYTES_PER_ELEMENT];
  module._free(statusPtr);

  if (status != 0) return null;

  const output = new Float32Array(nx * ny);
  const outputOffset = outputPtr / Float32Array.BYTES_PER_ELEMENT;
  for (let i = 0, n = nx * ny; i < n; i += 1) output[i] = module.HEAPF32[outputOffset + i];

  module._free(outputPtr);

  return output;
}
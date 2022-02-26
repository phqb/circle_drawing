export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}

export function div(a, d) {
  return [a[0] / d, a[1] / d];
}

export function exp(a) {
  const e = Math.exp(a[0]);
  return [e * Math.cos(a[1]), e * Math.sin(a[1])];
}

export function mul(a, b) {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

export function abs(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1]);
}

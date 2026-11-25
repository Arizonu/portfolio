const H = (s) => s.split(',').map((h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]);

export const CMAPS = {
  viridis: { name: 'viridis', stops: H('#440154,#482878,#3e4989,#31688e,#26828e,#1f9e89,#35b779,#6ece58,#b5de2b,#fde725') },
  magma: { name: 'magma', stops: H('#000004,#1c1044,#4f127b,#812581,#b5367a,#e55964,#fb8761,#fec287,#fcfdbf') },
  inferno: { name: 'inferno', stops: H('#000004,#1f0c48,#550f6d,#88226a,#ba3655,#e35933,#f98e09,#f9cb35,#fcffa4') },
  turbo: { name: 'turbo', stops: H('#30123b,#4145ab,#4675ed,#39a2fc,#1bcfd4,#24eca6,#61fc6c,#a4fc3b,#d1e834,#f3c63a,#fe9b2d,#f36315,#d93806,#b11901,#7a0403') },
  rdbu: { name: 'RdBu (rozbieżna)', stops: H('#053061,#2166ac,#4393c3,#92c5de,#d1e5f0,#f7f7f7,#fddbc7,#f4a582,#d6604d,#b2182b,#67001f'), diverging: true },
  cividis: { name: 'cividis', stops: H('#00224e,#123570,#3b496c,#575d6d,#707173,#8a8779,#a69d75,#c4b56c,#e4cf5b,#fee838') },
  gray: { name: 'szarości', stops: H('#1a1a1a,#ffffff') }
};

export function sample(cm, t, out) {
  const s = (typeof cm === 'string' ? CMAPS[cm] : cm).stops;
  const x = Math.max(0, Math.min(1, t)) * (s.length - 1);
  const i = Math.min(s.length - 2, Math.floor(x));
  const f = x - i;
  const a = s[i], b = s[i + 1];
  out = out || [0, 0, 0];
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
}

export function lut(cm, n = 256) {
  const arr = new Float32Array(n * 3);
  const o = [0, 0, 0];
  for (let i = 0; i < n; i++) { sample(cm, i / (n - 1), o); arr[i * 3] = o[0]; arr[i * 3 + 1] = o[1]; arr[i * 3 + 2] = o[2]; }
  return arr;
}

export function css(cm, t) {
  const o = sample(cm, t);
  return `rgb(${Math.round(o[0] * 255)},${Math.round(o[1] * 255)},${Math.round(o[2] * 255)})`;
}

export function gradientCSS(cm) {
  const s = CMAPS[cm].stops;
  return 'linear-gradient(90deg,' + s.map((c, i) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')}) ${(i / (s.length - 1) * 100).toFixed(1)}%`).join(',') + ')';
}

/* sRGB -> linear for vertex colours fed to three.js */
export const toLin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

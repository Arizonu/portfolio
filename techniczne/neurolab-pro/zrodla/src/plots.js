import uPlot from 'uplot';
import { el } from './ui.js';
import { sample } from './colormaps.js';

const AX = '#9aa0a8', GRID = 'rgba(255,255,255,0.07)', FONT = '12px "IBM Plex Sans", system-ui, sans-serif';

export function card(parent, title, sub) {
  const c = el('figure', { class: 'pcard' });
  const cap = el('figcaption', null, [el('strong', { text: title }), sub ? el('span', { class: 'sub', text: sub }) : null]);
  const body = el('div', { class: 'pbody' });
  c.append(cap, body);
  parent.append(c);
  return { card: c, body, cap };
}

/* uPlot time-series with a dark scientific style */
export function plot(parent, o) {
  const c = card(parent, o.title, o.sub);
  const named = o.series.filter((s) => s.label && o.series.length > 1);
  if (named.length) c.cap.append(el('span', { class: 'keys' }, named.map((s) => el('span', null, [el('i', { style: 'background:' + s.color }), s.label]))));
  const axis = (label, side) => ({
    label, stroke: AX, font: FONT, labelFont: FONT, size: side === 3 ? 52 : 40, labelSize: 18, gap: 4,
    grid: { stroke: GRID, width: 1 }, ticks: { stroke: GRID, width: 1, size: 4 },
    values: o.fmtY && side === 3 ? (u, v) => v.map(o.fmtY) : undefined
  });
  const opts = {
    width: 300, height: 150,
    legend: { show: false },
    cursor: { drag: { x: true, y: false }, points: { size: 5 } },
    scales: { x: { time: false, range: o.xRange }, y: { range: o.yRange } },
    axes: [axis(o.xlabel, 2), axis(o.ylabel, 3)],
    series: [{ label: o.xlabel || 'x', value: (u, v) => (v == null ? '–' : (+v).toFixed(o.xDec != null ? o.xDec : 2)) }].concat(o.series.map((s) => ({
      label: s.label, stroke: s.color, width: s.width || 1.5, dash: s.dash, fill: s.fill, points: { show: !!s.points, size: s.points || 4, fill: s.color },
      paths: s.bars ? uPlot.paths.bars({ size: [0.9, 40] }) : s.step ? uPlot.paths.stepped({ align: 1 }) : undefined,
      value: (u, v) => (v == null ? '–' : (+v).toFixed(s.dec != null ? s.dec : 2)), scale: s.scale || 'y', spanGaps: false
    })))
  };
  if (o.y2) {
    opts.scales.y2 = { range: o.y2Range };
    opts.axes.push(Object.assign(axis(o.y2, 1), { scale: 'y2', side: 1, grid: { show: false } }));
  }
  const data = [[0], ...o.series.map(() => [null])];
  const u = new uPlot(opts, data, c.body);
  const fit = () => {
    const w = Math.max(120, c.body.clientWidth);
    const h = Math.max(80, o.height || c.body.clientHeight || 160);
    u.setSize({ width: w, height: h });
  };
  const ro = new ResizeObserver(fit);
  ro.observe(c.body);
  fit();
  return {
    u, card: c.card,
    set(d, resetScales = true) { u.setData(d, resetScales); },
    cursorAt(x) { const i = u.valToPos(x, 'x'); u.setCursor({ left: i, top: 10 }); },
    destroy() { ro.disconnect(); u.destroy(); }
  };
}

/* Heat map on a canvas with axes (kymographs, matrices). */
export function heatmap(parent, o) {
  const c = card(parent, o.title, o.sub);
  const cv = el('canvas', { class: 'hm', role: 'img', 'aria-label': o.title });
  c.body.append(cv);
  const pad = { l: o.padL || 46, r: 10, t: 8, b: 30 };
  let last = null;
  const img = document.createElement('canvas');
  function draw() {
    if (!last) return;
    const { vals, nx, ny, cmap, vmin, vmax, xr, yr, colors } = last;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.body.clientWidth, H = Math.max(80, c.body.clientHeight || o.height || 200);
    cv.width = W * dpr; cv.height = H * dpr;
    const cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    img.width = nx; img.height = ny;
    const ic = img.getContext('2d');
    const id = ic.createImageData(nx, ny);
    const o3 = [0, 0, 0];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const v = vals[j * nx + i];
      const k = ((ny - 1 - (o.flipY ? ny - 1 - j : j)) * nx + i) * 4;
      if (colors) { const cc = colors(v, i, j); id.data[k] = cc[0]; id.data[k + 1] = cc[1]; id.data[k + 2] = cc[2]; }
      else { sample(cmap, (v - vmin) / (vmax - vmin), o3); id.data[k] = o3[0] * 255; id.data[k + 1] = o3[1] * 255; id.data[k + 2] = o3[2] * 255; }
      id.data[k + 3] = 255;
    }
    ic.putImageData(id, 0, 0);
    let pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    if (o.square) { const sd = Math.min(pw, ph); pad.l = (W - sd) / 2; pw = ph = sd; }
    last.box = { l: pad.l, t: pad.t, w: pw, h: ph };
    cx.imageSmoothingEnabled = !!o.smooth;
    cx.drawImage(img, pad.l, pad.t, pw, ph);
    cx.strokeStyle = 'rgba(255,255,255,0.18)';
    cx.strokeRect(pad.l + 0.5, pad.t + 0.5, pw, ph);
    cx.fillStyle = AX; cx.font = FONT;
    const ticks = (a, b, n) => { const st = niceStep((b - a) / n); const out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(6)); return out; };
    if (xr) {
      cx.textAlign = 'center'; cx.textBaseline = 'top';
      for (const v of ticks(xr[0], xr[1], Math.max(2, Math.floor(pw / 80)))) { const x = pad.l + (v - xr[0]) / (xr[1] - xr[0]) * pw; cx.fillText(fmt(v), x, pad.t + ph + 4); }
      if (o.xlabel) { cx.textAlign = 'right'; cx.fillText(o.xlabel, pad.l + pw, pad.t + ph + 17); }
    }
    if (yr) {
      cx.textAlign = 'right'; cx.textBaseline = 'middle';
      for (const v of ticks(yr[0], yr[1], Math.max(2, Math.floor(ph / 40)))) { const y = pad.t + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph; cx.fillText(fmt(v), pad.l - 6, y); }
      if (o.ylabel) { cx.save(); cx.translate(11, pad.t + ph / 2); cx.rotate(-Math.PI / 2); cx.textAlign = 'center'; cx.fillText(o.ylabel, 0, 0); cx.restore(); }
    }
    if (o.overlay) o.overlay(cx, { l: pad.l, t: pad.t, w: pw, h: ph });
  }
  const ro = new ResizeObserver(draw);
  ro.observe(c.body);
  cv.addEventListener('pointermove', (e) => {
    if (!o.onHover || !last) return;
    const r = cv.getBoundingClientRect(), bx = last.box || { l: pad.l, t: pad.t, w: r.width - pad.l - pad.r, h: r.height - pad.t - pad.b };
    const fx = (e.clientX - r.left - bx.l) / bx.w, fy = 1 - (e.clientY - r.top - bx.t) / bx.h;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) { o.onHover(null); return; }
    o.onHover({ i: Math.floor(fx * last.nx), j: Math.floor(fy * last.ny), fx, fy });
  });
  cv.addEventListener('click', (e) => {
    if (!o.onClick || !last) return;
    const r = cv.getBoundingClientRect(), bx = last.box || { l: pad.l, t: pad.t, w: r.width - pad.l - pad.r, h: r.height - pad.t - pad.b };
    const fx = (e.clientX - r.left - bx.l) / bx.w, fy = 1 - (e.clientY - r.top - bx.t) / bx.h;
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
    o.onClick({ i: Math.floor(fx * last.nx), j: Math.floor(fy * last.ny) });
  });
  return {
    card: c.card, canvas: cv,
    draw(vals, nx, ny, cmap, vmin, vmax, xr, yr, colors) { last = { vals, nx, ny, cmap, vmin, vmax, xr, yr, colors }; draw(); },
    redraw: draw,
    destroy() { ro.disconnect(); }
  };
}

export function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
}
function fmt(v) { return Math.abs(v) >= 1000 ? (v / 1000).toLocaleString('pl-PL', { maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('pl-PL', { maximumFractionDigits: 3 }); }

/* Simple x–y line/scatter plot on canvas (phase planes, trajectories). */
export function xy(parent, o) {
  const c = card(parent, o.title, o.sub);
  const cv = el('canvas', { class: 'hm', role: 'img', 'aria-label': o.title });
  c.body.append(cv);
  if (o.height) { c.body.style.height = o.height + 'px'; c.body.style.flex = 'none'; }
  let last = null;
  const pad = { l: 50, r: 10, t: 8, b: 32 };
  function draw() {
    if (!last) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.body.clientWidth, H = Math.max(100, c.body.clientHeight || o.height || 180);
    cv.width = W * dpr; cv.height = H * dpr;
    const cx = cv.getContext('2d');
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx.clearRect(0, 0, W, H);
    const pw = W - pad.l - pad.r, ph = H - pad.t - pad.b;
    const [x0, x1] = last.xr, [y0, y1] = last.yr;
    const X = (x) => pad.l + (x - x0) / (x1 - x0) * pw, Y = (y) => pad.t + ph - (y - y0) / (y1 - y0) * ph;
    cx.font = FONT; cx.fillStyle = AX; cx.strokeStyle = GRID; cx.lineWidth = 1;
    const tk = (a, b, n) => { const s = niceStep((b - a) / n); const out = []; for (let v = Math.ceil(a / s) * s; v <= b + 1e-9; v += s) out.push(+v.toFixed(6)); return out; };
    cx.textAlign = 'center'; cx.textBaseline = 'top';
    for (const v of tk(x0, x1, Math.max(2, pw / 70))) { cx.beginPath(); cx.moveTo(X(v), pad.t); cx.lineTo(X(v), pad.t + ph); cx.stroke(); cx.fillText(fmt(v), X(v), pad.t + ph + 4); }
    cx.textAlign = 'right'; cx.textBaseline = 'middle';
    for (const v of tk(y0, y1, Math.max(2, ph / 36))) { cx.beginPath(); cx.moveTo(pad.l, Y(v)); cx.lineTo(pad.l + pw, Y(v)); cx.stroke(); cx.fillText(fmt(v), pad.l - 6, Y(v)); }
    if (o.xlabel) { cx.textAlign = 'right'; cx.textBaseline = 'top'; cx.fillText(o.xlabel, pad.l + pw, pad.t + ph + 18); }
    if (o.ylabel) { cx.save(); cx.translate(12, pad.t + ph / 2); cx.rotate(-Math.PI / 2); cx.textAlign = 'center'; cx.fillText(o.ylabel, 0, 0); cx.restore(); }
    cx.save(); cx.beginPath(); cx.rect(pad.l, pad.t, pw, ph); cx.clip();
    for (const s of last.series) {
      cx.strokeStyle = s.color; cx.fillStyle = s.color; cx.lineWidth = s.width || 1.5;
      if (s.dash) cx.setLineDash(s.dash); else cx.setLineDash([]);
      if (s.dots) { for (let i = 0; i < s.x.length; i++) { cx.beginPath(); cx.arc(X(s.x[i]), Y(s.y[i]), s.dots, 0, 7); cx.fill(); } continue; }
      cx.beginPath();
      let pen = false;
      for (let i = 0; i < s.x.length; i++) { if (s.y[i] == null || isNaN(s.y[i])) { pen = false; continue; } const px = X(s.x[i]), py = Y(s.y[i]); if (!pen) { cx.moveTo(px, py); pen = true; } else cx.lineTo(px, py); }
      cx.stroke();
    }
    cx.setLineDash([]);
    if (last.marker) { cx.fillStyle = '#ff8a3d'; cx.beginPath(); cx.arc(X(last.marker[0]), Y(last.marker[1]), 4.5, 0, 7); cx.fill(); }
    cx.restore();
    if (last.legend) {
      cx.textAlign = 'left'; cx.textBaseline = 'middle'; let lx = pad.l + 8;
      for (const s of last.series) { if (!s.label) continue; cx.fillStyle = s.color; cx.fillRect(lx, pad.t + 9, 10, 3); cx.fillStyle = AX; cx.fillText(s.label, lx + 14, pad.t + 10); lx += cx.measureText(s.label).width + 30; }
    }
  }
  const ro = new ResizeObserver(draw);
  ro.observe(c.body);
  return { card: c.card, draw(series, xr, yr, extra = {}) { last = { series, xr, yr, ...extra }; draw(); }, setMarker(m) { if (last) { last.marker = m; draw(); } } };
}

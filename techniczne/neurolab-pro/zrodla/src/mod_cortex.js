import { THREE, CSS2DObject } from './viewer.js';
import * as ui from './ui.js';
import { sample, toLin, CMAPS, css } from './colormaps.js';
import { plot, heatmap, card } from './plots.js';

const NET = [
  { k: 'Vis', n: 'Wzrokowa', c: '#781286' },
  { k: 'SomMot', n: 'Somatomotoryczna', c: '#4682B4' },
  { k: 'DorsAttn', n: 'Uwagi grzbietowej (DAN)', c: '#00760E' },
  { k: 'SalVentAttn', n: 'Istotności / uwagi brzusznej', c: '#C43AFA' },
  { k: 'Limbic', n: 'Limbiczna', c: '#DCF8A4' },
  { k: 'Cont', n: 'Kontroli czołowo-ciemieniowej', c: '#E69422' },
  { k: 'Default', n: 'Domyślna (DMN)', c: '#CD3E4E' }
];
const START = { lh: [1, 32, 69, 92, 114, 127, 149, 201], rh: [201, 231, 271, 293, 319, 332, 362, 401] };
const MES = [null, { n: 'paralimbiczna', c: '#e66101' }, { n: 'heteromodalna', c: '#fdb863' }, { n: 'unimodalna', c: '#b2abd2' }, { n: 'idiotypowa (pierwotna)', c: '#5e3c99' }];
const MAPS = {
  thick: { n: 'Grubość kory', u: 'mm', cm: 'viridis', d: 2 },
  myelin: { n: 'T1w/T2w (mielinizacja)', u: 'j.u.', cm: 'inferno', d: 2 },
  g1: { n: 'Gradient G1 łączności (oś sensoryczna–transmodalna)', u: '', cm: 'viridis', d: 2 },
  g2: { n: 'Gradient G2 łączności (oś wzrokowa–somatomotoryczna)', u: '', cm: 'viridis', d: 2 },
  mpc: { n: 'Gradient mikrostruktury (MPC G1)', u: '', cm: 'cividis', d: 1 },
  curv: { n: 'Krzywizna średnia', u: '1/mm', cm: 'rdbu', d: 3, sym: true }
};
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];

let DATA = null;
async function load() {
  if (DATA) return DATA;
  const [m, b64] = await Promise.all([fetch('data/cortex.json').then((r) => r.json()), fetch('data/cortex.b64.txt').then((r) => r.text())]);
  const bin = atob(b64.trim());
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const buf = u8.buffer;
  const arr = (n) => {
    const a = m.arrays[n];
    const T = { uint16: Uint16Array, uint8: Uint8Array, float32: Float32Array }[a.dtype];
    return new T(buf, a.offset, a.length / T.BYTES_PER_ELEMENT);
  };
  const pos = (n) => {
    const a = m.arrays[n], q = arr(n), out = new Float32Array(q.length);
    for (let i = 0; i < q.length; i += 3) for (let k = 0; k < 3; k++) out[i + k] = a.lo[k] + q[i + k] * a.scale[k];
    return out;
  };
  const nv = m.nv;
  const D = { m, nv, hemi: {} };
  for (const h of ['lh', 'rh']) D.hemi[h] = { mid: pos('mid_' + h), infl: pos('infl_' + h), sph: pos('sph_' + h), tri: arr('tri_' + h) };
  D.maps = {};
  for (const k of Object.keys(MAPS)) {
    const a = m.arrays['map_' + k], q = arr('map_' + k), v = new Float32Array(q.length);
    for (let i = 0; i < q.length; i++) v[i] = q[i] === 65535 ? NaN : a.lo + q[i] / 65534 * (a.hi - a.lo);
    D.maps[k] = { v, p2: a.p2, p98: a.p98, lo: a.lo, hi: a.hi };
  }
  D.sch = arr('sch400');
  D.mes = arr('mesulam');
  const fa = m.arrays.fc400, fq = arr('fc400');
  D.fc = new Float32Array(160000);
  for (let i = 0; i < 160000; i++) D.fc[i] = fa.lo + fq[i] / 255 * (fa.hi - fa.lo);
  // per-vertex area on the mid surface
  D.area = new Float32Array(nv * 2);
  ['lh', 'rh'].forEach((h, hi) => {
    const P = D.hemi[h].mid, T = D.hemi[h].tri;
    for (let t = 0; t < T.length; t += 3) {
      const a = T[t] * 3, b = T[t + 1] * 3, c = T[t + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const ar = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 3;
      D.area[hi * nv + T[t]] += ar; D.area[hi * nv + T[t + 1]] += ar; D.area[hi * nv + T[t + 2]] += ar;
    }
  });
  // parcel stats
  D.parcel = [];
  for (let p = 0; p <= 400; p++) D.parcel.push({ n: 0, area: 0, sums: {}, mes: [0, 0, 0, 0, 0] });
  for (let i = 0; i < nv * 2; i++) {
    const p = D.sch[i];
    const P = D.parcel[p];
    P.n++; P.area += D.area[i]; P.mes[D.mes[i]]++;
    for (const k of Object.keys(MAPS)) { const v = D.maps[k].v[i]; if (!isNaN(v)) P.sums[k] = (P.sums[k] || 0) + v; }
  }
  return (DATA = D);
}

export function parcelInfo(p) {
  const hemi = p > 200 ? 'rh' : 'lh';
  const st = START[hemi];
  let ni = 0;
  while (ni < 6 && p >= st[ni + 1]) ni++;
  return { hemi, net: ni, idx: p - st[ni] + 1, name: `${hemi === 'lh' ? 'LH' : 'RH'}_${NET[ni].k}_${p - st[ni] + 1}` };
}

export default {
  id: 'kora', tab: 'Kora mózgowa',
  async mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Kora mózgowa człowieka', 'Conte69 · 2 × 32 492 wierzchołków · współrzędne MNI');
    ctx.dockSize(34);
    ctx.busy(true);
    const D = await load();
    ctx.busy(false);
    const nv = D.nv;
    const st = { mode: 'yeo', cmap: null, lo: null, hi: null, morph: 0, sulc: true, seed: 0, sel: 0, thr: 0.15, show: { lh: true, rh: true }, clip: 'off', clipPos: 0, clipFlip: false };
    this.st = st;

    /* ---------- geometry ---------- */
    const meshes = {};
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide, envMapIntensity: 0.6 });
    const root = new THREE.Group();
    root.rotation.x = -Math.PI / 2;
    if (v.ok) v.root.add(root);
    for (const h of ['lh', 'rh']) {
      const H = D.hemi[h];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(H.mid, 3));
      g.setIndex(new THREE.BufferAttribute(H.tri, 1));
      g.computeVertexNormals();
      const mk = (P) => { const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(P, 3)); gg.setIndex(new THREE.BufferAttribute(H.tri, 1)); gg.computeVertexNormals(); const n = gg.getAttribute('normal'); gg.dispose(); return n; };
      g.morphAttributes.position = [new THREE.BufferAttribute(H.infl, 3), new THREE.BufferAttribute(H.sph, 3)];
      g.morphAttributes.normal = [mk(H.infl), mk(H.sph)];
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
      const mesh = new THREE.Mesh(g, mat);
      mesh.morphTargetInfluences = [0, 0];
      mesh.userData.hemi = h;
      root.add(mesh);
      meshes[h] = mesh;
    }
    v.pickables = [meshes.lh, meshes.rh];
    v.setUnits('mm', 1);
    v.setGizmoLabels(['P', 'G', 'T']);
    v.bloom.strength = 0.0;
    v.scene.environmentIntensity = 0.5;
    if (v.ok) v.frame(new THREE.Vector3(0, 12, 18), 95, new THREE.Vector3(-1, 0.15, -0.35));

    const lbl = document.createElement('div');
    lbl.className = 'lbl sel';
    const label = new CSS2DObject(lbl);
    label.visible = false;
    root.add(label);

    /* ---------- colouring ---------- */
    const GRAY = [0.17, 0.18, 0.2];
    const netCol = NET.map((n) => hex(n.c));
    const mesCol = MES.map((m) => (m ? hex(m.c) : GRAY));
    const parcelCol = [];
    for (let p = 0; p <= 400; p++) {
      if (!p) { parcelCol.push(GRAY); continue; }
      const info = parcelInfo(p);
      const b = netCol[info.net];
      const f = 0.72 + 0.5 * (((p * 2654435761) >>> 0) % 1000) / 1000;
      parcelCol.push(b.map((x) => Math.min(1, x * f)));
    }
    const range = () => {
      const M = MAPS[st.mode];
      if (st.lo != null) return [st.lo, st.hi];
      const d = D.maps[st.mode];
      if (M.sym) { const a = Math.max(Math.abs(d.p2), Math.abs(d.p98)); return [-a, a]; }
      return [d.p2, d.p98];
    };
    const o3 = [0, 0, 0];
    const paint = () => {
      const curv = D.maps.curv.v;
      const seedRow = st.seed ? D.fc.subarray((st.seed - 1) * 400, st.seed * 400) : null;
      const [a, b] = MAPS[st.mode] ? range() : [0, 1];
      const cm = st.cmap || (MAPS[st.mode] && MAPS[st.mode].cm) || 'viridis';
      ['lh', 'rh'].forEach((h, hi) => {
        const col = meshes[h].geometry.getAttribute('color');
        const C = col.array;
        for (let i = 0; i < nv; i++) {
          const gi = hi * nv + i;
          const p = D.sch[gi];
          let c;
          if (st.mode === 'yeo') c = p ? netCol[parcelInfo(p).net] : GRAY;
          else if (st.mode === 'sch') c = parcelCol[p];
          else if (st.mode === 'mes') c = mesCol[D.mes[gi]];
          else if (st.mode === 'seed') {
            if (!p || !seedRow) c = GRAY;
            else if (p === st.seed) c = [1, 0.55, 0.2];
            else { const r = seedRow[p - 1]; c = Math.abs(r) < st.thr ? [0.32, 0.33, 0.35] : sample('rdbu', (r + 0.6) / 1.2, o3).slice(); }
          } else {
            const val = D.maps[st.mode].v[gi];
            c = isNaN(val) ? GRAY : sample(cm, (val - a) / (b - a), o3).slice();
          }
          let s = 1;
          if (st.sulc && st.mode !== 'curv') { const cv = curv[gi]; s = isNaN(cv) ? 0.9 : (cv > 0 ? 0.62 : 1.0); }
          if (st.sel && p === st.sel && st.mode !== 'seed') { c = [c[0] * 0.4 + 0.6, c[1] * 0.4 + 0.33, c[2] * 0.4 + 0.12]; }
          C[i * 3] = toLin(c[0]) * s; C[i * 3 + 1] = toLin(c[1]) * s; C[i * 3 + 2] = toLin(c[2]) * s;
        }
        col.needsUpdate = true;
      });
      legendUpdate();
      statsUpdate();
    };

    /* ---------- left panel ---------- */
    const L = ctx.left;
    const s1 = ui.sec(L, 'Powierzchnia');
    const morphS = ui.slider(s1, { label: 'Kształt: środkowa → napompowana → sfera', min: 0, max: 2, step: 0.01, value: 0, dec: 2, onInput: (x) => setMorph(x) });
    ui.buttons(s1, [['Środkowa', () => setMorph(0, true)], ['Napompowana', () => setMorph(1, true)], ['Sfera', () => setMorph(2, true)]]);
    ui.toggle(s1, { label: 'Lewa półkula', value: true, onChange: (x) => { meshes.lh.visible = x; } });
    ui.toggle(s1, { label: 'Prawa półkula', value: true, onChange: (x) => { meshes.rh.visible = x; } });
    ui.toggle(s1, { label: 'Cieniowanie bruzd (krzywizna)', value: true, onChange: (x) => { st.sulc = x; paint(); } });

    const s2 = ui.sec(L, 'Widok');
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const showBoth = () => { meshes.lh.visible = true; meshes.rh.visible = true; };
    ui.buttons(s2, [
      ['Boczny L', () => { showBoth(); v.view(V3(-1, 0, 0)); }],
      ['Przyśr. L', () => { meshes.rh.visible = false; meshes.lh.visible = true; v.view(V3(1, 0, 0)); }],
      ['Boczny P', () => { showBoth(); v.view(V3(1, 0, 0)); }],
      ['Przyśr. P', () => { meshes.lh.visible = false; meshes.rh.visible = true; v.view(V3(-1, 0, 0)); }],
      ['Grzbietowy', () => { showBoth(); v.view(V3(0, 1, 0.001), V3(0, 0, -1)); }],
      ['Brzuszny', () => { showBoth(); v.view(V3(0, -1, 0.001), V3(0, 0, -1)); }],
      ['Przedni', () => { showBoth(); v.view(V3(0, 0, -1)); }],
      ['Tylny', () => { showBoth(); v.view(V3(0, 0, 1)); }]
    ]);

    const s3 = ui.sec(L, 'Mapa');
    const modeSel = ui.select(s3, {
      label: 'Warstwa danych', value: 'yeo', options: [
        ['yeo', 'Sieci Yeo-7 (Schaefer)'], ['sch', 'Parcelacja Schaefer-400'], ['mes', 'Hierarchia Mesulama'],
        ['thick', MAPS.thick.n], ['myelin', MAPS.myelin.n], ['g1', 'Gradient łączności G1'], ['g2', 'Gradient łączności G2'], ['mpc', MAPS.mpc.n], ['curv', MAPS.curv.n],
        ['seed', 'Łączność z wybranym obszarem']
      ], onChange: (x) => { st.mode = x; st.lo = st.hi = null; st.cmap = null; syncMapCtl(); paint(); }
    });
    const cmapSel = ui.select(s3, { label: 'Paleta', value: 'viridis', options: Object.keys(CMAPS).filter((k) => k !== 'gray').map((k) => [k, CMAPS[k].name]), onChange: (x) => { st.cmap = x; paint(); } });
    const loS = ui.slider(s3, { label: 'Dolna granica', min: 0, max: 1, step: 0.001, value: 0, dec: 2, onInput: (x) => { const r = range(); st.lo = x; st.hi = st.hi == null ? r[1] : st.hi; paint(); } });
    const hiS = ui.slider(s3, { label: 'Górna granica', min: 0, max: 1, step: 0.001, value: 1, dec: 2, onInput: (x) => { const r = range(); st.hi = x; st.lo = st.lo == null ? r[0] : st.lo; paint(); } });
    const cb = ui.colorbar(s3);
    const leg = ui.el('ul', { class: 'legend' });
    s3.append(leg);
    const thrS = ui.slider(s3, { label: 'Próg |r| dla łączności', min: 0, max: 0.6, step: 0.01, value: st.thr, dec: 2, onInput: (x) => { st.thr = x; if (st.mode === 'seed') paint(); } });
    ui.buttons(s3, [['Zakres 2–98 percentyl', () => { st.lo = st.hi = null; syncMapCtl(); paint(); }]]);

    function syncMapCtl() {
      const M = MAPS[st.mode];
      const isMap = !!M;
      [cmapSel.el, loS.el, hiS.el].forEach((e) => { e.style.display = isMap ? '' : 'none'; });
      thrS.el.style.display = st.mode === 'seed' ? '' : 'none';
      if (isMap) {
        const d = D.maps[st.mode];
        [loS, hiS].forEach((s) => { s.input.min = d.lo; s.input.max = d.hi; s.input.step = (d.hi - d.lo) / 500; });
        const r = range();
        loS.set(r[0]); hiS.set(r[1]);
        cmapSel.set(st.cmap || M.cm);
      }
    }
    function legendUpdate() {
      leg.replaceChildren();
      if (st.mode === 'yeo' || st.mode === 'sch') { cb.el.style.display = 'none'; NET.forEach((n) => leg.append(ui.el('li', null, [ui.el('i', { style: 'background:' + n.c }), ui.el('span', { text: n.n })]))); }
      else if (st.mode === 'mes') { cb.el.style.display = 'none'; MES.slice(1).forEach((n) => leg.append(ui.el('li', null, [ui.el('i', { style: 'background:' + n.c }), ui.el('span', { text: n.n })]))); }
      else if (st.mode === 'seed') { cb.el.style.display = ''; cb.set('rdbu', -0.6, 0.6, st.seed ? 'r (FC z ' + parcelInfo(st.seed).name + ')' : 'kliknij obszar na korze', 2); }
      else { cb.el.style.display = ''; const r = range(); cb.set(st.cmap || MAPS[st.mode].cm, r[0], r[1], MAPS[st.mode].u, MAPS[st.mode].d); }
    }

    const s4 = ui.sec(L, 'Przekrój');
    ui.seg(s4, { value: 'off', options: [['off', 'Brak'], ['x', 'Strzałkowy'], ['y', 'Czołowy'], ['z', 'Poziomy']], onChange: (x) => { st.clip = x; applyClip(); } });
    const clipS = ui.slider(s4, { label: 'Położenie płaszczyzny', min: -75, max: 75, step: 0.5, value: 0, unit: 'mm', dec: 1, onInput: (x) => { st.clipPos = x; applyClip(); } });
    ui.toggle(s4, { label: 'Odwróć stronę', value: false, onChange: (x) => { st.clipFlip = x; applyClip(); } });
    const plane = new THREE.Plane();
    function applyClip() {
      if (!v.ok) return;
      if (st.clip === 'off') { v.renderer.clippingPlanes = []; return; }
      const s = st.clipFlip ? 1 : -1;
      const n = st.clip === 'x' ? V3(1, 0, 0) : st.clip === 'y' ? V3(0, 0, -1) : V3(0, 1, 0);
      plane.normal.copy(n).multiplyScalar(s);
      plane.constant = -s * st.clipPos;
      v.renderer.clippingPlanes = [plane];
    }

    function setMorph(x, set) {
      st.morph = x;
      if (set) morphS.set(x);
      const w = x <= 1 ? [x, 0] : [2 - x, x - 1];
      meshes.lh.morphTargetInfluences[0] = meshes.rh.morphTargetInfluences[0] = w[0];
      meshes.lh.morphTargetInfluences[1] = meshes.rh.morphTargetInfluences[1] = w[1];
      placeLabel();
    }

    /* ---------- right panel ---------- */
    const R = ctx.right;
    const r1 = ui.sec(R, 'Obszar');
    const pTitle = ui.el('h2', { text: 'Nie wybrano' });
    const pSub = ui.el('p', { class: 'hint', text: 'Kliknij korę, aby wybrać obszar atlasu Schaefer-400 i zobaczyć jego profil oraz łączność funkcjonalną.' });
    r1.append(pTitle, pSub);
    const pkv = ui.kv(r1, [['hemi', 'Półkula'], ['net', 'Sieć Yeo-7'], ['mes', 'Klasa Mesulama (dominująca)'], ['n', 'Wierzchołki'], ['area', 'Pole powierzchni', 'mm²'], ['cx', 'Środek ciężkości x', 'mm'], ['cy', 'y', 'mm'], ['cz', 'z', 'mm'], ['thick', 'Średnia grubość', 'mm'], ['myelin', 'Średnie T1w/T2w', 'j.u.'], ['g1', 'Średni G1'], ['g2', 'Średni G2']]);
    const r2 = ui.sec(R, 'Najsilniej skorelowane obszary');
    const top = ui.el('ol', { class: 'list' });
    r2.append(top);
    const r3 = ui.sec(R, 'Średnia łączność z sieciami');
    const nbars = ui.el('div', { class: 'bars' });
    r3.append(nbars);
    const r4 = ui.sec(R, 'Statystyki mapy');
    const skv = ui.kv(r4, [['n', 'Wierzchołki (bez ściany przyśrodkowej)'], ['mean', 'Średnia'], ['sd', 'Odchylenie std.'], ['min', 'Minimum'], ['max', 'Maksimum']]);

    function placeLabel() {
      if (!st.sel) { label.visible = false; return; }
      const p = st.sel, info = parcelInfo(p);
      const H = D.hemi[info.hemi], off = info.hemi === 'rh' ? nv : 0;
      const w = st.morph <= 1 ? [1 - st.morph, st.morph, 0] : [0, 2 - st.morph, st.morph - 1];
      let x = 0, y = 0, z = 0, n = 0;
      for (let i = 0; i < nv; i++) if (D.sch[off + i] === p) {
        x += w[0] * H.mid[i * 3] + w[1] * H.infl[i * 3] + w[2] * H.sph[i * 3];
        y += w[0] * H.mid[i * 3 + 1] + w[1] * H.infl[i * 3 + 1] + w[2] * H.sph[i * 3 + 1];
        z += w[0] * H.mid[i * 3 + 2] + w[1] * H.infl[i * 3 + 2] + w[2] * H.sph[i * 3 + 2];
        n++;
      }
      label.position.set(x / n, y / n, z / n);
      lbl.textContent = info.name;
      label.visible = true;
    }

    function select(p) {
      st.sel = p; st.seed = p;
      if (!p) return;
      const info = parcelInfo(p), P = D.parcel[p];
      pTitle.textContent = info.name;
      pSub.textContent = 'Sieć: ' + NET[info.net].n + '. Profil liczony na powierzchni środkowej; łączność to średnia macierz FC z HCP.';
      const c = D.m.parcelCentroids[p - 1];
      pkv.set('hemi', info.hemi === 'lh' ? 'lewa' : 'prawa');
      pkv.set('net', NET[info.net].k);
      let mi = 1; for (let k = 2; k <= 4; k++) if (P.mes[k] > P.mes[mi]) mi = k;
      pkv.set('mes', MES[mi].n);
      pkv.set('n', P.n, 0); pkv.set('area', P.area, 0);
      pkv.set('cx', c[0], 1); pkv.set('cy', c[1], 1); pkv.set('cz', c[2], 1);
      for (const k of ['thick', 'myelin', 'g1', 'g2']) pkv.set(k, P.sums[k] / P.n, 2);
      const row = D.fc.subarray((p - 1) * 400, p * 400);
      const idx = [...Array(400).keys()].filter((i) => i !== p - 1).sort((a, b) => row[b] - row[a]).slice(0, 10);
      top.replaceChildren(...idx.map((i) => {
        const inf = parcelInfo(i + 1);
        const li = ui.el('li', { style: 'cursor:pointer' }, [ui.el('span', null, [ui.el('i', { style: `display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${NET[inf.net].c}` }), inf.name]), ui.el('span', { class: 'num', text: 'r = ' + row[i].toFixed(2) })]);
        li.addEventListener('click', () => select(i + 1));
        return li;
      }));
      const nm = NET.map(() => [0, 0]);
      for (let i = 0; i < 400; i++) { if (i === p - 1) continue; const inf = parcelInfo(i + 1); nm[inf.net][0] += row[i]; nm[inf.net][1]++; }
      const vals = nm.map((x) => x[0] / x[1]);
      const mx = Math.max(0.05, ...vals.map(Math.abs));
      nbars.replaceChildren(...vals.map((val, k) => ui.el('div', null, [ui.el('span', { text: NET[k].k }), ui.el('b', { style: `width:${Math.max(1, Math.abs(val) / mx * 100)}%;background:${val < 0 ? '#4393c3' : NET[k].c}` }), ui.el('span', { class: 'num', text: val.toFixed(2) })])));
      if (modeSel.get() !== 'seed' && st.mode !== 'seed') { /* keep current map but highlight parcel */ }
      placeLabel();
      paint();
      fcMap.redraw();
    }

    function statsUpdate() {
      if (!MAPS[st.mode]) { ['n', 'mean', 'sd', 'min', 'max'].forEach((k) => skv.set(k, null)); histUpdate(); return; }
      const a = D.maps[st.mode].v;
      let n = 0, s = 0, s2 = 0, mn = Infinity, mx = -Infinity;
      for (let i = 0; i < a.length; i++) { const x = a[i]; if (isNaN(x)) continue; n++; s += x; s2 += x * x; if (x < mn) mn = x; if (x > mx) mx = x; }
      const m = s / n;
      skv.set('n', n, 0); skv.set('mean', m, 3); skv.set('sd', Math.sqrt(s2 / n - m * m), 3); skv.set('min', mn, 3); skv.set('max', mx, 3);
      histUpdate();
    }

    /* ---------- dock ---------- */
    const hist = plot(ctx.dock, { title: 'Rozkład wartości', sub: 'wszystkie wierzchołki kory', xlabel: '', ylabel: 'wierzchołki', series: [{ label: 'liczba', color: '#8ab4f8', bars: true, fill: 'rgba(138,180,248,.45)', dec: 0 }], legend: false });
    const netc = card(ctx.dock, 'Profil sieci', 'średnia wartość mapy w sieciach Yeo-7');
    const netBars = ui.el('div', { class: 'bars', style: 'padding:6px 4px' });
    netc.body.append(netBars);
    function histUpdate() {
      if (!MAPS[st.mode]) {
        const cats = st.mode === 'mes' ? MES.slice(1).map((m, i) => [m.n, i + 1]) : NET.map((n, i) => [n.k, i]);
        const counts = cats.map(() => 0);
        for (let i = 0; i < 2 * nv; i++) {
          if (st.mode === 'mes') { const c = D.mes[i]; if (c) counts[c - 1]++; } else { const p = D.sch[i]; if (p) counts[parcelInfo(p).net]++; }
        }
        hist.set([cats.map((c, i) => i), counts]);
        hist.card.querySelector('figcaption .sub').textContent = 'wierzchołki w klasach: ' + cats.map((c, i) => i + ' ' + c[0]).join(' · ');
        netBars.replaceChildren(ui.el('p', { class: 'hint', text: 'Wybierz mapę ciągłą (np. gradient G1), aby porównać sieci.' }));
        return;
      }
      hist.card.querySelector('figcaption .sub').textContent = MAPS[st.mode].n + (MAPS[st.mode].u ? ' [' + MAPS[st.mode].u + ']' : '');
      const a = D.maps[st.mode].v, lo = D.maps[st.mode].lo, hi = D.maps[st.mode].hi, nb = 60;
      const bins = new Array(nb).fill(0);
      for (let i = 0; i < a.length; i++) if (!isNaN(a[i])) bins[Math.min(nb - 1, Math.floor((a[i] - lo) / (hi - lo) * nb))]++;
      hist.set([bins.map((_, i) => lo + (i + 0.5) * (hi - lo) / nb), bins]);
      const sums = NET.map(() => [0, 0]);
      for (let i = 0; i < a.length; i++) { const p = D.sch[i]; if (!p || isNaN(a[i])) continue; const k = parcelInfo(p).net; sums[k][0] += a[i]; sums[k][1]++; }
      const means = sums.map((x) => x[0] / x[1]);
      const mn = Math.min(...means), mx = Math.max(...means);
      const order = means.map((m, i) => i).sort((x, y) => means[y] - means[x]);
      netBars.replaceChildren(...order.map((k) => ui.el('div', null, [ui.el('span', { text: NET[k].k }), ui.el('b', { style: `width:${Math.max(2, (means[k] - mn) / ((mx - mn) || 1) * 100)}%;background:${NET[k].c}` }), ui.el('span', { class: 'num', text: means[k].toFixed(MAPS[st.mode].d) })])));
    }
    const fcMap = heatmap(ctx.dock, {
      title: 'Macierz łączności funkcjonalnej', sub: '400 × 400, kolejność sieci Yeo-7 (L, P)', square: true, height: 260, padL: 8,
      overlay: (cx, b) => {
        cx.strokeStyle = 'rgba(255,255,255,.35)'; cx.lineWidth = 1;
        const marks = [...START.lh.slice(1, 7), 201, ...START.rh.slice(1, 7)];
        for (const s of marks) { const f = (s - 1) / 400; cx.beginPath(); cx.moveTo(b.l + f * b.w, b.t); cx.lineTo(b.l + f * b.w, b.t + b.h); cx.moveTo(b.l, b.t + f * b.h); cx.lineTo(b.l + b.w, b.t + f * b.h); cx.stroke(); }
        if (st.seed) { const f = (st.seed - 0.5) / 400; cx.strokeStyle = '#ff8a3d'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(b.l, b.t + f * b.h); cx.lineTo(b.l + b.w, b.t + f * b.h); cx.stroke(); }
      },
      onClick: ({ i, j }) => { select(Math.min(400, (399 - j) + 1)); },
      flipY: true
    });
    fcMap.draw(D.fc, 400, 400, 'rdbu', -0.7, 0.7);

    /* ---------- interaction ---------- */
    const vIndex = (h) => {
      const f = h.face, P = h.object.geometry.getAttribute('position');
      const loc = h.object.worldToLocal(h.point.clone());
      let best = f.a, bd = Infinity;
      for (const k of [f.a, f.b, f.c]) { const d = (P.getX(k) - loc.x) ** 2 + (P.getY(k) - loc.y) ** 2 + (P.getZ(k) - loc.z) ** 2; if (d < bd) { bd = d; best = k; } }
      return best;
    };
    v.onHover = (h) => {
      if (!h) { ctx.readout(null); return; }
      const hemi = h.object.userData.hemi, li = vIndex(h), gi = (hemi === 'rh' ? nv : 0) + li;
      const P = D.hemi[hemi].mid;
      const p = D.sch[gi];
      const lines = [['MNI', `x ${P[li * 3].toFixed(1)}  y ${P[li * 3 + 1].toFixed(1)}  z ${P[li * 3 + 2].toFixed(1)} mm`]];
      if (!p) lines.push(['Ściana przyśrodkowa', '(bez danych)']);
      else {
        const inf = parcelInfo(p);
        lines.push(['Obszar', inf.name], ['Sieć', NET[inf.net].n], ['Mesulam', MES[D.mes[gi]] ? MES[D.mes[gi]].n : '–']);
        lines.push(['Grubość', D.maps.thick.v[gi].toFixed(2) + ' mm  ·  T1w/T2w ' + D.maps.myelin.v[gi].toFixed(2)]);
        lines.push(['G1 / G2', D.maps.g1.v[gi].toFixed(2) + ' / ' + D.maps.g2.v[gi].toFixed(2)]);
        if (st.seed && st.mode === 'seed') lines.push(['FC z ziarnem', 'r = ' + D.fc[(st.seed - 1) * 400 + p - 1].toFixed(3)]);
      }
      ctx.readout(lines);
    };
    v.onPick = (h) => {
      if (!h) return;
      const hemi = h.object.userData.hemi, gi = (hemi === 'rh' ? nv : 0) + vIndex(h);
      const p = D.sch[gi];
      if (p) select(p);
    };

    syncMapCtl();
    paint();
    select(195);
    st.mode = 'yeo';
    paint();
    ctx.meta('Atlas: Schaefer 2018 · Mapy: HCP / BrainSpace');
  },
  unmount() {}
};

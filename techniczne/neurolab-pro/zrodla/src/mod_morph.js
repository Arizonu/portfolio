import { THREE, CSS2DObject } from './viewer.js';
import * as ui from './ui.js';
import { sample, toLin, CMAPS } from './colormaps.js';
import { plot } from './plots.js';

const TYPES = { 1: ['Soma', '#f2f2f2'], 2: ['Akson', '#79c0ff'], 3: ['Dendryty podstawne', '#ffa657'], 4: ['Dendryt szczytowy', '#d2a8ff'] };
const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const METRICS = {
  type: { n: 'Typ przedziału' },
  order: { n: 'Rząd rozgałęzienia', u: '', cm: 'turbo' },
  strahler: { n: 'Rząd Strahlera', u: '', cm: 'viridis' },
  path: { n: 'Odległość po drzewie od somy', u: 'µm', cm: 'magma' },
  euclid: { n: 'Odległość euklidesowa od somy', u: 'µm', cm: 'cividis' },
  diam: { n: 'Średnica', u: 'µm', cm: 'viridis', log: true },
  atten: { n: 'Atenuacja napięcia V/V₀ (model bierny)', u: 'log₁₀', cm: 'inferno', log: true }
};

let CELL = null;
async function loadCell() {
  if (CELL) return CELL;
  const txt = await fetch('data/L5_TTPC_C010398B-P2.swc.txt').then((r) => r.text());
  const rows = [];
  for (const line of txt.split('\n')) {
    const s = line.trim();
    if (!s || s[0] === '#') continue;
    const f = s.split(/\s+/).map(Number);
    if (f.length >= 7) rows.push(f);
  }
  const byId = new Map(rows.map((r, i) => [r[0], i]));
  const N = rows.length;
  const kids = Array.from({ length: N }, () => []);
  let root = 0;
  rows.forEach((r, i) => { if (r[6] === -1) root = i; else kids[byId.get(r[6])].push(i); });
  // breadth-first order => parent always before child (needed by the Hines solver)
  const order = [root];
  for (let q = 0; q < order.length; q++) for (const c of kids[order[q]]) order.push(c);
  const remap = new Int32Array(N);
  order.forEach((o, i) => { remap[o] = i; });
  const C = { N, x: new Float32Array(N), y: new Float32Array(N), z: new Float32Array(N), r: new Float32Array(N), type: new Uint8Array(N), par: new Int32Array(N), id: new Int32Array(N) };
  order.forEach((o, i) => {
    const r = rows[o];
    C.id[i] = r[0]; C.type[i] = r[1]; C.x[i] = r[2]; C.y[i] = r[3]; C.z[i] = r[4]; C.r[i] = r[5];
    C.par[i] = r[6] === -1 ? -1 : remap[byId.get(r[6])];
  });
  C.kids = Array.from({ length: N }, () => []);
  for (let i = 1; i < N; i++) C.kids[C.par[i]].push(i);
  // centre on soma
  const sx = C.x[0], sy = C.y[0], sz = C.z[0];
  for (let i = 0; i < N; i++) { C.x[i] -= sx; C.y[i] -= sy; C.z[i] -= sz; }
  C.somaR = C.r[0];
  // metrics
  C.segL = new Float32Array(N); C.path = new Float32Array(N); C.euclid = new Float32Array(N); C.order = new Uint8Array(N); C.strahler = new Uint8Array(N);
  for (let i = 1; i < N; i++) {
    const p = C.par[i];
    C.segL[i] = Math.hypot(C.x[i] - C.x[p], C.y[i] - C.y[p], C.z[i] - C.z[p]);
    C.path[i] = C.path[p] + (C.type[i] === 1 ? 0 : C.segL[i]);
    C.euclid[i] = Math.hypot(C.x[i], C.y[i], C.z[i]);
    const pIsBranch = C.type[p] !== 1 && C.kids[p].length > 1;
    C.order[i] = C.type[i] === 1 ? 0 : (C.type[p] === 1 ? 1 : C.order[p] + (pIsBranch ? 1 : 0));
  }
  for (let i = N - 1; i >= 0; i--) {
    const ks = C.kids[i].filter((k) => C.type[k] !== 1);
    if (!ks.length) { C.strahler[i] = 1; continue; }
    const vals = ks.map((k) => C.strahler[k]);
    const mx = Math.max(...vals);
    C.strahler[i] = vals.filter((v) => v === mx).length > 1 ? mx + 1 : mx;
  }
  // morphometrics per type
  const T = {};
  for (const t of [2, 3, 4]) T[t] = { len: 0, area: 0, vol: 0, bp: 0, tips: 0, stems: 0, maxOrder: 0, maxPath: 0, maxEuc: 0 };
  for (let i = 1; i < N; i++) {
    const t = C.type[i]; if (t === 1) continue;
    const p = C.par[i], L = C.segL[i], r1 = C.r[i], r2 = C.r[p] && C.type[p] !== 1 ? C.r[p] : C.r[i];
    const m = T[t]; if (!m) continue;
    m.len += L;
    m.area += Math.PI * (r1 + r2) * Math.sqrt(L * L + (r1 - r2) ** 2);
    m.vol += Math.PI * L * (r1 * r1 + r1 * r2 + r2 * r2) / 3;
    const nk = C.kids[i].length;
    if (nk === 0) m.tips++;
    if (nk > 1) m.bp++;
    if (C.type[p] === 1) m.stems++;
    m.maxOrder = Math.max(m.maxOrder, C.order[i]); m.maxPath = Math.max(m.maxPath, C.path[i]); m.maxEuc = Math.max(m.maxEuc, C.euclid[i]);
  }
  C.morpho = T;
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < N; i++) { const p = [C.x[i], C.y[i], C.z[i]]; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } }
  C.bbox = { mn, mx };
  return (CELL = C);
}

/* Passive cable: complex steady state on the tree (Hines elimination). Returns |V| per node for 1 nA injected at `site`. */
function solveCable(C, site, Rm, Ri, Cm, f) {
  const N = C.N, um = 1e-4, w = 2 * Math.PI * f;
  const dR = new Float64Array(N), dI = new Float64Array(N), g = new Float64Array(N);
  for (let i = 1; i < N; i++) {
    const p = C.par[i];
    const L = Math.max(C.segL[i], 0.05) * um;
    const ri = C.r[i] * um, rp = (C.type[p] === 1 ? C.r[i] : C.r[p]) * um, ra = (ri + rp) / 2;
    const ga = Math.PI * ra * ra / (Ri * L);
    g[i] = ga;
    const A = Math.PI * (ri + rp) * Math.sqrt(L * L + (ri - rp) ** 2);
    const ym = A / Rm, yc = w * Cm * 1e-6 * A;
    dR[i] += ga + ym / 2; dI[i] += yc / 2;
    dR[p] += ga + ym / 2; dI[p] += yc / 2;
  }
  const bR = new Float64Array(N), bI = new Float64Array(N);
  bR[site] = 1e-9;
  // eliminate leaves upward: row i -> d_i V_i - g_i V_p = b_i
  for (let i = N - 1; i >= 1; i--) {
    const p = C.par[i];
    const den = dR[i] * dR[i] + dI[i] * dI[i];
    // g^2 / d  (g real)
    const g2 = g[i] * g[i];
    dR[p] -= g2 * dR[i] / den; dI[p] += g2 * dI[i] / den;
    // b_p += g * b_i / d
    const qR = (bR[i] * dR[i] + bI[i] * dI[i]) / den, qI = (bI[i] * dR[i] - bR[i] * dI[i]) / den;
    bR[p] += g[i] * qR; bI[p] += g[i] * qI;
  }
  const VR = new Float64Array(N), VI = new Float64Array(N);
  let den = dR[0] * dR[0] + dI[0] * dI[0];
  VR[0] = (bR[0] * dR[0] + bI[0] * dI[0]) / den; VI[0] = (bI[0] * dR[0] - bR[0] * dI[0]) / den;
  for (let i = 1; i < N; i++) {
    const p = C.par[i];
    const nR = bR[i] + g[i] * VR[p], nI = bI[i] + g[i] * VI[p];
    den = dR[i] * dR[i] + dI[i] * dI[i];
    VR[i] = (nR * dR[i] + nI * dI[i]) / den; VI[i] = (nI * dR[i] - nR * dI[i]) / den;
  }
  const mag = new Float64Array(N);
  for (let i = 0; i < N; i++) mag[i] = Math.hypot(VR[i], VI[i]);
  return mag;
}

export default {
  id: 'morfologia', tab: 'Morfologia',
  async mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Komórka piramidowa warstwy V', 'C010398B-P2 · kora somatosensoryczna szczura · NeuroMorpho.org');
    ctx.dockSize(32);
    const C = await loadCell();
    const N = C.N;
    const st = { metric: 'type', cmap: null, rs: 2, rmin: 0.9, show: { 2: true, 3: true, 4: true }, sholl: false, shollStep: 50, site: 0, Rm: 20000, Ri: 150, Cm: 1, f: 0, bp: true };
    let V = null, Vsite = 1;

    const group = new THREE.Group();
    if (v.ok) v.root.add(group);
    v.setUnits('µm', 1);
    v.setGizmoLabels(['x', 'y (pia)', 'z']);
    v.bloom.strength = 0.25; v.bloom.threshold = 0.9;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.8 });
    let tube = null, vnode = null, bpMesh = null, skel = null;
    const soma = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 }));
    soma.userData.node = 0;
    group.add(soma);
    const marker = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xff8a3d }));
    marker.userData.skipPick = true;
    group.add(marker);
    let pathMesh = null;
    const shollG = new THREE.Group();
    group.add(shollG);
    const lab = document.createElement('div'); lab.className = 'lbl sel';
    const label = new CSS2DObject(lab); group.add(label);

    /* sections: unbranched runs */
    const sections = [];
    for (let i = 1; i < N; i++) {
      if (C.type[i] === 1) continue;
      const p = C.par[i];
      const starts = C.type[p] === 1 || C.kids[p].length > 1;
      if (!starts) continue;
      const nodes = [p, i];
      let k = i;
      while (C.kids[k].length === 1 && C.type[C.kids[k][0]] !== 1) { k = C.kids[k][0]; nodes.push(k); }
      sections.push(nodes);
    }
    const branchNodes = [];
    for (let i = 1; i < N; i++) if (C.type[i] !== 1 && C.kids[i].length > 1) branchNodes.push(i);

    function metricVal(i) {
      switch (st.metric) {
        case 'order': return C.order[i];
        case 'strahler': return C.strahler[i];
        case 'path': return C.path[i];
        case 'euclid': return C.euclid[i];
        case 'diam': return Math.log10(2 * C.r[i]);
        case 'atten': return V ? Math.log10(Math.max(1e-4, V[i] / Vsite)) : 0;
        default: return 0;
      }
    }
    function metricRange() {
      if (st.metric === 'atten') return [-2, 0];
      if (st.metric === 'diam') return [Math.log10(0.4), Math.log10(4)];
      let mx = 0; for (let i = 0; i < N; i++) mx = Math.max(mx, metricVal(i));
      return [st.metric === 'order' || st.metric === 'strahler' ? 1 : 0, mx];
    }
    const o3 = [0, 0, 0];
    function colorOf(i) {
      if (st.metric === 'type') return hex(TYPES[C.type[i]][1]);
      const [a, b] = metricRange();
      return sample(st.cmap || METRICS[st.metric].cm, (metricVal(i) - a) / (b - a), o3).slice();
    }

    function build() {
      if (tube) { group.remove(tube); tube.geometry.dispose(); }
      if (bpMesh) { group.remove(bpMesh); bpMesh.geometry.dispose(); bpMesh.material.dispose(); }
      const pos = [], nor = [], idx = [], vn = [];
      const RS = 10;
      const tmp = new THREE.Vector3();
      for (const sec of sections) {
        const t = C.type[sec[1]];
        if (!st.show[t]) continue;
        const pts = sec.map((n) => new THREE.Vector3(C.x[n], C.y[n], C.z[n]));
        if (C.type[sec[0]] === 1) { const d = pts[1].clone().normalize(); pts[0] = d.multiplyScalar(C.somaR * 0.8); }
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const samples = Math.min(200, Math.max(2, (sec.length - 1) * 3));
        const fr = curve.computeFrenetFrames(samples, false);
        const base = pos.length / 3;
        for (let s = 0; s <= samples; s++) {
          const u = s / samples;
          const P = curve.getPointAt(u);
          const fi = u * (sec.length - 1), i0 = Math.min(sec.length - 2, Math.floor(fi)), ff = fi - i0;
          const nA = sec[i0], nB = sec[i0 + 1];
          const rA = C.type[nA] === 1 ? C.r[nB] : C.r[nA];
          const r = Math.max(st.rmin, (rA + (C.r[nB] - rA) * ff) * st.rs);
          const node = ff < 0.5 ? (C.type[nA] === 1 ? nB : nA) : nB;
          const Nn = fr.normals[s], B = fr.binormals[s];
          for (let k = 0; k < RS; k++) {
            const th = k / RS * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th);
            tmp.set(Nn.x * c + B.x * sn, Nn.y * c + B.y * sn, Nn.z * c + B.z * sn);
            pos.push(P.x + tmp.x * r, P.y + tmp.y * r, P.z + tmp.z * r);
            nor.push(tmp.x, tmp.y, tmp.z);
            vn.push(node);
          }
        }
        for (let s = 0; s < samples; s++) for (let k = 0; k < RS; k++) {
          const a = base + s * RS + k, b = base + s * RS + (k + 1) % RS, c = a + RS, d = b + RS;
          idx.push(a, c, b, b, c, d);
        }
      }
      // 1-px skeleton keeps thin branches continuous at any zoom
      if (skel) { group.remove(skel); skel.geometry.dispose(); }
      const sp = [], sn = [];
      for (const sec of sections) { if (!st.show[C.type[sec[1]]]) continue; for (let k = 1; k < sec.length; k++) { const a = C.type[sec[k - 1]] === 1 ? sec[k] : sec[k - 1], b = sec[k]; sp.push(C.x[a], C.y[a], C.z[a], C.x[b], C.y[b], C.z[b]); sn.push(a, b); } }
      skel = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)).setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(sp.length), 3)), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9 }));
      skel.userData.nodes = sn; skel.userData.skipPick = true;
      group.add(skel);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length), 3));
      g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
      tube = new THREE.Mesh(g, mat);
      vnode = Int32Array.from(vn);
      group.add(tube);
      const bps = branchNodes.filter((n) => st.show[C.type[n]]);
      bpMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), Math.max(1, bps.length));
      const m4 = new THREE.Matrix4();
      bps.forEach((n, k) => { const r = Math.max(st.rmin, C.r[n] * st.rs) * 1.08; m4.makeScale(r, r, r).setPosition(C.x[n], C.y[n], C.z[n]); bpMesh.setMatrixAt(k, m4); });
      bpMesh.count = bps.length;
      bpMesh.userData.nodes = bps;
      group.add(bpMesh);
      soma.scale.setScalar(C.somaR * 1.25);
      v.pickables = [tube, soma, bpMesh];
      recolor();
    }

    function recolor() {
      if (!tube) return;
      const col = tube.geometry.getAttribute('color');
      const cache = new Map();
      for (let i = 0; i < vnode.length; i++) {
        const n = vnode[i];
        let c = cache.get(n);
        if (!c) { c = colorOf(n).map(toLin); cache.set(n, c); }
        col.array[i * 3] = c[0]; col.array[i * 3 + 1] = c[1]; col.array[i * 3 + 2] = c[2];
      }
      col.needsUpdate = true;
      if (skel) { const sc2 = skel.geometry.getAttribute('color'); skel.userData.nodes.forEach((n, k) => { let c = cache.get(n); if (!c) { c = colorOf(n).map(toLin); cache.set(n, c); } sc2.array[k * 3] = c[0]; sc2.array[k * 3 + 1] = c[1]; sc2.array[k * 3 + 2] = c[2]; }); sc2.needsUpdate = true; }
      const tc = new THREE.Color();
      bpMesh.userData.nodes.forEach((n, k) => { const c = colorOf(n); tc.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); bpMesh.setColorAt(k, tc); });
      if (bpMesh.instanceColor) bpMesh.instanceColor.needsUpdate = true;
      bpMesh.visible = st.bp;
      const sc = colorOf(0); soma.material.color.setRGB(sc[0], sc[1], sc[2], THREE.SRGBColorSpace);
      legendUpdate();
    }

    function buildSholl() {
      for (const c of [...shollG.children]) { shollG.remove(c); c.geometry.dispose(); c.material.dispose(); }
      if (!st.sholl) return;
      const maxR = Math.max(...C.euclid);
      for (let r = st.shollStep; r <= maxR; r += st.shollStep) {
        for (const ax of [0, 1]) {
          const pts = [];
          for (let k = 0; k <= 96; k++) { const t = k / 96 * Math.PI * 2; pts.push(ax ? new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0) : new THREE.Vector3(0, Math.sin(t) * r, Math.cos(t) * r)); }
          const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8ab4f8, transparent: true, opacity: 0.22 }));
          l.userData.skipPick = true;
          shollG.add(l);
        }
      }
    }

    function pathToSoma(n) {
      const out = [];
      while (n > 0) { out.push(n); n = C.par[n]; }
      out.push(0);
      return out;
    }

    function solve() {
      V = solveCable(C, st.site, st.Rm, st.Ri, st.Cm, st.f);
      RinSoma = null;
      Vsite = V[st.site];
      inspect(st.site);
      if (st.metric === 'atten') recolor();
      attenPlot();
    }

    function setSite(n) {
      st.site = n;
      marker.position.set(C.x[n], C.y[n], C.z[n]);
      marker.scale.setScalar(Math.max(2.2, Math.min(9, C.r[n] * st.rs * 2.2)));
      if (pathMesh) { group.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh.material.dispose(); pathMesh = null; }
      if (n > 0) {
        const p = pathToSoma(n).map((k) => new THREE.Vector3(C.x[k], C.y[k], C.z[k]));
        pathMesh = new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), new THREE.LineBasicMaterial({ color: 0xff8a3d, linewidth: 2, depthTest: false, transparent: true, opacity: 0.9 }));
        pathMesh.renderOrder = 5; pathMesh.userData.skipPick = true;
        group.add(pathMesh);
      }
      label.position.set(C.x[n], C.y[n] + 8, C.z[n]);
      lab.textContent = n === 0 ? 'soma' : 'punkt ' + C.id[n];
      solve();
    }

    /* ---------- UI ---------- */
    const L = ctx.left;
    const s1 = ui.sec(L, 'Kolorowanie');
    ui.select(s1, { label: 'Parametr', value: st.metric, options: Object.keys(METRICS).map((k) => [k, METRICS[k].n]), onChange: (x) => { st.metric = x; st.cmap = null; cmapSel.set(METRICS[x].cm || 'viridis'); recolor(); } });
    const cmapSel = ui.select(s1, { label: 'Paleta', value: 'viridis', options: Object.keys(CMAPS).filter((k) => k !== 'gray').map((k) => [k, CMAPS[k].name]), onChange: (x) => { st.cmap = x; recolor(); } });
    const cb = ui.colorbar(s1);
    const leg = ui.el('ul', { class: 'legend' }); s1.append(leg);
    function legendUpdate() {
      if (st.metric === 'type') { cb.el.style.display = 'none'; leg.style.display = ''; leg.replaceChildren(...Object.values(TYPES).map((t) => ui.el('li', null, [ui.el('i', { style: 'background:' + t[1] }), ui.el('span', { text: t[0] })]))); return; }
      leg.style.display = 'none'; cb.el.style.display = '';
      const [a, b] = metricRange(), M = METRICS[st.metric];
      if (st.metric === 'diam') cb.set(st.cmap || M.cm, 0.4, 4, 'średnica [µm], skala log', 1);
      else if (st.metric === 'atten') cb.set(st.cmap || M.cm, 0.01, 1, 'V / V w miejscu iniekcji (log)', 2);
      else cb.set(st.cmap || M.cm, a, b, M.u, 0);
    }
    const s2 = ui.sec(L, 'Wyświetlanie');
    ui.slider(s2, { label: 'Powiększenie promienia', min: 1, max: 6, step: 0.1, value: st.rs, unit: '×', dec: 1, onChange: (x) => { st.rs = x; build(); setSite(st.site); } });
    ui.slider(s2, { label: 'Minimalny promień rysowania', min: 0, max: 2, step: 0.05, value: st.rmin, unit: 'µm', dec: 2, onChange: (x) => { st.rmin = x; build(); } });
    for (const t of [4, 3, 2]) ui.toggle(s2, { label: TYPES[t][0], value: true, onChange: (x) => { st.show[t] = x; build(); } });
    ui.toggle(s2, { label: 'Punkty rozgałęzień', value: true, onChange: (x) => { st.bp = x; if (bpMesh) bpMesh.visible = x; } });
    ui.toggle(s2, { label: 'Okręgi Sholla', value: false, onChange: (x) => { st.sholl = x; buildSholl(); } });
    ui.slider(s2, { label: 'Krok analizy Sholla', min: 10, max: 100, step: 5, value: st.shollStep, unit: 'µm', dec: 0, onChange: (x) => { st.shollStep = x; buildSholl(); shollPlot(); } });
    const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    ui.buttons(s2, [['XY', () => v.view(V3(0, 0, 1))], ['XZ', () => v.view(V3(0, 1, 0.001), V3(0, 0, -1))], ['YZ', () => v.view(V3(1, 0, 0))]]);

    const s3 = ui.sec(L, 'Model kablowy (bierny)', 'Prąd 1 nA wstrzyknięty w wybranym punkcie; rozwiązanie zespolone dla częstotliwości f.');
    ui.slider(s3, { label: 'Rm — oporność błony', min: 2000, max: 100000, step: 1000, value: st.Rm, unit: 'Ω·cm²', dec: 0, onInput: (x) => { st.Rm = x; solve(); } });
    ui.slider(s3, { label: 'Ri — oporność aksoplazmy', min: 50, max: 400, step: 5, value: st.Ri, unit: 'Ω·cm', dec: 0, onInput: (x) => { st.Ri = x; solve(); } });
    ui.slider(s3, { label: 'Cm — pojemność właściwa', min: 0.5, max: 2, step: 0.05, value: st.Cm, unit: 'µF/cm²', dec: 2, onInput: (x) => { st.Cm = x; solve(); } });
    ui.slider(s3, { label: 'f — częstotliwość sygnału', min: 0, max: 500, step: 1, value: st.f, unit: 'Hz', dec: 0, onInput: (x) => { st.f = x; solve(); } });
    ui.buttons(s3, [['Iniekcja w somie', () => setSite(0)], ['Pokaż atenuację', () => { st.metric = 'atten'; recolor(); }, 'pri']]);
    ui.note(s3, 'Kliknij dowolny punkt drzewa, aby przenieść tam elektrodę.', 'small');

    const R = ctx.right;
    const r1 = ui.sec(R, 'Morfometria');
    const tbl = ui.el('table', { class: 'kv' });
    const T = C.morpho;
    const rows = [
      ['Całkowita długość', (m) => m.len, 'µm', 0], ['Pole powierzchni', (m) => m.area, 'µm²', 0], ['Objętość', (m) => m.vol, 'µm³', 0],
      ['Pnie (od somy)', (m) => m.stems, '', 0], ['Punkty rozgałęzień', (m) => m.bp, '', 0], ['Zakończenia', (m) => m.tips, '', 0],
      ['Maks. rząd rozgałęzienia', (m) => m.maxOrder, '', 0], ['Maks. droga od somy', (m) => m.maxPath, 'µm', 0], ['Maks. odległość euklid.', (m) => m.maxEuc, 'µm', 0]
    ];
    tbl.append(ui.el('tr', null, [ui.el('th', { text: '' }), ui.el('td', { class: 'unit', text: 'szczyt.' }), ui.el('td', { class: 'unit', text: 'podst.' }), ui.el('td', { class: 'unit', text: 'akson' })]));
    for (const [n, f, u, d] of rows) tbl.append(ui.el('tr', null, [ui.el('th', { text: n + (u ? ' [' + u + ']' : '') }), ...[4, 3, 2].map((t) => ui.el('td', { class: 'num', text: Math.round(f(T[t])).toLocaleString('pl-PL') }))]));
    r1.append(tbl);
    const bb = C.bbox;
    ui.note(r1, `Soma: promień ${C.somaR.toFixed(2)} µm. Rozpiętość: ${(bb.mx[0] - bb.mn[0]).toFixed(0)} × ${(bb.mx[1] - bb.mn[1]).toFixed(0)} × ${(bb.mx[2] - bb.mn[2]).toFixed(0)} µm. Punktów rekonstrukcji: ${N.toLocaleString('pl-PL')}.`, 'small');
    const r2 = ui.sec(R, 'Punkt pomiarowy');
    const pt = ui.kv(r2, [['id', 'Punkt SWC'], ['type', 'Przedział'], ['d', 'Średnica', 'µm'], ['order', 'Rząd rozgałęzienia'], ['strahler', 'Rząd Strahlera'], ['path', 'Droga od somy', 'µm'], ['euc', 'Odległość euklid.', 'µm'], ['lam', 'Stała długości λ (lokalna)', 'µm'], ['X', 'Odl. elektrotoniczna do somy', 'λ'], ['rin', 'Impedancja wejściowa |Z|', 'MΩ'], ['att', 'Atenuacja do somy', '%'], ['rsoma', 'Impedancja wejściowa somy', 'MΩ']]);
    let RinSoma = null;
    function inspect(n) {
      pt.set('id', C.id[n], 0); pt.set('type', TYPES[C.type[n]][0]); pt.set('d', 2 * C.r[n], 2);
      pt.set('order', C.order[n], 0); pt.set('strahler', C.strahler[n], 0); pt.set('path', C.path[n], 1); pt.set('euc', C.euclid[n], 1);
      const lam = (r) => Math.sqrt(st.Rm * (2 * r * 1e-4) / (4 * st.Ri)) * 1e4;
      pt.set('lam', lam(C.r[n]), 0);
      let X = 0; for (let k = n; k > 0; k = C.par[k]) X += C.segL[k] / lam(C.r[k]);
      pt.set('X', X, 3);
      pt.set('rin', V[n] / 1e-9 / 1e6, 1);
      pt.set('att', V[0] / V[n] * 100, 1);
      if (n === 0) RinSoma = V[0] / 1e-9 / 1e6;
      if (RinSoma == null) RinSoma = solveCable(C, 0, st.Rm, st.Ri, st.Cm, st.f)[0] / 1e-9 / 1e6;
      pt.set('rsoma', RinSoma, 1);
    }

    /* ---------- plots ---------- */
    const sholl = plot(ctx.dock, { title: 'Analiza Sholla', sub: 'liczba przecięć w funkcji promienia', xlabel: 'promień [µm]', ylabel: 'przecięcia', xDec: 0, series: [{ label: 'szczytowy', color: '#d2a8ff', dec: 0 }, { label: 'podstawne', color: '#ffa657', dec: 0 }, { label: 'akson', color: '#79c0ff', dec: 0 }, { label: 'razem', color: '#e8e9eb', width: 2, dec: 0 }] });
    function shollPlot() {
      const maxR = Math.max(...C.euclid), step = st.shollStep / 5;
      const xs = [], ys = [[], [], [], []];
      for (let r = step; r <= maxR; r += step) {
        xs.push(r);
        const c = { 4: 0, 3: 0, 2: 0 };
        for (let i = 1; i < N; i++) { const t = C.type[i]; if (t === 1) continue; const p = C.par[i]; const a = C.euclid[p], b = C.euclid[i]; if ((a < r && b >= r) || (b < r && a >= r)) c[t]++; }
        ys[0].push(c[4]); ys[1].push(c[3]); ys[2].push(c[2]); ys[3].push(c[2] + c[3] + c[4]);
      }
      sholl.set([xs, ...ys]);
    }
    const dplot = plot(ctx.dock, { title: 'Zwężanie dendrytów', sub: 'średnia średnica w funkcji drogi od somy', xlabel: 'droga od somy [µm]', ylabel: 'średnica [µm]', xDec: 0, series: [{ label: 'szczytowy', color: '#d2a8ff' }, { label: 'podstawne', color: '#ffa657' }, { label: 'akson', color: '#79c0ff' }] });
    {
      const bin = 25, nb = Math.ceil(Math.max(...C.path) / bin) + 1;
      const acc = { 4: [], 3: [], 2: [] };
      for (const t of [4, 3, 2]) for (let k = 0; k < nb; k++) acc[t].push([0, 0]);
      for (let i = 1; i < N; i++) { const t = C.type[i]; if (!acc[t]) continue; const k = Math.floor(C.path[i] / bin); acc[t][k][0] += 2 * C.r[i] * C.segL[i]; acc[t][k][1] += C.segL[i]; }
      dplot.set([[...Array(nb).keys()].map((k) => (k + 0.5) * bin), ...[4, 3, 2].map((t) => acc[t].map((a) => (a[1] > 0 ? a[0] / a[1] : null)))]);
    }
    const aplot = plot(ctx.dock, { title: 'Profil atenuacji', sub: 'napięcie wzdłuż drogi elektroda → soma', xlabel: 'droga od somy [µm]', ylabel: 'V / V₀', xDec: 0, series: [{ label: 'V/V₀', color: '#ff8a3d', width: 2, dec: 3 }], yRange: [0, 1.02] });
    function attenPlot() {
      const p = pathToSoma(st.site).reverse();
      aplot.set([p.map((k) => C.path[k]), p.map((k) => V[k] / Vsite)]);
    }

    /* ---------- interaction ---------- */
    v.onPick = (h) => {
      if (!h) return;
      let n = 0;
      if (h.object === tube) n = vnode[h.face.a];
      else if (h.object === bpMesh) n = bpMesh.userData.nodes[h.instanceId];
      setSite(n);
    };
    v.onHover = (h) => {
      if (!h) { ctx.readout(null); return; }
      let n = 0;
      if (h.object === tube) n = vnode[h.face.a]; else if (h.object === bpMesh) n = bpMesh.userData.nodes[h.instanceId];
      ctx.readout([[TYPES[C.type[n]][0], 'punkt ' + C.id[n]], ['Średnica', (2 * C.r[n]).toFixed(2) + ' µm'], ['Droga od somy', C.path[n].toFixed(1) + ' µm'], ['Rząd / Strahler', C.order[n] + ' / ' + C.strahler[n]], ['V/V₀ (elektroda)', V ? (V[n] / Vsite).toFixed(3) : '–']]);
    };

    build();
    buildSholl();
    shollPlot();
    const apicTip = (() => { let best = 0; for (let i = 1; i < N; i++) if (C.type[i] === 4 && C.kids[i].length === 0 && C.path[i] > C.path[best]) best = i; return best; })();
    setSite(apicTip);
    st.metric = 'type'; recolor();
    const cy = (bb.mx[1] + bb.mn[1]) / 2, cx0 = (bb.mx[0] + bb.mn[0]) / 2;
    if (v.ok) v.frame(new THREE.Vector3(cx0, cy, 0), Math.max(bb.mx[1] - bb.mn[1], bb.mx[0] - bb.mn[0]) * 0.4, new THREE.Vector3(0.25, 0.05, 1));
    ctx.meta('Rekonstrukcja: NeuroMorpho.org (archiwum Markram)');
  },
  unmount() {}
};

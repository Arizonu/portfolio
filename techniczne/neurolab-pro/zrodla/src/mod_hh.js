import { THREE, CSS2DObject } from './viewer.js';
import * as ui from './ui.js';
import { plot, xy } from './plots.js';
import { HH0, simCC, simVC, analyse, steady, phi } from './hh.js';

/* Lipid bilayer patch with voltage-gated Na⁺ and K⁺ channels whose states follow the HH gates. */
function buildMembrane(group) {
  const S = 104, half = S / 2, rng = mulberry(7);
  const chans = [];
  const tryPlace = (type) => {
    for (let k = 0; k < 400; k++) {
      const x = (rng() - 0.5) * (S - 16), z = (rng() - 0.5) * (S - 16);
      if (chans.every((c) => Math.hypot(c.x - x, c.z - z) > 13.2)) { chans.push({ type, x, z, u: rng(), w: rng(), state: 0 }); return; }
    }
  };
  for (let i = 0; i < 30; i++) { tryPlace('na'); if (i % 3 !== 2) tryPlace('k'); }
  // heads
  const sp = 1.0, cols = Math.floor(S / sp);
  const heads = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) {
    const x = -half + (i + 0.5 + (j % 2) * 0.5) * sp, z = -half + (j + 0.5) * sp * 0.866 * 1.15;
    if (z > half) continue;
    if (chans.some((c) => Math.hypot(c.x - x, c.z - z) < 6.2)) continue;
    heads.push(x, z);
  }
  const hg = new THREE.IcosahedronGeometry(0.47, 1);
  const hm = new THREE.MeshStandardMaterial({ color: 0xcdc3b3, roughness: 0.55, metalness: 0 });
  const nH = heads.length / 2;
  const inst = new THREE.InstancedMesh(hg, hm, nH * 2);
  const m4 = new THREE.Matrix4();
  const tc = new THREE.Color();
  for (let k = 0; k < nH; k++) {
    const x = heads[k * 2], z = heads[k * 2 + 1];
    m4.makeTranslation(x + (rng() - 0.5) * 0.15, 2.3 + (rng() - 0.5) * 0.3, z); inst.setMatrixAt(k, m4);
    m4.makeTranslation(x + (rng() - 0.5) * 0.15, -2.3 + (rng() - 0.5) * 0.3, z); inst.setMatrixAt(nH + k, m4);
    tc.setHSL(0.09, 0.18, 0.62 + (rng() - 0.5) * 0.1); inst.setColorAt(k, tc); tc.setHSL(0.09, 0.18, 0.55 + (rng() - 0.5) * 0.1); inst.setColorAt(nH + k, tc);
  }
  group.add(inst);
  const core = new THREE.Mesh(new THREE.BoxGeometry(S, 3.6, S), new THREE.MeshStandardMaterial({ color: 0xd9b26b, transparent: true, opacity: 0.22, roughness: 0.8, depthWrite: false }));
  group.add(core);
  // tails as thin lines (both leaflets) for texture
  const tl = [];
  for (let k = 0; k < nH; k += 2) { const x = heads[k * 2], z = heads[k * 2 + 1]; tl.push(x, 1.9, z, x + 0.15, 0.2, z, x, -1.9, z, x - 0.15, -0.2, z); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tl, 3));
  group.add(new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ color: 0x8c7a5a, transparent: true, opacity: 0.35 })));

  const dom = new THREE.CylinderGeometry(2.05, 2.25, 11.5, 18);
  const s4g = new THREE.SphereGeometry(1.05, 14, 10);
  const ball = new THREE.SphereGeometry(1.3, 14, 10);
  for (const c of chans) {
    const g = new THREE.Group();
    g.position.set(c.x, 0, c.z);
    g.rotation.y = rng() * Math.PI;
    const mat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.35, metalness: 0.1 });
    const s4m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x000000 });
    c.mat = mat; c.s4 = [];
    for (let q = 0; q < 4; q++) {
      const a = q / 4 * Math.PI * 2 + Math.PI / 4;
      const m = new THREE.Mesh(dom, mat); m.position.set(Math.cos(a) * 2.75, 0, Math.sin(a) * 2.75); g.add(m);
      const s = new THREE.Mesh(s4g, s4m); s.position.set(Math.cos(a) * 5.0, 0, Math.sin(a) * 5.0); g.add(s); c.s4.push(s);
    }
    if (c.type === 'na') {
      const b = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: 0xa371f7, roughness: 0.4 }));
      b.position.set(0, -8, 0); g.add(b); c.ball = b;
    }
    group.add(g);
    c.g = g;
  }
  // ion particles
  const NP = 420;
  const ions = new THREE.InstancedMesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), NP);
  const P = [];
  for (let i = 0; i < NP; i++) { P.push({ life: 1, c: null, dir: 1 }); ions.setColorAt(i, tc.set(0xffffff)); }
  group.add(ions);
  return { chans, ions, P, S };
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export default {
  id: 'blona', tab: 'Biofizyka błony',
  mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Błona aksonu: kanały Na⁺ i K⁺ bramkowane napięciem', 'model Hodgkina–Huxleya · stan kanałów losowany z m³h i n⁴');
    ctx.dockSize(46);
    const P = { ...HH0 };
    const st = { mode: 'cc', proto: 'step', amp: 10, dur: 30, ipi: 8, tmax: 60, Vh: -70, vmin: -90, vmax: 50, dv: 10, vdur: 12, play: true, speed: 4, tt: 0 };
    let tr = null, an = null, fi = null;

    const group = new THREE.Group();
    if (v.ok) v.root.add(group);
    v.setUnits('nm', 1);
    v.setGizmoLabels(['x', 'zewn.', 'z']);
    v.bloom.strength = 0.4; v.bloom.threshold = 0.8;
    const M = buildMembrane(group);
    const addLbl = (txt, x, y, z) => { const d = document.createElement('div'); d.className = 'lbl'; d.textContent = txt; const o = new CSS2DObject(d); o.position.set(x, y, z); group.add(o); };
    addLbl('zewnątrz: Na⁺ 145 mM, K⁺ 5 mM', -M.S / 2, 18, -M.S / 2);
    addLbl('cytoplazma: Na⁺ 15 mM, K⁺ 140 mM', M.S / 2, -18, M.S / 2);
    if (v.ok) v.frame(new THREE.Vector3(0, -2, 0), 52, new THREE.Vector3(0.55, 0.55, 0.9));

    /* ---------- UI ---------- */
    const L = ctx.left;
    const s0 = ui.sec(L, 'Tryb rejestracji');
    ui.seg(s0, { value: 'cc', options: [['cc', 'Current clamp'], ['vc', 'Voltage clamp']], onChange: (x) => { st.mode = x; layout(); run(); } });
    const sCC = ui.sec(L, 'Bodziec prądowy');
    ui.select(sCC, { label: 'Protokół', value: 'step', options: [['step', 'Impuls prostokątny'], ['pair', 'Dwa impulsy 1 ms (refrakcja)'], ['ramp', 'Rampa prądu']], onChange: (x) => { st.proto = x; run(); } });
    ui.slider(sCC, { label: 'Amplituda', min: 0, max: 60, step: 0.1, value: st.amp, unit: 'µA/cm²', dec: 1, onInput: (x) => { st.amp = x; run(); } });
    ui.slider(sCC, { label: 'Czas trwania', min: 0.5, max: 150, step: 0.5, value: st.dur, unit: 'ms', dec: 1, onInput: (x) => { st.dur = x; run(); } });
    ui.slider(sCC, { label: 'Odstęp impulsów (protokół 2)', min: 1, max: 30, step: 0.5, value: st.ipi, unit: 'ms', dec: 1, onInput: (x) => { st.ipi = x; run(); } });
    ui.slider(sCC, { label: 'Długość zapisu', min: 20, max: 200, step: 5, value: st.tmax, unit: 'ms', dec: 0, onChange: (x) => { st.tmax = x; run(); } });
    const sVC = ui.sec(L, 'Protokół voltage clamp');
    ui.slider(sVC, { label: 'Potencjał podtrzymania', min: -110, max: -40, step: 1, value: st.Vh, unit: 'mV', dec: 0, onInput: (x) => { st.Vh = x; run(); } });
    ui.slider(sVC, { label: 'Najniższy skok', min: -110, max: 0, step: 5, value: st.vmin, unit: 'mV', dec: 0, onInput: (x) => { st.vmin = x; run(); } });
    ui.slider(sVC, { label: 'Najwyższy skok', min: -40, max: 80, step: 5, value: st.vmax, unit: 'mV', dec: 0, onInput: (x) => { st.vmax = x; run(); } });
    ui.slider(sVC, { label: 'Czas skoku', min: 2, max: 40, step: 1, value: st.vdur, unit: 'ms', dec: 0, onInput: (x) => { st.vdur = x; run(); } });
    const s2 = ui.sec(L, 'Parametry błony');
    const mk = (k, label, min, max, step, unit, dec) => ui.slider(s2, { label, min, max, step, value: P[k], unit, dec, onInput: (x) => { P[k] = x; run(); } });
    const sl = [mk('gNa', 'ḡNa', 0, 240, 1, 'mS/cm²', 0), mk('gK', 'ḡK', 0, 72, 0.5, 'mS/cm²', 1), mk('gL', 'gL', 0, 1.5, 0.01, 'mS/cm²', 2), mk('ENa', 'ENa', 20, 80, 1, 'mV', 0), mk('EK', 'EK', -100, -60, 1, 'mV', 0), mk('T', 'Temperatura', 0, 30, 0.1, '°C', 1), mk('Cm', 'Cm', 0.5, 2, 0.05, 'µF/cm²', 2)];
    const s3 = ui.sec(L, 'Farmakologia');
    const ttx = ui.slider(s3, { label: 'Tetrodotoksyna (blok Na⁺)', min: 0, max: 1, step: 0.01, value: 0, fmt: (x) => Math.round(x * 100) + '%', onInput: (x) => { P.ttx = x; run(); } });
    const tea = ui.slider(s3, { label: 'Tetraetyloamon (blok K⁺)', min: 0, max: 1, step: 0.01, value: 0, fmt: (x) => Math.round(x * 100) + '%', onInput: (x) => { P.tea = x; run(); } });
    ui.buttons(s3, [['Parametry z 1952 r.', () => { Object.assign(P, HH0); sl.forEach((s, i) => s.set(P[['gNa', 'gK', 'gL', 'ENa', 'EK', 'T', 'Cm'][i]])); ttx.set(0); tea.set(0); run(); }], ['Policz krzywą f–I', () => fiCurve(), 'pri']]);
    const s4 = ui.sec(L, 'Odtwarzanie w 3D');
    ui.slider(s4, { label: 'Tempo', min: 0.5, max: 20, step: 0.5, value: st.speed, unit: 'ms/s', dec: 1, onInput: (x) => { st.speed = x; } });
    const scrub = ui.slider(s4, { label: 'Czas symulacji', min: 0, max: st.tmax, step: 0.05, value: 0, unit: 'ms', dec: 2, onInput: (x) => { st.tt = x; st.play = false; playB.textContent = 'Odtwarzaj'; } });
    const [playB] = ui.buttons(s4, [['Pauza', () => { st.play = !st.play; playB.textContent = st.play ? 'Pauza' : 'Odtwarzaj'; }]]);

    const R = ctx.right;
    const r1 = ui.sec(R, 'Analiza potencjału czynnościowego');
    const akv = ui.kv(r1, [['n', 'Liczba potencjałów'], ['rate', 'Częstotliwość', 'Hz'], ['lat', 'Latencja 1. PC', 'ms'], ['thr', 'Próg (dV/dt > 20 mV/ms)', 'mV'], ['peak', 'Szczyt', 'mV'], ['amp', 'Amplituda od progu', 'mV'], ['hw', 'Szerokość w połowie amplitudy', 'ms'], ['ahp', 'Hiperpolaryzacja następcza', 'mV']]);
    const r2 = ui.sec(R, 'Stan w chwili t');
    const live = ui.kv(r2, [['t', 'Czas', 'ms'], ['V', 'Potencjał błony', 'mV'], ['m', 'm (aktywacja Na⁺)'], ['h', 'h (inaktywacja Na⁺)'], ['n', 'n (aktywacja K⁺)'], ['gNa', 'gNa', 'mS/cm²'], ['gK', 'gK', 'mS/cm²'], ['oNa', 'Otwarte kanały Na⁺ (model 3D)'], ['oK', 'Otwarte kanały K⁺ (model 3D)']]);
    const r3 = ui.sec(R, 'Spoczynek');
    const rkv = ui.kv(r3, [['vr', 'Potencjał spoczynkowy', 'mV'], ['phi', 'Współczynnik temperaturowy φ'], ['tm', 'τm przy −40 mV', 'ms'], ['th', 'τh przy −40 mV', 'ms'], ['tn', 'τn przy −40 mV', 'ms']]);
    ui.legend(r3, [['#ff8a3d', 'Na⁺ otwarty'], ['#a371f7', 'Na⁺ inaktywowany'], ['#22d3ee', 'K⁺ otwarty'], ['#4b5563', 'zamknięty']]);
    ui.note(r3, 'Białe kule to segmenty S4 (czujniki napięcia): unoszą się proporcjonalnie do m lub n. Gęstość kanałów zwiększono dla czytelności.', 'small');

    /* ---------- dock ---------- */
    let plots = {};
    function layout() {
      sCC.style.display = st.mode === 'cc' ? '' : 'none';
      sVC.style.display = st.mode === 'vc' ? '' : 'none';
      for (const k in plots) plots[k].destroy && plots[k].destroy();
      ctx.dock.replaceChildren(); plots = {};
      if (st.mode === 'cc') {
        plots.V = plot(ctx.dock, { title: 'Potencjał błony', xlabel: 't [ms]', ylabel: 'Vm [mV]', y2: 'I [µA/cm²]', series: [{ label: 'Vm', color: '#e8e9eb', width: 1.8 }, { label: 'I', color: '#8ab4f8', scale: 'y2', width: 1 }], yRange: [-95, 60] });
        plots.g = plot(ctx.dock, { title: 'Zmienne bramkowania', xlabel: 't [ms]', ylabel: 'prawdopodobieństwo', series: [{ label: 'm', color: '#ff8a3d' }, { label: 'h', color: '#a371f7' }, { label: 'n', color: '#22d3ee' }], yRange: [0, 1] });
        plots.c = plot(ctx.dock, { title: 'Przewodności', xlabel: 't [ms]', ylabel: 'g [mS/cm²]', series: [{ label: 'gNa', color: '#ff8a3d' }, { label: 'gK', color: '#22d3ee' }] });
        plots.pp = xy(ctx.dock, { title: 'Płaszczyzna fazowa', sub: 'V – n', xlabel: 'Vm [mV]', ylabel: 'n' });
        plots.fi = xy(ctx.dock, { title: 'Krzywa f–I', sub: 'naciśnij „Policz krzywą f–I”', xlabel: 'I [µA/cm²]', ylabel: 'f [Hz]' });
      } else {
        plots.na = plot(ctx.dock, { title: 'Prąd sodowy INa', sub: 'rodzina skoków napięcia', xlabel: 't [ms]', ylabel: 'I [µA/cm²]', series: vcSeries('#ff8a3d'), legend: false });
        plots.k = plot(ctx.dock, { title: 'Prąd potasowy IK', xlabel: 't [ms]', ylabel: 'I [µA/cm²]', series: vcSeries('#22d3ee'), legend: false });
        plots.iv = xy(ctx.dock, { title: 'Zależność prąd–napięcie', sub: 'szczyt INa i IK w stanie ustalonym', xlabel: 'V [mV]', ylabel: 'I [µA/cm²]' });
      }
      plots.ss = xy(ctx.dock, { title: 'Kinetyka bramek', sub: 'x∞(V) — linie ciągłe; τ(V) / 10 ms — przerywane', xlabel: 'V [mV]', ylabel: 'x∞' });
    }
    function vcSeries(col) { const n = Math.floor((st.vmax - st.vmin) / st.dv) + 1; return Array.from({ length: Math.max(1, Math.min(25, n)) }, (_, i) => ({ label: '', color: col, width: 1.2 })); }

    function stimFn() {
      const t0 = 5;
      if (st.proto === 'step') return (t) => (t >= t0 && t < t0 + st.dur ? st.amp : 0);
      if (st.proto === 'pair') return (t) => ((t >= t0 && t < t0 + 1) || (t >= t0 + st.ipi && t < t0 + st.ipi + 1) ? st.amp * 3 : 0);
      return (t) => (t >= t0 && t < t0 + st.dur ? st.amp * (t - t0) / st.dur : 0);
    }

    function kineticsPlot() {
      const Vs = [], m = [], h = [], n = [], tm = [], th = [], tn = [], f = phi(P.T);
      for (let V = -100; V <= 50; V += 1) { const s = steady(V); Vs.push(V); m.push(s.m); h.push(s.h); n.push(s.n); tm.push(s.tm / f / 10); th.push(s.th / f / 10); tn.push(s.tn / f / 10); }
      plots.ss.draw([{ x: Vs, y: m, color: '#ff8a3d', label: 'm' }, { x: Vs, y: h, color: '#a371f7', label: 'h' }, { x: Vs, y: n, color: '#22d3ee', label: 'n' }, { x: Vs, y: tm, color: '#ff8a3d', dash: [4, 3] }, { x: Vs, y: th, color: '#a371f7', dash: [4, 3] }, { x: Vs, y: tn, color: '#22d3ee', dash: [4, 3] }], [-100, 50], [0, 1], { legend: true });
      const s = steady(-40);
      rkv.set('phi', f, 2); rkv.set('tm', s.tm / f, 3); rkv.set('th', s.th / f, 2); rkv.set('tn', s.tn / f, 2);
    }

    let timer = 0;
    function run() { clearTimeout(timer); timer = setTimeout(runNow, 30); }
    function runNow() {
      kineticsPlot();
      const rest = simCC(P, () => 0, 300, { sample: 5, noTrace: false });
      rkv.set('vr', rest.V[rest.V.length - 1], 2);
      if (st.mode === 'cc') {
        tr = simCC(P, stimFn(), st.tmax, { sample: 0.025, V0: rest.V[rest.V.length - 1] });
        an = analyse(tr);
        plots.V.set([tr.t, tr.V, tr.I]);
        plots.g.set([tr.t, tr.m, tr.h, tr.n]);
        plots.c.set([tr.t, tr.gNa, tr.gK]);
        plots.pp.draw([{ x: tr.V, y: tr.n, color: '#8ab4f8' }], [-95, 60], [0, 1]);
        akv.set('n', an.n, 0); akv.set('rate', an.rate, 1); akv.set('lat', an.lat != null ? an.lat - 5 : null, 2); akv.set('thr', an.thr, 1); akv.set('peak', an.peak, 1); akv.set('amp', an.amp, 1); akv.set('hw', an.hw, 2); akv.set('ahp', an.ahp, 1);
        scrub.input.max = st.tmax;
        if (fi) drawFI();
      } else {
        const Vs = []; for (let V = st.vmin; V <= st.vmax + 1e-9 && Vs.length < 25; V += st.dv) Vs.push(V);
        if (plots.na.u.series.length - 1 !== Vs.length) { layout(); }
        const t0 = 2, tmax = t0 + st.vdur + 4;
        const res = Vs.map((Vc) => simVC(P, st.Vh, Vc, t0, st.vdur, tmax));
        const t = res[0].t;
        plots.na.set([t, ...res.map((r) => r.INa)]);
        plots.k.set([t, ...res.map((r) => r.IK)]);
        const peakNa = res.map((r) => r.INa.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0));
        const ssK = res.map((r) => r.IK[Math.floor((t0 + st.vdur - 0.1) / 0.02)]);
        const all = peakNa.concat(ssK);
        plots.iv.draw([{ x: Vs, y: peakNa, color: '#ff8a3d', label: 'szczyt INa' }, { x: Vs, y: ssK, color: '#22d3ee', label: 'IK ustalony' }, { x: Vs, y: peakNa, color: '#ff8a3d', dots: 3 }, { x: Vs, y: ssK, color: '#22d3ee', dots: 3 }, { x: [st.vmin, st.vmax], y: [0, 0], color: '#555', width: 1 }], [st.vmin, st.vmax], [Math.min(...all) * 1.1, Math.max(...all) * 1.1], { legend: true });
        tr = { t, V: res[res.length - 1].V, m: [], h: [], n: [] };
        const Vc = Vs[Vs.length - 1], a = steady(st.Vh), b = steady(Vc), f = phi(P.T);
        for (const tt of t) {
          if (tt < t0 || tt > t0 + st.vdur) { tr.m.push(a.m); tr.h.push(a.h); tr.n.push(a.n); continue; }
          const u = tt - t0;
          tr.m.push(b.m + (a.m - b.m) * Math.exp(-u * f / b.tm)); tr.h.push(b.h + (a.h - b.h) * Math.exp(-u * f / b.th)); tr.n.push(b.n + (a.n - b.n) * Math.exp(-u * f / b.tn));
        }
        ['n', 'rate', 'lat', 'thr', 'peak', 'amp', 'hw', 'ahp'].forEach((k) => akv.set(k, null));
        scrub.input.max = tmax;
      }
      if (st.tt > +scrub.input.max) st.tt = 0;
    }
    function fiCurve() {
      ctx.busy(true);
      setTimeout(() => {
        const I = [], F = [];
        for (let a = 0; a <= 40; a += 0.5) {
          const r = simCC(P, (t) => (t >= 0 ? a : 0), 500, { noTrace: true, dt: Math.min(0.02, 0.03 / phi(P.T)) });
          const sp = r.spikes.filter((t) => t > 100);
          I.push(a); F.push(sp.length > 1 ? 1000 * (sp.length - 1) / (sp[sp.length - 1] - sp[0]) : 0);
        }
        fi = { I, F };
        drawFI();
        ctx.busy(false);
      }, 20);
    }
    function drawFI() {
      if (!plots.fi) return;
      const on = fi.F.findIndex((f) => f > 0);
      plots.fi.draw([{ x: fi.I, y: fi.F, color: '#e8e9eb' }, { x: fi.I, y: fi.F, color: '#e8e9eb', dots: 2 }], [0, 40], [0, Math.max(50, ...fi.F) * 1.1], { marker: st.amp <= 40 ? [st.amp, fi.F[Math.round(st.amp * 2)] || 0] : null });
      plots.fi.card.querySelector('figcaption .sub').textContent = on >= 0 ? 'próg wyładowań ciągłych ≈ ' + fi.I[on].toFixed(1) + ' µA/cm² (skok — pobudliwość typu II)' : 'brak wyładowań ciągłych';
    }

    /* ---------- 3D playback ---------- */
    const tc = new THREE.Color();
    const C_OPEN_NA = new THREE.Color(0xff8a3d), C_OPEN_K = new THREE.Color(0x22d3ee), C_CLOSED = new THREE.Color(0x4b5563), C_INACT = new THREE.Color(0xa371f7);
    const rng = mulberry(3), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
    let ionK = 0, emit = 0, lastUi = 0;
    v.frames.push((t, dt) => {
      if (!tr) return;
      if (st.play) { st.tt += dt * st.speed; if (st.tt > tr.t[tr.t.length - 1]) st.tt = 0; }
      const i = Math.min(tr.t.length - 1, Math.max(0, Math.round(st.tt / (tr.t[1] - tr.t[0]))));
      const m = tr.m[i], h = tr.h[i], n = tr.n[i];
      const pNa = m * m * m * h * (1 - P.ttx), pK = n ** 4 * (1 - P.tea);
      let oNa = 0, oK = 0;
      for (const c of M.chans) {
        c.u = (c.u + (rng() - 0.5) * dt * 3 + 1) % 1; c.w = (c.w + (rng() - 0.5) * dt * 2 + 1) % 1;
        let s;
        if (c.type === 'na') { s = c.u < pNa ? 1 : (c.w < 1 - h ? 2 : 0); if (s === 1) oNa++; }
        else { s = c.u < pK ? 1 : 0; if (s === 1) oK++; }
        c.state = s;
        c.mat.color.copy(s === 1 ? (c.type === 'na' ? C_OPEN_NA : C_OPEN_K) : s === 2 ? C_INACT : C_CLOSED);
        c.mat.emissive.copy(s === 1 ? (c.type === 'na' ? C_OPEN_NA : C_OPEN_K) : C_CLOSED).multiplyScalar(s === 1 ? 0.35 : 0);
        const act = c.type === 'na' ? m : n;
        for (const s4 of c.s4) s4.position.y = -3.2 + 6.4 * act;
        if (c.ball) c.ball.position.y = -8 + 3.4 * (1 - h);
      }
      emit += dt;
      while (emit > 0.008) {
        emit -= 0.008;
        const open = M.chans.filter((c) => c.state === 1);
        if (!open.length) break;
        const c = open[Math.floor(rng() * open.length)];
        const p = M.P[ionK % M.P.length]; ionK++;
        p.life = 0; p.c = c; p.dir = c.type === 'na' ? -1 : 1; p.ox = (rng() - 0.5) * 1.2; p.oz = (rng() - 0.5) * 1.2;
        M.ions.setColorAt((ionK - 1) % M.P.length, tc.copy(c.type === 'na' ? C_OPEN_NA : C_OPEN_K));
        if (M.ions.instanceColor) M.ions.instanceColor.needsUpdate = true;
      }
      for (let k = 0; k < M.P.length; k++) {
        const p = M.P[k];
        if (p.life >= 1 || !p.c) { sc.setScalar(0.0001); pv.set(0, -999, 0); }
        else {
          p.life += dt * 0.9;
          const y = -p.dir * 14 + p.dir * 28 * p.life;
          const spread = Math.abs(y) > 6 ? (Math.abs(y) - 6) * 0.35 : 0;
          pv.set(p.c.x + p.ox * (1 + spread), y, p.c.z + p.oz * (1 + spread)); sc.setScalar(1);
        }
        m4.compose(pv, q, sc); M.ions.setMatrixAt(k, m4);
      }
      M.ions.instanceMatrix.needsUpdate = true;
      if (t - lastUi > 0.12) {
        lastUi = t;
        scrub.set(st.tt);
        live.set('t', tr.t[i], 2); live.set('V', tr.V[i], 1); live.set('m', m, 3); live.set('h', h, 3); live.set('n', n, 3);
        live.set('gNa', P.gNa * (1 - P.ttx) * m * m * m * h, 2); live.set('gK', P.gK * (1 - P.tea) * n ** 4, 2);
        live.set('oNa', oNa + ' / ' + M.chans.filter((c) => c.type === 'na').length); live.set('oK', oK + ' / ' + M.chans.filter((c) => c.type === 'k').length);
        const pl = plots.V || plots.na;
        if (pl) { try { pl.cursorAt(tr.t[i]); } catch (e) { /* ignore */ } }
        if (plots.pp && st.mode === 'cc') plots.pp.setMarker([tr.V[i], n]);
        ctx.title('Błona aksonu: kanały Na⁺ i K⁺ bramkowane napięciem', `t = ${tr.t[i].toFixed(2)} ms · Vm = ${tr.V[i].toFixed(1)} mV · otwarte Na⁺ ${oNa}, K⁺ ${oK}`);
      }
    });

    layout();
    runNow();
    ctx.meta('Hodgkin i Huxley, 1952 · J. Physiol. 117: 500–544');
  },
  unmount() {}
};

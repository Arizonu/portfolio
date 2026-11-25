import { THREE } from './viewer.js';
import * as ui from './ui.js';
import { plot, xy } from './plots.js';

function rngF(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* Brunel (2000) model A: sparse random LIF network, delta synapses, fixed in-degree. */
export function simBrunel(p) {
  const NE = p.NE, NI = p.NI, N = NE + NI, CE = Math.round(p.eps * NE), CI = Math.round(p.eps * NI);
  const rnd = rngF(p.seed || 1);
  const dt = 0.1, T = p.T, steps = Math.round(T / dt), Dst = Math.max(1, Math.round(p.D / dt));
  const theta = 20, Vr = 10, tau = 20, trp = 2;
  const J = p.J, JI = -p.g * J;
  // outgoing adjacency via fixed in-degree
  const deg = new Int32Array(N);
  const pre = new Int32Array(N * (CE + CI));
  for (let j = 0, k = 0; j < N; j++) {
    for (let c = 0; c < CE; c++) { const i = Math.floor(rnd() * NE); pre[k++] = i; deg[i]++; }
    for (let c = 0; c < CI; c++) { const i = NE + Math.floor(rnd() * NI); pre[k++] = i; deg[i]++; }
  }
  const off = new Int32Array(N + 1);
  for (let i = 0; i < N; i++) off[i + 1] = off[i] + deg[i];
  const post = new Int32Array(off[N]);
  const fill = off.slice(0, N);
  for (let j = 0, k = 0; j < N; j++) for (let c = 0; c < CE + CI; c++, k++) { const i = pre[k]; post[fill[i]++] = j; }
  const nuThr = theta / (J * CE * tau); // 1/ms
  const lam = CE * p.eta * nuThr * dt;
  const L = Math.exp(-lam);
  const pois = () => { let k = 0, q = rnd(); while (q > L) { k++; q *= rnd(); } return k; };
  const V = new Float32Array(N), ref = new Float32Array(N);
  for (let i = 0; i < N; i++) V[i] = rnd() * theta;
  const ring = Array.from({ length: Dst + 1 }, () => new Float32Array(N));
  const spT = [], spI = [];
  const S = 200; const sumV = new Float64Array(S), sumV2 = new Float64Array(S); let sumM = 0, sumM2 = 0, nRec = 0;
  const t0 = p.Ttrans;
  for (let s = 0; s < steps; s++) {
    const t = s * dt;
    const buf = ring[s % (Dst + 1)];
    const out = ring[(s + Dst) % (Dst + 1)];
    for (let i = 0; i < N; i++) {
      const inp = buf[i] + J * pois();
      buf[i] = 0;
      if (ref[i] > 0) { ref[i] -= dt; continue; }
      V[i] += -V[i] / tau * dt + inp;
      if (V[i] >= theta) {
        V[i] = Vr; ref[i] = trp;
        spT.push(t); spI.push(i);
        const w = i < NE ? J : JI;
        for (let k = off[i]; k < off[i + 1]; k++) out[post[k]] += w;
      }
    }
    if (t >= t0 && s % 2 === 0) {
      let m = 0;
      for (let k = 0; k < S; k++) { const x = V[k * Math.floor(N / S)]; sumV[k] += x; sumV2[k] += x * x; m += x; }
      m /= S; sumM += m; sumM2 += m * m; nRec++;
    }
  }
  let varI = 0; for (let k = 0; k < S; k++) { const mu = sumV[k] / nRec; varI += sumV2[k] / nRec - mu * mu; }
  varI /= S;
  const muM = sumM / nRec, varM = sumM2 / nRec - muM * muM;
  return { spT: Float32Array.from(spT), spI: Int32Array.from(spI), N, NE, NI, CE, CI, T, t0, nuThr: nuThr * 1000, chi: Math.sqrt(Math.max(0, varM / varI)) };
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui2 = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui2 + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui2 - vi; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
  }
}

const PRESETS = { A: { g: 3, eta: 2, n: 'A (SR)' }, B: { g: 6, eta: 4, n: 'B (SI szybki)' }, C: { g: 5, eta: 2, n: 'C (AI)' }, D: { g: 4.5, eta: 0.9, n: 'D (SI wolny)' } };

export default {
  id: 'siec', tab: 'Dynamika sieci',
  mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Rzadka sieć losowa neuronów LIF', 'model A Brunela (2000) · 1600 E + 400 I · ε = 0,1');
    ctx.dockSize(44);
    const st = { g: 5, eta: 2, J: 0.6, D: 1.5, NE: 1600, NI: 400, eps: 0.1, T: 1200, Ttrans: 200, speed: 60, tt: 200, play: true };
    let R = null;

    /* 3D column */
    const group = new THREE.Group();
    if (v.ok) v.root.add(group);
    v.setUnits('µm', 1); v.setGizmoLabels(['x', 'y', 'z']);
    v.bloom.strength = 0.55; v.bloom.threshold = 0.6; v.bloom.radius = 0.4;
    const N = st.NE + st.NI, rnd = rngF(3), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 160; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = (rnd() - 0.5) * 380; pos[i * 3 + 2] = Math.sin(a) * r; }
    const cE = new THREE.Color(0x1f4f73), cI = new THREE.Color(0x7a2d55), cF = new THREE.Color(0xffd29a);
    const geoE = new THREE.ConeGeometry(2.6, 6.5, 6), geoI = new THREE.SphereGeometry(2.6, 10, 8);
    const mE = new THREE.InstancedMesh(geoE, new THREE.MeshStandardMaterial({ roughness: 0.4 }), st.NE), mI = new THREE.InstancedMesh(geoI, new THREE.MeshStandardMaterial({ roughness: 0.4 }), st.NI);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < N; i++) { m4.makeTranslation(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); if (i < st.NE) { mE.setMatrixAt(i, m4); mE.setColorAt(i, cE); } else { mI.setMatrixAt(i - st.NE, m4); mI.setColorAt(i - st.NE, cI); } }
    group.add(mE, mI);
    const lp = [];
    for (let k = 0; k < 2200; k++) { const a = Math.floor(rnd() * N), b = Math.floor(rnd() * N); lp.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5a7ea8, transparent: true, opacity: 0.06, depthWrite: false })));
    if (v.ok) v.frame(new THREE.Vector3(0, 0, 0), 260, new THREE.Vector3(0.6, 0.25, 1));
    const glow = new Float32Array(N);

    /* UI */
    const L = ctx.left;
    const s0 = ui.sec(L, 'Stany z pracy Brunela (rys. 8)');
    ui.buttons(s0, Object.entries(PRESETS).map(([k, p]) => [p.n, () => { st.g = p.g; st.eta = p.eta; gSl.set(p.g); eSl.set(p.eta); run(); }]));
    const s1 = ui.sec(L, 'Parametry');
    const gSl = ui.slider(s1, { label: 'g — względna siła hamowania', min: 0, max: 8, step: 0.1, value: st.g, dec: 1, onChange: (x) => { st.g = x; run(); } });
    const eSl = ui.slider(s1, { label: 'η = ν_ext / ν_thr', min: 0.5, max: 4, step: 0.05, value: st.eta, dec: 2, onChange: (x) => { st.eta = x; run(); } });
    ui.slider(s1, { label: 'J — waga synapsy pobudzającej', min: 0.1, max: 1.2, step: 0.05, value: st.J, unit: 'mV', dec: 2, onChange: (x) => { st.J = x; run(); } });
    ui.slider(s1, { label: 'D — opóźnienie synaptyczne', min: 0.5, max: 5, step: 0.1, value: st.D, unit: 'ms', dec: 1, onChange: (x) => { st.D = x; run(); } });
    ui.note(s1, 'θ = 20 mV, Vr = 10 mV, τ = 20 ms, refrakcja 2 ms, krok 0,1 ms; symulacja 1,2 s, analiza po odrzuceniu pierwszych 200 ms. Sieć ma 2000 neuronów zamiast 12 500 u Brunela, więc fluktuacje skończonego rozmiaru mogą przesuwać granice stanów.', 'small');
    const s2 = ui.sec(L, 'Odtwarzanie w 3D');
    ui.slider(s2, { label: 'Tempo', min: 5, max: 300, step: 5, value: st.speed, unit: 'ms/s', dec: 0, onInput: (x) => { st.speed = x; } });

    const Rp = ctx.right;
    const r0 = ui.sec(Rp, 'Diagnoza stanu');
    const regime = ui.el('h2', { text: '–' }); r0.append(regime);
    const regNote = ui.note(r0, '', 'hint');
    const kv = ui.kv(Rp, [['rE', 'Średnia częstotliwość E', 'Hz'], ['rI', 'Średnia częstotliwość I', 'Hz'], ['cv', 'Średni CV ISI'], ['chi', 'Synchronia χ (Golomb)'], ['fpk', 'Szczyt widma aktywności', 'Hz'], ['nu', 'ν_thr', 'Hz'], ['fano', 'Fano aktywności populacji (1 ms)'], ['ce', 'C_E / C_I (wejścia)'], ['nsp', 'Liczba impulsów'], ['ms', 'Czas obliczeń', 'ms']]);
    ui.sec(Rp, 'Płaszczyzna parametrów');
    const pd = xy(Rp, { title: 'g × η', sub: 'punkty A–D z pracy Brunela; pomarańczowy — bieżący', xlabel: 'g', ylabel: 'η', height: 200 });

    /* dock */
    const ras = xy(ctx.dock, { title: 'Wykres rastrowy', sub: '150 neuronów E (dół) i 50 I (góra)', xlabel: 't [ms]', ylabel: 'neuron' });
    const pr = plot(ctx.dock, { title: 'Aktywność populacji', sub: 'koszyki 1 ms', xlabel: 't [ms]', ylabel: 'ν [Hz]', series: [{ label: 'ν(t)', color: '#8ab4f8', step: true, fill: 'rgba(138,180,248,.18)' }] });
    const ps = plot(ctx.dock, { title: 'Widmo mocy aktywności', xlabel: 'f [Hz]', ylabel: 'moc [j.u.]', series: [{ label: 'moc', color: '#ff8a3d' }] });
    const hc = plot(ctx.dock, { title: 'Rozkład CV ISI', xlabel: 'CV', ylabel: 'neurony', series: [{ label: 'neurony', color: '#7ee787', bars: true, fill: 'rgba(126,231,135,.45)', dec: 0 }], legend: false });
    const hr = plot(ctx.dock, { title: 'Rozkład częstotliwości', xlabel: 'ν [Hz]', ylabel: 'neurony', series: [{ label: 'neurony', color: '#d2a8ff', bars: true, fill: 'rgba(210,168,255,.45)', dec: 0 }], legend: false });

    let timer = 0;
    function run() { clearTimeout(timer); ctx.busy(true); timer = setTimeout(runNow, 30); }
    function runNow() {
      const T0 = performance.now();
      R = simBrunel(st);
      const ms = performance.now() - T0;
      const { spT, spI, NE, NI } = R;
      const t0 = st.Ttrans, Tw = st.T - t0;
      const cnt = new Float64Array(R.N), last = new Float64Array(R.N).fill(-1);
      const isi = Array.from({ length: R.N }, () => [0, 0, 0]);
      const bins = new Float64Array(Math.floor(Tw));
      const rx = [], ry = [];
      for (let k = 0; k < spT.length; k++) {
        const t = spT[k], i = spI[k];
        if (t < t0) { last[i] = t; continue; }
        cnt[i]++;
        bins[Math.min(bins.length - 1, Math.floor(t - t0))]++;
        if (last[i] >= 0) { const d = t - last[i]; isi[i][0]++; isi[i][1] += d; isi[i][2] += d * d; }
        last[i] = t;
        if (t < t0 + 400) { if (i < 150) { rx.push(t); ry.push(i); } else if (i >= NE && i < NE + 50) { rx.push(t); ry.push(150 + i - NE); } }
      }
      let rE = 0, rI = 0; for (let i = 0; i < NE; i++) rE += cnt[i]; for (let i = NE; i < R.N; i++) rI += cnt[i];
      rE = rE / NE / (Tw / 1000); rI = rI / NI / (Tw / 1000);
      const cvs = [];
      for (let i = 0; i < R.N; i++) { const [n, s, s2] = isi[i]; if (n >= 3) { const m = s / n; cvs.push(Math.sqrt(Math.max(0, s2 / n - m * m)) / m); } }
      const cvm = cvs.length ? cvs.reduce((a, b) => a + b, 0) / cvs.length : NaN;
      const rate = Array.from(bins, (b) => b / R.N / 0.001);
      pr.set([rate.map((_, i) => t0 + i), rate]);
      pr.u.setScale('x', { min: t0, max: t0 + 400 });
      ras.draw([{ x: rx.filter((_, k) => ry[k] < 150), y: ry.filter((y) => y < 150), color: '#8ab4f8', dots: 1.2 }, { x: rx.filter((_, k) => ry[k] >= 150), y: ry.filter((y) => y >= 150), color: '#f472b6', dots: 1.2 }], [t0, t0 + 400], [0, 200]);
      // spectrum
      const n = 1024, re = new Float64Array(n), im = new Float64Array(n);
      const mu = rate.reduce((a, b) => a + b, 0) / rate.length;
      for (let i = 0; i < n; i++) re[i] = ((rate[i] || mu) - mu) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)));
      fft(re, im);
      const fx = [], pw = [];
      for (let k = 1; k < n / 2; k++) { const f = k * 1000 / n; if (f > 400) break; fx.push(f); pw.push((re[k] ** 2 + im[k] ** 2) / n); }
      ps.set([fx, pw]);
      let kpk = 0; while (kpk < fx.length - 1 && fx[kpk] < 5) kpk++; for (let k = kpk + 1; k < pw.length; k++) if (pw[k] > pw[kpk]) kpk = k;
      const fpk = fx[kpk];
      const hist = (vals, lo, hi, nb) => { const b = new Array(nb).fill(0); for (const x of vals) if (isFinite(x)) b[Math.min(nb - 1, Math.max(0, Math.floor((x - lo) / (hi - lo) * nb)))]++; return [b.map((_, i) => lo + (i + 0.5) * (hi - lo) / nb), b]; };
      hc.set(hist(cvs, 0, 2, 40));
      const rates = Array.from(cnt, (c) => c / (Tw / 1000));
      hr.set(hist(rates, 0, Math.max(10, Math.max(...rates)), 40));
      kv.set('rE', rE, 2); kv.set('rI', rI, 2); kv.set('cv', cvm, 2); kv.set('chi', R.chi, 3); kv.set('fpk', fpk, 0); kv.set('nu', R.nuThr, 1); kv.set('ce', R.CE + ' / ' + R.CI); kv.set('nsp', spT.length, 0); kv.set('ms', ms, 0);
      const bm = bins.reduce((a, b) => a + b, 0) / bins.length; let bv = 0; for (const b of bins) bv += (b - bm) ** 2; bv /= bins.length;
      const fano = bm > 0 ? bv / bm : NaN;
      kv.set('fano', fano, 1);
      let name, desc;
      if (rE < 0.3) { name = 'Sieć prawie cicha'; desc = 'Hamowanie lub zbyt słabe wejście tłumi wyładowania.'; }
      else if (cvm < 0.35) { name = 'Synchroniczny regularny (SR)'; desc = 'Przewaga pobudzenia: neurony wyładowują się prawie regularnie (CV ISI ≪ 1) i razem; populacja oscyluje z okresem zbliżonym do czasu refrakcji i opóźnienia.'; }
      else if (fano < 3) { name = 'Asynchroniczny nieregularny (AI)'; desc = 'Równowaga pobudzenia i hamowania: pojedyncze neurony strzelają nieregularnie, a aktywność populacji jest prawie płaska (Fano ≈ 1 jak dla niezależnych procesów Poissona).'; }
      else if (fpk > 60) { name = 'Synchroniczny nieregularny, szybki (SI)'; desc = 'Pojedyncze neurony są nieregularne, ale populacja oscyluje szybko (okres rzędu kilku opóźnień D).'; }
      else { name = 'Synchroniczny nieregularny, wolny (SI)'; desc = 'Pojedyncze neurony są nieregularne, a populacja przechodzi wolne, globalne fale aktywności.'; }
      desc += ' Klasyfikacja wynika z pomiarów tej symulacji (CV, Fano, widmo).';
      regime.textContent = name; regNote.textContent = desc;
      pd.draw([{ x: [3, 6, 5, 4.5], y: [2, 4, 2, 0.9], color: '#8ab4f8', dots: 4 }, { x: [4, 4], y: [0.5, 4], color: '#555', width: 1, dash: [3, 3] }], [0, 8], [0.5, 4.2], { marker: [st.g, st.eta] });
      st.tt = t0;
      ctx.busy(false);
    }

    /* playback */
    const tc = new THREE.Color();
    let ptr = 0, lastT = 0;
    v.frames.push((t, dt) => {
      if (!R) return;
      const prev = st.tt;
      st.tt += dt * st.speed;
      if (st.tt > st.T) { st.tt = st.Ttrans; ptr = 0; }
      if (st.tt < prev) ptr = 0;
      const { spT, spI } = R;
      while (ptr < spT.length && spT[ptr] < prev) ptr++;
      while (ptr < spT.length && spT[ptr] < st.tt) { glow[spI[ptr]] = 1; ptr++; }
      const k = Math.exp(-dt * 7);
      for (let i = 0; i < N; i++) {
        if (glow[i] < 0.002 && glow[i] !== 0) glow[i] = 0;
        tc.copy(i < st.NE ? cE : cI).lerp(cF, glow[i]);
        if (i < st.NE) mE.setColorAt(i, tc); else mI.setColorAt(i - st.NE, tc);
        glow[i] *= k;
      }
      mE.instanceColor.needsUpdate = true; mI.instanceColor.needsUpdate = true;
      if (t - lastT > 0.15) { lastT = t; ctx.title('Rzadka sieć losowa neuronów LIF', `t = ${st.tt.toFixed(0)} ms · g = ${st.g} · η = ${st.eta}`); }
    });
    runNow();
    ctx.meta('Brunel, 2000 · J. Comput. Neurosci. 8: 183–208');
  },
  unmount() {}
};

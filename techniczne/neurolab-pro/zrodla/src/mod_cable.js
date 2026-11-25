import { THREE } from './viewer.js';
import * as ui from './ui.js';
import { plot, heatmap, xy } from './plots.js';
import { rates, steady, phi } from './hh.js';
import { sample, toLin } from './colormaps.js';

/* Multicompartment HH cable, backward-Euler (Thomas algorithm) with exponential-Euler gates. */
export function simAxon(o) {
  const f = phi(o.T);
  const d = o.d * 1e-4; // cm
  const comp = [];
  if (!o.myelin) {
    const lam = Math.sqrt((1 / (0.3e-3)) * d / (4 * o.Ri));
    const n = 260, dx = 26 * lam / n;
    for (let i = 0; i < n; i++) comp.push({ dx, node: true, x: (i + 0.5) * dx });
  } else {
    const Lint = o.Lint * 1e-4, nodeL = 1e-4, sub = 10;
    let x = 0;
    for (let k = 0; k < o.nInt; k++) {
      comp.push({ dx: nodeL, node: true, x: x + nodeL / 2 }); x += nodeL;
      for (let s = 0; s < sub; s++) { comp.push({ dx: Lint / sub, node: false, x: x + Lint / sub / 2 }); x += Lint / sub; }
    }
    comp.push({ dx: nodeL, node: true, x: x + nodeL / 2 });
  }
  const N = comp.length;
  const gq = Math.pow(o.gQ10 || 1.5, (o.T - 6.3) / 10); // conductance Q10 (amplitudes also rise with temperature)
  const A = new Float64Array(N), Cm = new Float64Array(N), gNa = new Float64Array(N), gK = new Float64Array(N), gL = new Float64Array(N), ga = new Float64Array(N);
  const lamN = Math.max(1, o.lam || 60);
  for (let i = 0; i < N; i++) {
    const c = comp[i];
    A[i] = Math.PI * d * c.dx;
    if (c.node) { const s = (o.myelin ? 10 : 1) * gq; Cm[i] = 1 * A[i]; gNa[i] = 120 * s * A[i]; gK[i] = 36 * s * A[i]; gL[i] = 0.3 * s * A[i]; }
    else { Cm[i] = A[i] / (2 * lamN); gNa[i] = 0; gK[i] = 0; gL[i] = 0.3 * gq * A[i] / (2 * lamN); }
    if (i < N - 1) ga[i] = 1e3 * Math.PI * d * d / 4 / (o.Ri * (c.dx / 2 + comp[i + 1].dx / 2));
  }
  const s0 = steady(-65);
  const V = new Float64Array(N).fill(-65), m = new Float64Array(N).fill(s0.m), h = new Float64Array(N).fill(s0.h), n = new Float64Array(N).fill(s0.n);
  // kick: depolarise the first ~3% of the axon (or first node + internode)
  const kick = o.myelin ? sub11(comp) : Math.max(3, Math.round(N * 0.03));
  for (let i = 0; i < kick; i++) V[i] = 15;
  const dt = Math.max(0.0005, Math.min(0.01, 0.01 / f)) * (o.myelin ? 0.5 : 1);
  const tmax = o.tmax || 30;
  const rec = Math.max(1, Math.round((o.recDt || 0.05 / f) / dt));
  const frames = [], times = [];
  const aa = new Float64Array(N), bb = new Float64Array(N), cc = new Float64Array(N), rr = new Float64Array(N);
  const cross = new Float64Array(N).fill(NaN);
  const ENa = 50, EK = -77, EL = -54.387;
  let steps = Math.round(tmax / dt);
  for (let s = 0; s <= steps; s++) {
    const t = s * dt;
    if (s % rec === 0) { frames.push(Float32Array.from(V)); times.push(t); }
    for (let i = 0; i < N; i++) {
      if (gNa[i] > 0) {
        const r = rates(V[i]);
        const am = r[0] * f, bm = r[1] * f, ah = r[2] * f, bh = r[3] * f, an = r[4] * f, bn = r[5] * f;
        m[i] = am / (am + bm) + (m[i] - am / (am + bm)) * Math.exp(-(am + bm) * dt);
        h[i] = ah / (ah + bh) + (h[i] - ah / (ah + bh)) * Math.exp(-(ah + bh) * dt);
        n[i] = an / (an + bn) + (n[i] - an / (an + bn)) * Math.exp(-(an + bn) * dt);
      }
      const gna = gNa[i] * m[i] ** 3 * h[i], gk = gK[i] * n[i] ** 4, gl = gL[i];
      const G = gna + gk + gl;
      bb[i] = Cm[i] / dt + G + (i > 0 ? ga[i - 1] : 0) + (i < N - 1 ? ga[i] : 0);
      aa[i] = i > 0 ? -ga[i - 1] : 0;
      cc[i] = i < N - 1 ? -ga[i] : 0;
      rr[i] = Cm[i] / dt * V[i] + gna * ENa + gk * EK + gl * EL;
    }
    for (let i = 1; i < N; i++) { const w = aa[i] / bb[i - 1]; bb[i] -= w * cc[i - 1]; rr[i] -= w * rr[i - 1]; }
    const prev = V[N - 1];
    V[N - 1] = rr[N - 1] / bb[N - 1];
    for (let i = N - 2; i >= 0; i--) V[i] = (rr[i] - cc[i] * V[i + 1]) / bb[i];
    let vmax = -999;
    for (let i = 0; i < N; i++) { if (isNaN(cross[i]) && V[i] > 0 && i >= kick) cross[i] = t; if (V[i] > vmax) vmax = V[i]; }
    if (t > 1.5 && vmax < -35 && !o.full) { steps = s; break; }
    if (!isNaN(cross[N - 1]) && t > cross[N - 1] + 3 / f && !o.full) { steps = s; break; }
  }
  // conduction velocity from 30% → 80% of length (nodes only for myelinated)
  const pick = (fr) => { let best = -1, bd = Infinity; const L = comp[N - 1].x; for (let i = 0; i < N; i++) { if (!comp[i].node) continue; const dd = Math.abs(comp[i].x - fr * L); if (dd < bd) { bd = dd; best = i; } } return best; };
  const i1 = pick(0.3), i2 = pick(0.8);
  const cv = !isNaN(cross[i1]) && !isNaN(cross[i2]) && cross[i2] > cross[i1] ? (comp[i2].x - comp[i1].x) / (cross[i2] - cross[i1]) * 10 : NaN;
  return { comp, frames, times, cv, cross, N, f, len: comp[N - 1].x, i1, i2, dt };
}
function sub11(comp) { let k = 0; while (k < comp.length && (k === 0 || !comp[k].node)) k++; return k; }

export default {
  id: 'przewodzenie', tab: 'Przewodzenie',
  mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Przewodzenie potencjału czynnościowego', 'wieloprzedziałowy model kablowy z kinetyką Hodgkina–Huxleya');
    ctx.dockSize(40);
    const st = { myelin: true, d: 10, Lint: 1000, nInt: 24, lam: 60, T: 37, Ri: 70, gQ10: 1.5, play: true, speed: 1, tt: 0 };
    let res = null;

    v.setUnits('j.u.', 1);
    v.setGizmoLabels(['oś', 'y', 'z']);
    v.bloom.strength = 0.35; v.bloom.threshold = 0.85;
    const group = new THREE.Group();
    if (v.ok) v.root.add(group);
    let segMesh = null, myMesh = null, segIdx = null, elec = [];
    const DL = 240; // display length
    function build3D() {
      for (const o of [segMesh, myMesh, ...elec]) if (o) { group.remove(o); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }
      elec = [];
      const N = res.N, L = res.len, R = st.myelin ? 2.4 : 3.2;
      const sx = DL / L;
      // axon core: one cylinder per compartment, coloured by Vm
      const geo = new THREE.CylinderGeometry(R, R, 1, 20, 1, true);
      geo.rotateZ(Math.PI / 2);
      segMesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.0 }), N);
      const m4 = new THREE.Matrix4();
      res.comp.forEach((c, i) => { const len = Math.max(0.25, c.dx * sx); m4.makeScale(len, 1, 1).setPosition(c.x * sx - DL / 2, 0, 0); segMesh.setMatrixAt(i, m4); segMesh.setColorAt(i, new THREE.Color(0.2, 0.2, 0.3)); });
      group.add(segMesh);
      if (st.myelin) {
        const internodes = [];
        let k = 0; while (k < N) { if (!res.comp[k].node) { const a = k; while (k < N && !res.comp[k].node) k++; internodes.push([res.comp[a].x - res.comp[a].dx / 2, res.comp[k - 1].x + res.comp[k - 1].dx / 2]); } else k++; }
        const cg = new THREE.CapsuleGeometry(4.6, 1, 6, 24); cg.rotateZ(Math.PI / 2);
        myMesh = new THREE.InstancedMesh(cg, new THREE.MeshPhysicalMaterial({ color: 0xa9a294, roughness: 0.35, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 0.4 }), internodes.length);
        internodes.forEach(([a, b], i) => { const len = Math.max(0.1, (b - a) * sx - 9.2 - 1.2); m4.makeScale(len, 1, 1).setPosition((a + b) / 2 * sx - DL / 2, 0, 0); myMesh.setMatrixAt(i, m4); });
        group.add(myMesh);
      }
      [res.i1, Math.round((res.i1 + res.i2) / 2), res.i2].forEach((i, k) => {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.7, 9, 12), new THREE.MeshStandardMaterial({ color: ['#8ab4f8', '#e8e9eb', '#ff8a3d'][k], roughness: 0.3 }));
        e.position.set(res.comp[i].x * sx - DL / 2, 12, 0); e.rotation.z = Math.PI; group.add(e); elec.push(e);
      });
      if (v.ok) v.frame(new THREE.Vector3(0, 0, 0), DL * 0.42, new THREE.Vector3(0.15, 0.35, 1));
    }

    /* ---------- UI ---------- */
    const L = ctx.left;
    const s0 = ui.sec(L, 'Włókno');
    const seg = ui.seg(s0, { value: 'my', options: [['my', 'Z mieliną'], ['un', 'Bez mieliny']], onChange: (x) => { st.myelin = x === 'my'; run(); } });
    const dS = ui.slider(s0, { label: 'Średnica aksonu', min: Math.log10(0.2), max: Math.log10(600), step: 0.005, value: Math.log10(st.d), fmt: (x) => (10 ** x).toLocaleString('pl-PL', { maximumSignificantDigits: 3 }), unit: 'µm', onChange: (x) => { st.d = 10 ** x; run(); } });
    const liS = ui.slider(s0, { label: 'Długość międzywęźla', min: 50, max: 2500, step: 10, value: st.Lint, unit: 'µm', dec: 0, onChange: (x) => { st.Lint = x; run(); } });
    const laS = ui.slider(s0, { label: 'Liczba blaszek mieliny', min: 5, max: 200, step: 1, value: st.lam, dec: 0, onChange: (x) => { st.lam = x; run(); } });
    const tS = ui.slider(s0, { label: 'Temperatura', min: 0, max: 40, step: 0.5, value: st.T, unit: '°C', dec: 1, onChange: (x) => { st.T = x; run(); } });
    const riS = ui.slider(s0, { label: 'Oporność aksoplazmy Ri', min: 30, max: 200, step: 1, value: st.Ri, unit: 'Ω·cm', dec: 0, onChange: (x) => { st.Ri = x; run(); } });
    const gqS = ui.slider(s0, { label: 'Q₁₀ amplitud przewodności', min: 1, max: 2, step: 0.05, value: st.gQ10, dec: 2, onChange: (x) => { st.gQ10 = x; run(); } });
    const s1 = ui.sec(L, 'Preparaty');
    const preset = (o) => { Object.assign(st, { gQ10: 1.5 }, o); seg.set(st.myelin ? 'my' : 'un'); dS.set(Math.log10(st.d)); liS.set(st.Lint); laS.set(st.lam); tS.set(st.T); riS.set(st.Ri); gqS.set(st.gQ10); run(); };
    ui.buttons(s1, [
      ['Akson olbrzymi kałamarnicy', () => preset({ myelin: false, d: 476, T: 18.5, Ri: 35.4, gQ10: 1 })],
      ['Włókno C (1 µm, 37 °C)', () => preset({ myelin: false, d: 1, T: 37, Ri: 70 })],
      ['Włókno Aα (12 µm)', () => preset({ myelin: true, d: 12, Lint: 1200, lam: 80, T: 37, Ri: 70 })],
      ['Demielinizacja', () => preset({ myelin: true, d: 10, Lint: 1000, lam: 6, T: 37, Ri: 70 })]
    ]);
    ui.note(s1, 'W węzłach Ranviera gęstość kanałów HH zwiększono 10×; mielina dzieli pojemność i przewodność przez 2 × liczbę blaszek. Kinetyka bramek ma Q₁₀ = 3, a amplitudy przewodności — Q₁₀ z suwaka; przy Q₁₀ = 1 model HH ulega blokowi cieplnemu powyżej ok. 30 °C.', 'small');
    const s2 = ui.sec(L, 'Odtwarzanie');
    ui.slider(s2, { label: 'Tempo', min: 0.05, max: 4, step: 0.05, value: st.speed, unit: 'ms/s', dec: 2, onInput: (x) => { st.speed = x; } });
    ui.buttons(s2, [['Uruchom ponownie', () => { st.tt = 0; st.play = true; }], ['Skanuj średnice (CV)', () => scan(), 'pri']]);

    const R = ctx.right;
    const r1 = ui.sec(R, 'Wyniki symulacji');
    const kv = ui.kv(R, [['cv', 'Prędkość przewodzenia', 'm/s'], ['ref', 'Odniesienie empiryczne', 'm/s'], ['lam', 'Stała długości λ (błona HH)', 'mm'], ['tau', 'Stała czasowa τm', 'ms'], ['len', 'Długość modelu', 'mm'], ['N', 'Przedziały'], ['dt', 'Krok czasu', 'µs'], ['phi', 'φ = 3^((T−6,3)/10)']]);
    const refNote = ui.note(R, '', 'small');
    ui.sec(R, 'Skalowanie z średnicą');
    ui.note(R, 'Teoria kablowa przewiduje CV ∝ √d dla włókien bez mieliny i CV ∝ d dla włókien zmielinizowanych (Rushton, 1951). Wykres „Skanuj średnice” sprawdza to w modelu.', 'note');

    /* ---------- dock ---------- */
    const kym = heatmap(ctx.dock, { title: 'Kimogram', sub: 'Vm w funkcji położenia i czasu', xlabel: 'położenie [mm]', ylabel: 't [ms]', height: 220, smooth: false, overlay: (cx, b) => { if (!res) return; const T = res.times[res.times.length - 1]; const y = b.t + b.h - st.tt / T * b.h; cx.strokeStyle = '#ff8a3d'; cx.beginPath(); cx.moveTo(b.l, y); cx.lineTo(b.l + b.w, y); cx.stroke(); } });
    const tr = plot(ctx.dock, { title: 'Zapis z trzech elektrod', xlabel: 't [ms]', ylabel: 'Vm [mV]', series: [{ label: '30%', color: '#8ab4f8' }, { label: '55%', color: '#e8e9eb' }, { label: '80%', color: '#ff8a3d' }], yRange: [-90, 60] });
    const sp = plot(ctx.dock, { title: 'Profil przestrzenny', sub: 'Vm wzdłuż aksonu w chwili t', xlabel: 'położenie [mm]', ylabel: 'Vm [mV]', series: [{ label: 'Vm', color: '#ff8a3d', width: 1.6 }], yRange: [-90, 60] });
    const sc = xy(ctx.dock, { title: 'Prędkość a średnica', sub: 'naciśnij „Skanuj średnice”', xlabel: 'średnica [µm] (log)', ylabel: 'CV [m/s] (log)' });

    let timer = 0;
    function run() { clearTimeout(timer); ctx.busy(true); timer = setTimeout(runNow, 20); }
    function runNow() {
      const T0 = performance.now();
      res = simAxon({ ...st, tmax: 40 });
      // resample frames to at most 360 for display
      const nT = res.frames.length, N = res.N, keep = Math.min(360, nT), stepF = nT / keep;
      const nx = N, vals = new Float32Array(keep * nx), times = [];
      for (let j = 0; j < keep; j++) { const fr = res.frames[Math.floor(j * stepF)]; times.push(res.times[Math.floor(j * stepF)]); vals.set(fr, j * nx); }
      res.kym = { vals, nx, ny: keep, times };
      kym.draw(vals, nx, keep, 'turbo', -80, 50, [0, res.len * 10], [0, times[times.length - 1]]);
      const ia = res.i1, ib = Math.round((res.i1 + res.i2) / 2), ic = res.i2;
      tr.set([res.times, res.frames.map((f) => f[ia]), res.frames.map((f) => f[ib]), res.frames.map((f) => f[ic])]);
      const d = st.d * 1e-4, lam = Math.sqrt(3333 * d / (4 * st.Ri));
      kv.set('cv', isFinite(res.cv) ? res.cv : 'blok przewodzenia', 2);
      const ref = st.myelin ? 6 * st.d / 0.6 : (st.T === 18.5 && Math.abs(st.d - 476) < 1 ? 21.2 : null);
      kv.set('ref', ref, 1);
      refNote.textContent = st.myelin ? 'Odniesienie: reguła Hursha (1939), ok. 6 m/s na µm średnicy całego włókna (przyjęto współczynnik g = 0,6).' : (ref ? 'Odniesienie: pomiar dla aksonu kałamarnicy 21,2 m/s; obliczenie HH z 1952 r. dało 18,8 m/s.' : 'Dla włókien C in vivo typowo 0,5–2 m/s.');
      kv.set('lam', lam * 10, 2); kv.set('tau', 1 / 0.3, 2); kv.set('len', res.len * 10, 1); kv.set('N', res.N, 0); kv.set('dt', res.dt * 1000, 1); kv.set('phi', res.f, 2);
      build3D();
      st.tt = 0;
      ctx.busy(false);
      ctx.meta('obliczenia: ' + Math.round(performance.now() - T0) + ' ms');
    }

    function scan() {
      ctx.busy(true);
      setTimeout(() => {
        const ds = [0.5, 1, 2, 4, 8, 16];
        const un = ds.map((d) => simAxon({ ...st, myelin: false, d }).cv);
        const my = ds.map((d) => simAxon({ ...st, myelin: true, d, Lint: 100 * d }).cv);
        const lx = ds.map(Math.log10);
        const all = un.concat(my).filter((x) => isFinite(x) && x > 0);
        const fit = (ys) => { const pts = lx.map((x, i) => [x, Math.log10(ys[i])]).filter((p) => isFinite(p[1])); const n = pts.length, sx = pts.reduce((a, p) => a + p[0], 0), sy = pts.reduce((a, p) => a + p[1], 0), sxx = pts.reduce((a, p) => a + p[0] * p[0], 0), sxy = pts.reduce((a, p) => a + p[0] * p[1], 0); return (n * sxy - sx * sy) / (n * sxx - sx * sx); };
        const bu = fit(un), bm = fit(my);
        sc.draw([
          { x: lx, y: un.map((c) => Math.log10(c)), color: '#8ab4f8', label: 'bez mieliny, nachylenie ' + bu.toFixed(2) },
          { x: lx, y: my.map((c) => Math.log10(c)), color: '#ff8a3d', label: 'z mieliną (L = 100·d), nachylenie ' + bm.toFixed(2) },
          { x: lx, y: un.map((c) => Math.log10(c)), color: '#8ab4f8', dots: 3 }, { x: lx, y: my.map((c) => Math.log10(c)), color: '#ff8a3d', dots: 3 }
        ], [Math.log10(0.4), Math.log10(20)], [Math.log10(Math.min(...all) * 0.7), Math.log10(Math.max(...all) * 1.4)], { legend: true });
        sc.card.querySelector('figcaption .sub').textContent = 'log–log; teoria: 0,5 (bez mieliny) i 1,0 (z mieliną), T = ' + st.T + ' °C';
        ctx.busy(false);
      }, 20);
    }

    const tc = new THREE.Color(); const o3 = [0, 0, 0];
    let lastUi = 0, spInit = false;
    v.frames.push((t, dt) => {
      if (!res || !segMesh) return;
      const T = res.times[res.times.length - 1];
      if (st.play) { st.tt += dt * st.speed; if (st.tt > T) st.tt = 0; }
      const j = Math.min(res.frames.length - 1, Math.round(st.tt / (res.times[1] - res.times[0])));
      const fr = res.frames[j];
      for (let i = 0; i < res.N; i++) {
        sample('turbo', (fr[i] + 80) / 130, o3);
        tc.setRGB(o3[0], o3[1], o3[2], THREE.SRGBColorSpace);
        segMesh.setColorAt(i, tc);
      }
      segMesh.instanceColor.needsUpdate = true;
      if (t - lastUi > 0.08) {
        lastUi = t;
        const xs = res.comp.map((c) => c.x * 10);
        sp.set([xs, Array.from(fr)], !spInit); spInit = true;
        kym.redraw();
        try { tr.cursorAt(st.tt); } catch (e) { /* */ }
        ctx.title('Przewodzenie potencjału czynnościowego', `t = ${st.tt.toFixed(2)} ms · CV = ${isFinite(res.cv) ? res.cv.toFixed(2) + ' m/s' : 'brak propagacji'} · d = ${st.d.toPrecision(3)} µm · ${st.myelin ? 'z mieliną' : 'bez mieliny'}`);
      }
    });
    ui.note(ctx.right, 'Widok 3D ma skompresowaną oś podłużną (długość modelu ≫ średnica). Kolor rdzenia aksonu to Vm w skali turbo od −80 do +50 mV.', 'small');
    runNow();
  },
  unmount() {}
};

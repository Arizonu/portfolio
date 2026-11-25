import { THREE, CSS2DObject } from './viewer.js';
import * as ui from './ui.js';
import { plot, xy } from './plots.js';

/* Translucent membrane with a Fresnel rim, reads like an EM tomogram rendering. */
function membrane(color, opacity, rim) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const rc = new THREE.Color(rim || color);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.rimC = { value: rc };
    sh.fragmentShader = 'uniform vec3 rimC;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat fr = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.2);\ntotalEmissiveRadiance += rimC * fr * 0.9;\ndiffuseColor.a = mix(diffuseColor.a, 0.85, fr);');
  };
  return m;
}
function ellipsoid(rx, ry, rz, flatY, sign, seg = 64) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.75));
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * rx, y = p.getY(i) * ry, z = p.getZ(i) * rz;
    if (sign < 0 && y < flatY) y = flatY + (y - flatY) * 0.04;
    if (sign > 0 && y > flatY) y = flatY + (y - flatY) * 0.04;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
const R = (s) => { let a = s; return () => { a = (a * 16807) % 2147483647; return (a - 1) / 2147483646; }; };

export default {
  id: 'synapsa', tab: 'Synapsa',
  mount(ctx) {
    const v = ctx.viewer;
    ctx.title('Synapsa glutaminianergiczna na kolcu dendrytycznym', 'geometria w skali nanometrów · dyfuzja glutaminianu · kinetyka AMPA/NMDA');
    ctx.dockSize(40);
    const st = { N: 3000, D: 0.3, off: 0, clear: 1.2, nA: 40, nN: 12, V: -70, Mg: 1, U: 0.5, trec: 800, tf: 0, fr: 20, Ap: 0.8, Am: 0.4, tp: 16.8, tm: 33.7, dts: 10, speed: 0.6, tt: 0, clip: false };
    const rnd = R(11);
    const g = new THREE.Group();
    if (v.ok) v.root.add(g);
    v.setUnits('nm', 1);
    v.setGizmoLabels(['x', 'y', 'z']);
    v.bloom.strength = 0.22; v.bloom.threshold = 0.92;
    v.scene.environmentIntensity = 0.7;

    const CLEFT = 10; // half-cleft (nm) -> 20 nm cleft
    const pre = new THREE.Mesh(ellipsoid(460, 400, 430, CLEFT, -1), membrane(0x7cc4f0, 0.13, 0x5fb4ff));
    pre.geometry.translate(0, 400 + CLEFT, 0); g.add(pre);
    const axon = new THREE.Mesh(new THREE.CylinderGeometry(110, 140, 600, 40, 1, true), membrane(0x7cc4f0, 0.1, 0x5fb4ff));
    axon.position.set(-120, 1050, 0); axon.rotation.z = 0.25; g.add(axon);
    const post = new THREE.Mesh(ellipsoid(340, 300, 340, -CLEFT, 1), membrane(0xc4a7ff, 0.13, 0xb08cff));
    post.geometry.translate(0, -300 - CLEFT, 0); g.add(post);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(70, 80, 520, 32, 1, true), membrane(0xc4a7ff, 0.1, 0xb08cff));
    neck.position.set(0, -820, 0); g.add(neck);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(420, 420, 2400, 48, 1, true), membrane(0xc4a7ff, 0.07, 0x9f7aea));
    shaft.rotation.z = Math.PI / 2; shaft.position.set(0, -1480, 0); g.add(shaft);
    // astrocytic process wrapping the cleft
    const astro = new THREE.Mesh(new THREE.TorusGeometry(560, 85, 24, 96, Math.PI * 1.35), membrane(0x7ee787, 0.12, 0x56d364));
    astro.rotation.x = Math.PI / 2; astro.rotation.z = 0.6; g.add(astro);

    // vesicles (40 nm), reserve pool + docked at the active zone
    const ves = [];
    while (ves.length < 170) {
      const p = new THREE.Vector3((rnd() - 0.5) * 760, CLEFT + 60 + rnd() * 600, (rnd() - 0.5) * 720);
      const q = new THREE.Vector3(p.x / 460, (p.y - 400 - CLEFT) / 400, p.z / 430);
      if (q.length() > 0.86) continue;
      if (ves.some((o) => o.distanceTo(p) < 44)) continue;
      ves.push(p);
    }
    const dock = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2, r = k ? 95 + (k % 2) * 25 : 0; dock.push(new THREE.Vector3(Math.cos(a) * r, CLEFT + 24, Math.sin(a) * r)); }
    const vg = new THREE.SphereGeometry(20, 20, 14);
    const vm = new THREE.MeshPhysicalMaterial({ color: 0xb9c6d6, roughness: 0.3, metalness: 0, clearcoat: 0.4, transparent: true, opacity: 0.8 });
    const vInst = new THREE.InstancedMesh(vg, vm, ves.length + dock.length);
    const m4 = new THREE.Matrix4();
    [...ves, ...dock].forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); vInst.setMatrixAt(i, m4); });
    g.add(vInst);
    // active zone dense projections
    const az = new THREE.Mesh(new THREE.CylinderGeometry(175, 175, 6, 48), new THREE.MeshStandardMaterial({ color: 0x8a96a8, roughness: 0.6, transparent: true, opacity: 0.6 }));
    az.position.y = CLEFT + 4; g.add(az);
    const dp = new THREE.InstancedMesh(new THREE.ConeGeometry(14, 46, 10), new THREE.MeshStandardMaterial({ color: 0xa8b3c4, roughness: 0.5 }), 14);
    for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, r = 30 + rnd() * 140; m4.makeRotationX(Math.PI).setPosition(Math.cos(a) * r, CLEFT + 30, Math.sin(a) * r); dp.setMatrixAt(k, m4); }
    g.add(dp);
    // mitochondrion with cristae
    const mito = new THREE.Group();
    mito.add(new THREE.Mesh(new THREE.CapsuleGeometry(75, 280, 12, 32), membrane(0xe3a35c, 0.22, 0xffb86b)));
    for (let k = 0; k < 9; k++) { const c = new THREE.Mesh(new THREE.BoxGeometry(110, 4, 90), new THREE.MeshStandardMaterial({ color: 0xd8904a, roughness: 0.6, transparent: true, opacity: 0.55 })); c.position.y = -150 + k * 37; c.rotation.y = rnd(); mito.add(c); }
    mito.rotation.z = 1.2; mito.position.set(160, 560, -120); g.add(mito);
    // PSD
    const psd = new THREE.Mesh(new THREE.CylinderGeometry(180, 165, 34, 64), new THREE.MeshStandardMaterial({ color: 0x8c4a3c, roughness: 0.7, transparent: true, opacity: 0.75 }));
    psd.position.y = -CLEFT - 20; g.add(psd);
    const scaff = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(7, 0), new THREE.MeshStandardMaterial({ color: 0xb2604d, roughness: 0.6 }), 260);
    for (let k = 0; k < 260; k++) { const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 170; m4.makeTranslation(Math.cos(a) * r, -CLEFT - 8 - rnd() * 40, Math.sin(a) * r); scaff.setMatrixAt(k, m4); }
    g.add(scaff);

    // receptors
    let rec = [], recMesh = null;
    function placeReceptors() {
      if (recMesh) { g.remove(recMesh); recMesh.geometry.dispose(); recMesh.material.dispose(); }
      const rr = R(5);
      rec = [];
      for (let k = 0; k < st.nA; k++) { const a = rr() * Math.PI * 2, r = Math.sqrt(rr()) * 150; rec.push({ t: 'A', x: Math.cos(a) * r, z: Math.sin(a) * r }); }
      for (let k = 0; k < st.nN; k++) { const a = rr() * Math.PI * 2, r = Math.sqrt(rr()) * 90; rec.push({ t: 'N', x: Math.cos(a) * r, z: Math.sin(a) * r }); }
      const rg = new THREE.CylinderGeometry(5.5, 6.5, 16, 10);
      recMesh = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.0 }), rec.length);
      rec.forEach((r, i) => { m4.makeTranslation(r.x, -CLEFT + 1, r.z); recMesh.setMatrixAt(i, m4); recMesh.setColorAt(i, new THREE.Color(r.t === 'A' ? 0x2dd4bf : 0xa371f7)); });
      g.add(recMesh);
    }
    // glutamate molecules (display subset)
    const NG = 1600;
    const glu = new THREE.InstancedMesh(new THREE.SphereGeometry(3.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb454 }), NG);
    const gseed = []; const rg2 = R(99);
    for (let k = 0; k < NG; k++) { const u1 = Math.max(1e-6, rg2()), u2 = rg2(); gseed.push([Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2), Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2), (rg2() - 0.5) * 2 * (CLEFT - 2.5), rg2()]); }
    g.add(glu);
    const relMark = new THREE.Mesh(new THREE.RingGeometry(18, 24, 32), new THREE.MeshBasicMaterial({ color: 0xff8a3d, side: THREE.DoubleSide }));
    relMark.rotation.x = -Math.PI / 2; relMark.position.y = CLEFT - 1; relMark.userData.skipPick = true; g.add(relMark);
    const lab = (txt, x, y, z) => { const d = document.createElement('div'); d.className = 'lbl'; d.textContent = txt; const o = new CSS2DObject(d); o.position.set(x, y, z); g.add(o); };
    lab('kolbka presynaptyczna', -300, 760, 200); lab('pęcherzyki 40 nm', 260, 300, 330); lab('mitochondrium', 260, 680, -200); lab('szczelina 20 nm', 360, 0, 260); lab('PSD', -170, -70, 200); lab('kolec dendrytyczny', -300, -420, 240); lab('wypustka astrocytu', -560, 40, -260);
    if (v.ok) v.frame(new THREE.Vector3(0, 60, 0), 820, new THREE.Vector3(0.75, 0.25, 1));
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    /* ---------- model ---------- */
    let M = null;
    function gluAt(x, z, t) {
      if (t <= 0) return 0;
      const Dn = st.D * 1e6; // nm²/ms
      const r2 = (x - st.off) ** 2 + z * z;
      const c = st.N / (4 * Math.PI * Dn * t * 2 * CLEFT) * Math.exp(-r2 / (4 * Dn * t)) * Math.exp(-t / st.clear);
      return c / 6.022e-4; // mM
    }
    function compute() {
      const dt = 0.002, T1 = 6, nS = Math.round(T1 / dt);
      const aA = 1.1, bA = 0.19, aN = 0.072, bN = 0.0066;
      const rA = rec.map(() => 0), tS = [], cC = [], cR = [], openA = [], openN = [];
      const recT = [], recR = rec.map(() => []);
      let rN = rec.map(() => 0);
      for (let s = 0; s <= nS; s++) {
        const t = s * dt;
        let oa = 0, on = 0;
        rec.forEach((r, i) => {
          const C = gluAt(r.x, r.z, t);
          if (r.t === 'A') { const k = aA * C + bA, inf = aA * C / k; rA[i] = inf + (rA[i] - inf) * Math.exp(-k * dt); oa += rA[i]; }
          else { const k = aN * C + bN, inf = aN * C / k; rN[i] = inf + (rN[i] - inf) * Math.exp(-k * dt); on += rN[i]; }
        });
        if (s % 10 === 0) {
          tS.push(t); cC.push(gluAt(0, 0, t)); cR.push(gluAt(st.off, 0, t)); openA.push(oa); openN.push(on);
          recT.push(t); rec.forEach((r, i) => recR[i].push(r.t === 'A' ? rA[i] : rN[i]));
        }
      }
      // EPSC over 0..250 ms; NMDA decays with β after glutamate is gone
      const B = (V) => 1 / (1 + st.Mg / 3.57 * Math.exp(-0.062 * V));
      const gA = 10e-12, gN = 45e-12;
      const et = [], eA = [], eN = [], eT = [];
      const oA6 = openA[openA.length - 1], oN6 = openN[openN.length - 1];
      for (let t = 0; t <= 250; t += 0.25) {
        let oa, on;
        if (t <= T1) { const k = Math.min(tS.length - 1, Math.round(t / (dt * 10))); oa = openA[k]; on = openN[k]; }
        else { oa = oA6 * Math.exp(-bA * (t - T1)); on = oN6 * Math.exp(-bN * (t - T1)); }
        const ia = gA * oa * (st.V - 0) * 1e9, ina = gN * on * B(st.V) * (st.V - 0) * 1e9;
        et.push(t); eA.push(ia); eN.push(ina); eT.push(ia + ina);
      }
      // NMDA I–V (peak) with and without Mg
      const onPk = Math.max(...openN), oaPk = Math.max(...openA);
      const Vs = [], iN = [], iN0 = [], iA = [];
      for (let V = -100; V <= 60; V += 2) { Vs.push(V); iN.push(gN * onPk * B(V) * V * 1e9); iN0.push(gN * onPk * V * 1e9); iA.push(gA * oaPk * V * 1e9); }
      M = { tS, cC, cR, openA, openN, recT, recR, et, eA, eN, eT, onPk, oaPk, Vs, iN, iN0, iA };
      // plots
      pG.set([tS, cC, cR]);
      pE.set([et, eA, eN, eT]);
      pIV.draw([{ x: Vs, y: iN0, color: '#a371f7', dash: [4, 3], label: 'NMDA bez Mg²⁺' }, { x: Vs, y: iN, color: '#a371f7', width: 2, label: 'NMDA, Mg²⁺ ' + st.Mg.toFixed(1) + ' mM' }, { x: Vs, y: iA, color: '#2dd4bf', label: 'AMPA' }, { x: [-100, 60], y: [0, 0], color: '#555', width: 1 }, { x: [st.V, st.V], y: [-1e4, 1e4], color: '#ff8a3d', width: 1 }], [-100, 60], [Math.min(...iA, ...iN0) * 1.1, Math.max(...iA, ...iN0) * 1.1], { legend: true });
      const pkA = eA.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0), pkN = eN.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a), 0);
      const iPk = eA.indexOf(pkA);
      let half = iPk; while (half < eA.length && Math.abs(eA[half]) > Math.abs(pkA) / 2) half++;
      const ratioV = (V) => (gA * oaPk * V) / (gN * onPk * B(V) * V);
      kv.set('cpk', Math.max(...cC), 2); kv.set('crel', Math.max(...cR.slice(1)), 1);
      kv.set('oa', oaPk, 1); kv.set('on', onPk, 2);
      kv.set('pa', pkA, 1); kv.set('pn', pkN, 1);
      kv.set('tpk', et[iPk], 2); kv.set('thalf', et[half] - et[iPk], 2);
      kv.set('q', st.Mg > 0 ? B(st.V) : 1, 3);
      kv.set('ratio', Math.abs((gA * oaPk * -70) / (gN * onPk * B(40) * 40)), 2);
    }
    function stp() {
      const n = 10, dtI = 1000 / st.fr;
      let u = st.U, Rr = 1;
      const amp = [];
      for (let k = 0; k < n; k++) {
        amp.push(u * Rr);
        const uA = u, RA = Rr;
        Rr = 1 + (RA - uA * RA - 1) * Math.exp(-dtI / st.trec);
        u = st.tf > 0 ? st.U + uA * (1 - st.U) * Math.exp(-dtI / st.tf) : st.U;
      }
      const norm = amp.map((a) => a / amp[0]);
      pS.set([norm.map((_, i) => i + 1), norm]);
      kv.set('ppr', norm[1], 2); kv.set('ss', norm[n - 1], 2);
    }
    function stdp() {
      const xs = [], ys = [];
      for (let d = -100; d <= 100; d += 0.5) { xs.push(d); ys.push(d > 0 ? st.Ap * Math.exp(-d / st.tp) * 100 : d < 0 ? -st.Am * Math.exp(d / st.tm) * 100 : null); }
      const dw = st.dts > 0 ? st.Ap * Math.exp(-st.dts / st.tp) : st.dts < 0 ? -st.Am * Math.exp(st.dts / st.tm) : 0;
      pD.draw([{ x: xs, y: ys, color: '#e8e9eb', width: 1.8 }, { x: [-100, 100], y: [0, 0], color: '#555', width: 1 }, { x: [0, 0], y: [-200, 200], color: '#555', width: 1 }], [-100, 100], [-st.Am * 110, st.Ap * 110], { marker: [st.dts, dw * 100] });
      kv.set('dw', dw * 100, 1);
    }
    function all() { compute(); stp(); stdp(); st.tt = 0; }

    /* ---------- UI ---------- */
    const L = ctx.left;
    const s1 = ui.sec(L, 'Uwolnienie i dyfuzja');
    const re = () => { clearTimeout(this._t); this._t = setTimeout(() => { compute(); st.tt = 0; }, 40); };
    ui.slider(s1, { label: 'Cząsteczki glutaminianu w pęcherzyku', min: 500, max: 8000, step: 100, value: st.N, dec: 0, onInput: (x) => { st.N = x; re(); } });
    ui.slider(s1, { label: 'Współczynnik dyfuzji w szczelinie', min: 0.05, max: 0.76, step: 0.01, value: st.D, unit: 'µm²/ms', dec: 2, onInput: (x) => { st.D = x; re(); } });
    ui.slider(s1, { label: 'Przesunięcie miejsca uwolnienia od środka PSD', min: 0, max: 400, step: 5, value: st.off, unit: 'nm', dec: 0, onInput: (x) => { st.off = x; relMark.position.x = x; re(); } });
    ui.slider(s1, { label: 'Stała usuwania (transportery)', min: 0.2, max: 5, step: 0.05, value: st.clear, unit: 'ms', dec: 2, onInput: (x) => { st.clear = x; re(); } });
    const s2 = ui.sec(L, 'Receptory i błona');
    ui.slider(s2, { label: 'Receptory AMPA', min: 5, max: 120, step: 1, value: st.nA, dec: 0, onChange: (x) => { st.nA = x; placeReceptors(); compute(); } });
    ui.slider(s2, { label: 'Receptory NMDA', min: 0, max: 40, step: 1, value: st.nN, dec: 0, onChange: (x) => { st.nN = x; placeReceptors(); compute(); } });
    ui.slider(s2, { label: 'Potencjał podtrzymania', min: -100, max: 60, step: 1, value: st.V, unit: 'mV', dec: 0, onInput: (x) => { st.V = x; re(); } });
    ui.slider(s2, { label: 'Zewnątrzkomórkowe Mg²⁺', min: 0, max: 2, step: 0.05, value: st.Mg, unit: 'mM', dec: 2, onInput: (x) => { st.Mg = x; re(); } });
    const s3 = ui.sec(L, 'Plastyczność krótkotrwała (Tsodyks–Markram)');
    const sU = ui.slider(s3, { label: 'U — prawdopodobieństwo użycia zasobów', min: 0.02, max: 0.9, step: 0.01, value: st.U, dec: 2, onInput: (x) => { st.U = x; stp(); } });
    const sR = ui.slider(s3, { label: 'τrec — odnowa zasobów', min: 10, max: 2000, step: 10, value: st.trec, unit: 'ms', dec: 0, onInput: (x) => { st.trec = x; stp(); } });
    const sF = ui.slider(s3, { label: 'τfacil — facylitacja', min: 0, max: 2000, step: 10, value: st.tf, unit: 'ms', dec: 0, onInput: (x) => { st.tf = x; stp(); } });
    ui.slider(s3, { label: 'Częstotliwość serii', min: 1, max: 100, step: 1, value: st.fr, unit: 'Hz', dec: 0, onInput: (x) => { st.fr = x; stp(); } });
    ui.buttons(s3, [['Depresyjna', () => { st.U = 0.5; st.trec = 800; st.tf = 0; sU.set(0.5); sR.set(800); sF.set(0); stp(); }], ['Facylitująca', () => { st.U = 0.1; st.trec = 100; st.tf = 1000; sU.set(0.1); sR.set(100); sF.set(1000); stp(); }]]);
    const s4 = ui.sec(L, 'STDP (okno wykładnicze)');
    ui.slider(s4, { label: 'Δt = t(post) − t(pre)', min: -100, max: 100, step: 1, value: st.dts, unit: 'ms', dec: 0, onInput: (x) => { st.dts = x; stdp(); } });
    ui.slider(s4, { label: 'A₊', min: 0.1, max: 1.5, step: 0.05, value: st.Ap, dec: 2, onInput: (x) => { st.Ap = x; stdp(); } });
    ui.slider(s4, { label: 'A₋', min: 0.1, max: 1.5, step: 0.05, value: st.Am, dec: 2, onInput: (x) => { st.Am = x; stdp(); } });
    const s5 = ui.sec(L, 'Widok');
    ui.slider(s5, { label: 'Tempo animacji', min: 0.05, max: 2, step: 0.05, value: st.speed, unit: 'ms/s', dec: 2, onInput: (x) => { st.speed = x; } });
    ui.toggle(s5, { label: 'Przekrój przez środek synapsy', value: false, onChange: (x) => { if (v.ok) v.renderer.clippingPlanes = x ? [plane] : []; } });

    const Rp = ctx.right;
    ui.sec(Rp, 'Wynik pojedynczego uwolnienia');
    const kv = ui.kv(Rp, [['cpk', 'Szczyt [Glu] w środku PSD', 'mM'], ['crel', 'Szczyt [Glu] nad miejscem uwolnienia', 'mM'], ['oa', 'Otwarte AMPA (szczyt)', 'kanały'], ['on', 'Otwarte NMDA (szczyt)', 'kanały'], ['pa', 'EPSC AMPA (szczyt)', 'pA'], ['pn', 'EPSC NMDA (szczyt)', 'pA'], ['tpk', 'Czas do szczytu AMPA', 'ms'], ['thalf', 'Spadek AMPA do połowy', 'ms'], ['q', 'Odblokowanie NMDA B(V)'], ['ratio', 'AMPA(−70) / NMDA(+40)'], ['ppr', 'Stosunek par impulsów EPSC₂/EPSC₁'], ['ss', 'EPSC₁₀ / EPSC₁'], ['dw', 'Zmiana wagi STDP', '%']]);
    ui.note(Rp, 'Stężenie liczone z dyfuzji punktowego źródła w szczelinie o grubości 20 nm z wykładniczym usuwaniem; receptory: model kinetyczny Destexhe i in. (1994), γAMPA = 10 pS, γNMDA = 45 pS, Erev = 0 mV.', 'small');
    ui.legend(Rp, [['#2dd4bf', 'receptor AMPA'], ['#a371f7', 'receptor NMDA'], ['#ffb454', 'glutaminian (podzbiór)'], ['#ff8a3d', 'miejsce uwolnienia']]);

    /* ---------- dock ---------- */
    const pG = plot(ctx.dock, { title: 'Stężenie glutaminianu', xlabel: 't [ms]', ylabel: '[Glu] [mM]', series: [{ label: 'środek PSD', color: '#ffb454', width: 1.8 }, { label: 'nad miejscem uwolnienia', color: '#ff8a3d', dash: [4, 3] }], yRange: [0, 10] });
    const pE = plot(ctx.dock, { title: 'Prąd postsynaptyczny (EPSC)', xlabel: 't [ms]', ylabel: 'I [pA]', series: [{ label: 'AMPA', color: '#2dd4bf' }, { label: 'NMDA', color: '#a371f7' }, { label: 'suma', color: '#e8e9eb', width: 1.8 }] });
    const pIV = xy(ctx.dock, { title: 'I–V receptorów', sub: 'szczytowe przewodnictwo × siła napędowa; blok Mg²⁺ wg Jahra i Stevensa (1990)', xlabel: 'V [mV]', ylabel: 'I [pA]' });
    const pS = plot(ctx.dock, { title: 'Seria 10 impulsów', sub: 'amplituda EPSC względem pierwszej', xlabel: 'nr impulsu', ylabel: 'EPSCₙ / EPSC₁', xDec: 0, series: [{ label: 'względna amplituda', color: '#8ab4f8', bars: true, fill: 'rgba(138,180,248,.5)' }] });
    const pD = xy(ctx.dock, { title: 'Okno STDP', sub: 'τ₊ = 16,8 ms, τ₋ = 33,7 ms (Bi i Poo, 2001); amplitudy przykładowe', xlabel: 'Δt [ms]', ylabel: 'Δw [%]' });

    /* ---------- animation ---------- */
    const tc = new THREE.Color(), pv = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const cA = new THREE.Color(0x2dd4bf), cN = new THREE.Color(0xa371f7), cHot = new THREE.Color(0xfff1c2);
    let last = 0;
    v.frames.push((t, dt) => {
      if (!M) return;
      st.tt += dt * st.speed;
      const T = 4;
      if (st.tt > T + 0.6) st.tt = -0.4;
      const tm = Math.max(0, st.tt);
      const Dn = st.D * 1e6, sig = Math.sqrt(2 * Dn * Math.max(tm, 1e-4));
      const alive = st.tt < 0 ? 0 : Math.exp(-tm / st.clear);
      for (let k = 0; k < NG; k++) {
        const s = gseed[k];
        if (st.tt < 0 || s[3] > alive) { sc.setScalar(0.0001); pv.set(0, 0, 0); }
        else {
          const rr = Math.hypot(s[0], s[1]) * sig;
          const esc = rr > 560;
          pv.set(st.off + s[0] * sig, esc ? s[2] + (rr - 560) * 0.5 : s[2], s[1] * sig);
          sc.setScalar(esc ? 0.6 : 1);
        }
        m4.compose(pv, q, sc); glu.setMatrixAt(k, m4);
      }
      glu.instanceMatrix.needsUpdate = true;
      // docked vesicle at the release site collapses at t≈0
      const fuse = st.tt < 0 ? 1 : Math.max(0.001, 1 - st.tt * 12);
      const dv = dock[0];
      m4.makeScale(fuse, fuse, fuse).setPosition(st.off, dv.y - (1 - fuse) * 14, 0);
      vInst.setMatrixAt(ves.length, m4); vInst.instanceMatrix.needsUpdate = true;
      const j = Math.min(M.recT.length - 1, Math.max(0, Math.round(tm / (M.recT[1] - M.recT[0]))));
      rec.forEach((r, i) => {
        const o = st.tt < 0 ? 0 : M.recR[i][j];
        tc.copy(r.t === 'A' ? cA : cN).lerp(cHot, Math.min(1, o * 1.3));
        recMesh.setColorAt(i, tc);
      });
      recMesh.material.emissiveIntensity = 0.0;
      if (recMesh.instanceColor) recMesh.instanceColor.needsUpdate = true;
      if (t - last > 0.1) {
        last = t;
        const oa = M.openA[Math.min(M.openA.length - 1, j)] || 0, on = M.openN[Math.min(M.openN.length - 1, j)] || 0;
        ctx.title('Synapsa glutaminianergiczna na kolcu dendrytycznym', st.tt < 0 ? 'oczekiwanie na uwolnienie…' : `t = ${tm.toFixed(2)} ms · [Glu] w PSD = ${gluAt(0, 0, tm).toFixed(2)} mM · otwarte AMPA ${oa.toFixed(1)}, NMDA ${on.toFixed(2)}`);
        try { pG.cursorAt(tm); } catch (e) { /* */ }
      }
    });

    placeReceptors();
    all();
    ctx.meta('Destexhe i in., 1994 · Jahr i Stevens, 1990 · Tsodyks i Markram, 1997');
  },
  unmount() { clearTimeout(this._t); }
};

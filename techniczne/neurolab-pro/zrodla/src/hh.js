/* Hodgkin–Huxley (1952) kinetics, modern convention (V in mV, rest ≈ −65 mV). */
export const HH0 = { gNa: 120, gK: 36, gL: 0.3, ENa: 50, EK: -77, EL: -54.387, Cm: 1, T: 6.3, ttx: 0, tea: 0 };

const ex = Math.exp;
export function rates(V) {
  const am = Math.abs(V + 40) < 1e-6 ? 1 : 0.1 * (V + 40) / (1 - ex(-(V + 40) / 10));
  const bm = 4 * ex(-(V + 65) / 18);
  const ah = 0.07 * ex(-(V + 65) / 20);
  const bh = 1 / (1 + ex(-(V + 35) / 10));
  const an = Math.abs(V + 55) < 1e-6 ? 0.1 : 0.01 * (V + 55) / (1 - ex(-(V + 55) / 10));
  const bn = 0.125 * ex(-(V + 65) / 80);
  return [am, bm, ah, bh, an, bn];
}
export function steady(V) {
  const [am, bm, ah, bh, an, bn] = rates(V);
  return { m: am / (am + bm), h: ah / (ah + bh), n: an / (an + bn), tm: 1 / (am + bm), th: 1 / (ah + bh), tn: 1 / (an + bn) };
}
export const phi = (T) => Math.pow(3, (T - 6.3) / 10);

/* Current clamp. stim(t) -> µA/cm². Returns sampled traces every `every` steps. */
export function simCC(P, stim, tmax, opt = {}) {
  const f = phi(P.T);
  const dt = opt.dt || Math.min(0.01, 0.02 / f);
  const gNa = P.gNa * (1 - P.ttx), gK = P.gK * (1 - P.tea);
  let V = opt.V0 != null ? opt.V0 : -65;
  const s0 = steady(V);
  let m = s0.m, h = s0.h, n = s0.n;
  const deriv = (t, V, m, h, n, out) => {
    const r = rates(V);
    const INa = gNa * m * m * m * h * (V - P.ENa), IK = gK * n * n * n * n * (V - P.EK), IL = P.gL * (V - P.EL);
    out[0] = (stim(t) - INa - IK - IL) / P.Cm;
    out[1] = f * (r[0] * (1 - m) - r[1] * m);
    out[2] = f * (r[2] * (1 - h) - r[3] * h);
    out[3] = f * (r[4] * (1 - n) - r[5] * n);
  };
  const k1 = [0, 0, 0, 0], k2 = [0, 0, 0, 0], k3 = [0, 0, 0, 0], k4 = [0, 0, 0, 0];
  const every = Math.max(1, Math.round((opt.sample || 0.05) / dt));
  const steps = Math.round(tmax / dt);
  const out = { t: [], V: [], m: [], h: [], n: [], INa: [], IK: [], IL: [], gNa: [], gK: [], I: [], spikes: [] };
  let lastV = V, above = false, dVmax = 0;
  for (let s = 0; s <= steps; s++) {
    const t = s * dt;
    if (s % every === 0 && !opt.noTrace) {
      out.t.push(+t.toFixed(4)); out.V.push(V); out.m.push(m); out.h.push(h); out.n.push(n);
      const gna = gNa * m * m * m * h, gk = gK * n * n * n * n;
      out.gNa.push(gna); out.gK.push(gk); out.INa.push(gna * (V - P.ENa)); out.IK.push(gk * (V - P.EK)); out.IL.push(P.gL * (V - P.EL)); out.I.push(stim(t));
    }
    deriv(t, V, m, h, n, k1);
    deriv(t + dt / 2, V + dt / 2 * k1[0], m + dt / 2 * k1[1], h + dt / 2 * k1[2], n + dt / 2 * k1[3], k2);
    deriv(t + dt / 2, V + dt / 2 * k2[0], m + dt / 2 * k2[1], h + dt / 2 * k2[2], n + dt / 2 * k2[3], k3);
    deriv(t + dt, V + dt * k3[0], m + dt * k3[1], h + dt * k3[2], n + dt * k3[3], k4);
    lastV = V;
    V += dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    m += dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    h += dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    n += dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    if (!above && V > 0 && lastV <= 0) { out.spikes.push(t); above = true; }
    if (above && V < -20) above = false;
  }
  return out;
}

/* Voltage clamp: exact exponential solution of gates at fixed V. */
export function simVC(P, Vh, Vs, t0, dur, tmax, sample = 0.02) {
  const f = phi(P.T);
  const gNa = P.gNa * (1 - P.ttx), gK = P.gK * (1 - P.tea);
  const a = steady(Vh), b = steady(Vs);
  const out = { t: [], INa: [], IK: [], I: [], V: [] };
  for (let t = 0; t <= tmax + 1e-9; t += sample) {
    let m, h, n, V;
    if (t < t0) { m = a.m; h = a.h; n = a.n; V = Vh; }
    else if (t < t0 + dur) {
      const u = t - t0;
      m = b.m + (a.m - b.m) * Math.exp(-u * f / b.tm);
      h = b.h + (a.h - b.h) * Math.exp(-u * f / b.th);
      n = b.n + (a.n - b.n) * Math.exp(-u * f / b.tn);
      V = Vs;
    } else {
      const u = t - t0 - dur, e = Math.exp;
      const mE = b.m + (a.m - b.m) * e(-dur * f / b.tm), hE = b.h + (a.h - b.h) * e(-dur * f / b.th), nE = b.n + (a.n - b.n) * e(-dur * f / b.tn);
      m = a.m + (mE - a.m) * e(-u * f / a.tm); h = a.h + (hE - a.h) * e(-u * f / a.th); n = a.n + (nE - a.n) * e(-u * f / a.tn);
      V = Vh;
    }
    const iNa = gNa * m * m * m * h * (V - P.ENa), iK = gK * n ** 4 * (V - P.EK), iL = P.gL * (V - P.EL);
    out.t.push(+t.toFixed(3)); out.INa.push(iNa); out.IK.push(iK); out.I.push(iNa + iK + iL); out.V.push(V);
  }
  return out;
}

/* Spike-shape analysis on a CC trace */
export function analyse(tr) {
  const { t, V } = tr;
  const res = { n: tr.spikes.length, rate: null, thr: null, peak: null, amp: null, hw: null, ahp: null, lat: tr.spikes.length ? tr.spikes[0] : null };
  if (!tr.spikes.length) return res;
  const dt = t[1] - t[0];
  const i0 = t.findIndex((x) => x >= tr.spikes[0]);
  let it = i0;
  for (let i = Math.max(1, i0 - Math.round(3 / dt)); i <= i0; i++) if ((V[i] - V[i - 1]) / dt > 20) { it = i; break; }
  res.thr = V[it];
  let ip = i0; while (ip + 1 < V.length && V[ip + 1] > V[ip]) ip++;
  res.peak = V[ip]; res.amp = V[ip] - res.thr;
  const half = res.thr + res.amp / 2;
  let a = it; while (a < ip && V[a] < half) a++;
  let b = ip; while (b < V.length - 1 && V[b] > half) b++;
  res.hw = (b - a) * dt;
  let mn = Infinity; for (let i = ip; i < Math.min(V.length, ip + Math.round(15 / dt)); i++) mn = Math.min(mn, V[i]);
  res.ahp = mn;
  if (tr.spikes.length > 1) { const isi = []; for (let k = 1; k < tr.spikes.length; k++) isi.push(tr.spikes[k] - tr.spikes[k - 1]); res.rate = 1000 / (isi.reduce((x, y) => x + y, 0) / isi.length); }
  return res;
}

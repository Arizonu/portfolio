// Kognitywistyka · Umysł w pięciu kolorach — a watercolour journal in two pages (Watercolor Brush style)
// ?v=pl | en | ensub  → timeline_<v>.json (Polish voice / English voice / English voice + Polish subtitles)
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const VER = new URLSearchParams(location.search).get('v') || 'pl';
let TL, LANG, SUBS, S = [], D = [], SL = [];

// ---------- palette ----------
const HEADC = '#6f8597', HEAD2 = '#4f6274';
const C = { psy: '#c9973f', neu: '#c4646f', lin: '#7f9e5e', phi: '#8670a6', cs: '#3f6a96' };
const ACCENT = '#c8442a';
const KEYS = ['psy', 'neu', 'lin', 'phi', 'cs'];

// ---------- on-screen words ----------
const TXT = {
  pl: {
    title: 'Kognitywistyka', name: 'Umysł w pięciu kolorach', expl: 'kierunek studiów: człowiek + technologia', school: 'POLSKO-JAPOŃSKA AKADEMIA TECHNIK KOMPUTEROWYCH',
    q: 'Jak działa umysł?', hdr1: ['ZESZYT  ·  NR 01  ·  UMYSŁ', '5 DZIEDZIN  ·  1 PYTANIE'], hdr2: ['ZESZYT  ·  NR 02  ·  PRAKTYKA', 'CO ROBIMY'],
    psy: 'psychologia · zachowanie', neu: 'neuronauka · mózg', lin: 'lingwistyka · język', phi: 'filozofia · myślenie', cs: 'informatyka · modele umysłu',
    p2: 'A co robimy w praktyce?', wear: 'opaska · stres w lęku społecznym', pers: 'persony · potrzeby ludzi', data: 'dane · modele AI',
    tag: 'Rozumiemy ludzi, żeby tworzyć lepszą technologię.',
  },
  en: {
    title: 'Cognitive Science', name: 'A Mind in Five Colours', expl: 'a field of study: people + technology', school: 'POLISH-JAPANESE ACADEMY OF INFORMATION TECHNOLOGY',
    q: 'How does a mind work?', hdr1: ['NOTEBOOK  ·  NO. 01  ·  THE MIND', '5 FIELDS  ·  1 QUESTION'], hdr2: ['NOTEBOOK  ·  NO. 02  ·  PRACTICE', 'WHAT WE DO'],
    psy: 'psychology · behaviour', neu: 'neuroscience · the brain', lin: 'linguistics · language', phi: 'philosophy · thinking', cs: 'computer science · models of mind',
    p2: 'So what do we actually do?', wear: 'wearable · stress in social anxiety', pers: "personas · people's needs", data: 'data · AI models',
    tag: 'We understand people, to build better technology.',
  },
};
let W_;   // the chosen language's words

// ---------- helpers ----------
function cr(P, n = 8) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(P[P.length - 1]); return out;
}
function blobPts(cx, cy, r, seed, sy = 1) {
  const out = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, rr = r * (1 + .28 * (fbm(seed + i * .37) - .5)); out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]); }
  return out;
}
function mkWash(cx, cy, r, col, a, seed, sy = 1) {
  return { cx, cy, col, a, P: [0, 1, 2].map(k => blobPts(cx, cy, r * (1 + rnd(-.05, .05)), seed + k * 11.3, sy).map(([x, y]) => [x + rnd(-3, 3), y + rnd(-3, 3)])) };
}
function drawWash(w, g = 1, am = 1) {
  if (g <= 0) return;
  ctx.save(); ctx.translate(w.cx, w.cy); ctx.scale(g, g); ctx.translate(-w.cx, -w.cy);
  for (const P of w.P) { ctx.beginPath(); P.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fillStyle = rgba(w.col, w.a / 3 * 1.6 * am); ctx.fill(); }
  ctx.restore();
}
function hand(txt, x, y, p, o = {}) {
  if (p <= 0) return;
  const sz = o.size || 32;
  ctx.save(); ctx.font = `${o.w || 500} ${sz}px Caveat`; ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width, x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
  ctx.beginPath(); ctx.rect(x0 - 8, y - sz * 1.3, (w + 16) * eo(p), sz * 2.6); ctx.clip();
  ctx.shadowColor = rgba(PAPER, .95); ctx.shadowBlur = 10; ctx.fillStyle = rgba(o.col || INK, (o.a ?? .9)); ctx.fillText(txt, x, y); ctx.fillText(txt, x, y);
  ctx.restore();
}
function leader(x0, y0, x1, y1, p, bend = 20, a = .75) {
  if (p <= 0) return;
  const pts = qcurve(x0, y0, x1, y1, bend, 16), m = Math.max(1, Math.round(16 * clamp(p)));
  ctx.beginPath(); for (let i = 0; i <= m; i++) i ? ctx.lineTo(pts[i][0], pts[i][1]) : ctx.moveTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = rgba(INK, a); ctx.lineWidth = 1.7; ctx.lineCap = 'round'; ctx.stroke();
  if (p >= 1) { ctx.beginPath(); ctx.arc(x1, y1, 3.2, 0, 7); ctx.fillStyle = rgba(INK, a); ctx.fill(); }
}
function mono(txt, x, y, a, o = {}) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `400 ${o.size || 17}px "IBM Plex Mono"`; ctx.letterSpacing = (o.sp || 4) + 'px'; ctx.fillStyle = rgba(INK, o.a ?? .72);
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(txt, x, y); ctx.letterSpacing = '0px'; ctx.restore();
}
function serif(txt, x, y, size, p, o = {}) {   // a serif line revealed left to right
  if (p <= 0) return;
  ctx.save(); ctx.font = `${o.it ? 'italic ' : ''}500 ${size}px "Cormorant Garamond"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const w = ctx.measureText(txt).width;
  ctx.beginPath(); ctx.rect(x - w / 2 - 20, y - size * 1.1, (w + 40) * eio(p), size * 1.5); ctx.clip();
  ctx.fillStyle = rgba(INK, o.a ?? 1); ctx.fillText(txt, x, y); ctx.restore();
}
function mkWashStroke(cx, cy, r, col, a = .55) {
  const pts = []; for (let i = 0; i <= 30; i++) { const an = i / 30 * Math.PI * 2.2; pts.push([cx + Math.cos(an) * r * .55, cy + Math.sin(an) * r * .55]); }
  return mk(pts, r * .95, col, { prof: 'even', a, nb: 5, rough: .3 });
}

// ---------- page 1 specimens ----------
const SP = {};
function buildHead() {
  const back = [[850, 805], [842, 725], [818, 645], [802, 545], [816, 440], [862, 360], [945, 312], [1040, 316], [1110, 362], [1140, 438]];
  const face = [[1140, 438], [1133, 476], [1150, 505], [1173, 538], [1143, 556], [1152, 582], [1142, 602], [1150, 618], [1137, 660], [1092, 684], [1062, 722], [1066, 805]];
  const S_ = [];
  S_.push(mk(cr([[838, 700], [818, 560], [836, 430], [900, 350], [990, 322]], 10), 46, HEADC, { prof: 'leaf', a: .32, nb: 6 }));
  S_.push(mk(cr(back, 9), 15, HEADC, { prof: 'even', a: .9, nb: 5 }));
  S_.push(mk(cr(face, 9), 13, HEADC, { prof: 'even', a: .9, nb: 4 }));
  S_.push(edgeOf(S_[1], -1, 3.2, HEAD2, .6));
  S_.push(edgeOf(S_[2], -1, 3, HEAD2, .6));
  S_.push(mk(cr([[905, 545], [890, 515], [905, 492], [930, 505], [928, 545], [915, 575]], 6), 8, HEADC, { prof: 'brush', a: .85, nb: 3 }));
  S_.push(mk(qcurve(1090, 470, 1112, 472, -4, 5), 5, HEAD2, { prof: 'even', a: .8, nb: 0 }));
  S_.push(mk(cr([[1050, 560], [1080, 600], [1060, 640]], 6), 26, HEADC, { prof: 'leaf', a: .22, nb: 4 }));
  return { S: S_ };
}
function buildPsy() {
  const S_ = [];
  S_.push(mkWashStroke(430, 358, 36, C.psy));
  S_.push(mk(qctrl(328, 362, 430, 286, 534, 360, 14), 11, C.psy, { prof: 'even', a: .9, nb: 4 }));
  S_.push(mk(qctrl(330, 364, 432, 418, 532, 360, 14), 8, C.psy, { prof: 'even', a: .8, nb: 3 }));
  for (let i = 0; i < 6; i++) { const u = .2 + i * .12, x = lerp(345, 515, u), y = 360 - Math.sin(u * Math.PI) * 52; S_.push(mk(polar(x, y, -Math.PI / 2 + (u - .5) * 1.4, 22, 2, 5), 4, INK2, { prof: 'tip', a: .75, nb: 0 })); }
  S_.push(mk(cr([[430, 343], [442, 352], [436, 368], [422, 368], [418, 352], [430, 343]], 4), 13, INK, { prof: 'even', a: .88, nb: 0 }));
  return { S: S_ };
}
function buildNeu() {
  const S_ = [], cx = 420, cy = 730;
  S_.push(mkWashStroke(cx, cy, 30, C.neu));
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (.55 + i * .3) + rnd(-.15, .15), L = rnd(70, 105), p = polar(cx, cy, a, L, rnd(-14, 14), 10);
    S_.push(mk(p, 9, C.neu, { prof: 'tip', a: .85, nb: 3 }));
    const e = p[p.length - 1];
    for (const d of [-.5, .45]) S_.push(mk(polar(e[0], e[1], a + d, rnd(26, 40), rnd(-6, 6), 6), 4.5, C.neu, { prof: 'tip', a: .8, nb: 0 }));
  }
  S_.push(mk(qctrl(448, 724, 560, 790, 650, 700, 18), 7, C.neu, { prof: 'even', a: .85, nb: 3 }));
  for (const d of [-.7, 0, .7]) S_.push(mk(polar(650, 700, -.6 + d, 26, 3, 5), 4, C.neu, { prof: 'tip', a: .8, nb: 0 }));
  S_.push(mk(cr([[cx - 6, cy - 6], [cx + 6, cy - 4], [cx + 4, cy + 7], [cx - 7, cy + 5]], 4), 7, INK2, { prof: 'even', a: .7, nb: 0 }));
  return { S: S_ };
}
function buildLin() {
  const S_ = [], cx = 1500, cy = 330, rx = 112, ry = 70, P = [];
  for (let i = 0; i <= 36; i++) { const a = Math.PI * .62 + i / 36 * Math.PI * 1.9; P.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  S_.push(mk(cr([[1440, 380], [1470, 420], [1430, 440]], 6), 9, C.lin, { prof: 'even', a: .85, nb: 3 }));
  S_.push(mk(P, 11, C.lin, { prof: 'even', a: .88, nb: 4 }));
  for (let k = 0; k < 3; k++) { const y = 305 + k * 25, x0 = 1430 + (k === 2 ? 10 : 0), x1 = 1575 - k * 30; S_.push(mk(qcurve(x0, y, x1, y + 2, 2, 10), 6, C.lin, { prof: 'even', a: .75, nb: 2 })); }
  return { S: S_ };
}
function buildPhi() {
  const S_ = [], cx = 1565, cy = 585, P = [];
  for (let i = 0; i <= 70; i++) { const th = i / 70 * Math.PI * 3.4, r = 8 + th * 9.5; P.push([cx + Math.cos(th + 2) * r, cy + Math.sin(th + 2) * r]); }
  S_.push(mk(P, 10, C.phi, { prof: 'tip', a: .88, nb: 4 }));
  S_.push(mkWashStroke(cx, cy, 14, C.phi));
  return { S: S_ };
}
function buildCs() {
  const S_ = [], L = [[[1400, 750], [1400, 790], [1400, 830]], [[1490, 735], [1490, 775], [1490, 815], [1490, 855]], [[1580, 770], [1580, 815]]];
  const nodes = [];
  for (let l = 0; l < L.length - 1; l++) for (const a of L[l]) for (const b of L[l + 1]) S_.push(mk(qcurve(a[0], a[1], b[0], b[1], rnd(-3, 3), 6), 2.6, C.cs, { prof: 'even', a: .5, nb: 0, rough: .3 }));
  for (const lay of L) for (const n of lay) nodes.push(mkWashStroke(n[0], n[1], 13, C.cs));
  return { S: nodes.concat(S_) };
}
function buildRivers() {
  const R = [
    ['psy', [[535, 362], [640, 330], [760, 350], [880, 420], [925, 440]]],
    ['neu', [[655, 698], [740, 640], [830, 560], [930, 505]]],
    ['lin', [[1420, 400], [1300, 360], [1150, 360], [1030, 410]]],
    ['phi', [[1530, 600], [1400, 590], [1250, 540], [1040, 485]]],
    ['cs', [[1395, 790], [1300, 740], [1160, 640], [995, 535]]],
  ];
  return R.map(([k, P]) => ({ k, s: mk(cr(P, 10), 12, C[k], { prof: 'tip', a: .62, nb: 4, rough: .3 }) }));
}
function buildBrain() {
  const B = [['psy', 925, 430], ['neu', 940, 505], ['lin', 1010, 420], ['phi', 1020, 492], ['cs', 972, 462]];
  const W2 = B.map(([k, x, y], i) => mkWash(x, y, 66, C[k], .36, 3 + i * 7.1, .9));
  const F = [];
  const folds = [[[880, 400], [910, 380], [940, 405], [970, 385]], [[990, 380], [1020, 400], [1050, 385]], [[870, 460], [900, 445], [930, 470], [965, 450]],
    [[985, 455], [1015, 470], [1045, 455], [1075, 470]], [[880, 520], [915, 505], [950, 530], [985, 510]], [[1000, 525], [1035, 540], [1065, 520]], [[930, 565], [965, 585], [1000, 565]]];
  for (const f of folds) F.push(mk(cr(f, 6), 4, INK2, { prof: 'even', a: .38, nb: 0, rough: .35 }));
  return { W: W2, F };
}
function buildSwatches() {   // five colour dabs under the title
  return KEYS.map((k, i) => mk(qcurve(770 + i * 80, 600, 830 + i * 80, 596, rnd(-4, 4), 10), 34, C[k], { prof: 'leaf', a: .7, nb: 6 }));
}

// ---------- page 2 specimens ----------
function buildWear() {
  const S_ = [];
  S_.push(mk(qcurve(250, 610, 590, 610, -8, 24), 74, HEADC, { prof: 'even', a: .3, nb: 7 }));
  S_.push(mk(qctrl(255, 572, 420, 540, 585, 572, 18), 7, HEADC, { prof: 'even', a: .85, nb: 3 }));
  S_.push(mk(qctrl(255, 648, 420, 680, 585, 648, 18), 7, HEADC, { prof: 'even', a: .85, nb: 3 }));
  S_.push(mkWashStroke(420, 610, 60, C.cs, .5));
  S_.push(mk(cr([[380, 572], [462, 570], [464, 650], [378, 652], [380, 572]], 6), 6, HEAD2, { prof: 'even', a: .8, nb: 2 }));
  S_.push(mkWashStroke(420, 610, 13, C.neu, .8));
  return { S: S_ };
}
function buildPulse() {   // a heartbeat trace above the band
  const P = [[240, 470]], beats = [300, 410, 520];
  for (const b of beats) P.push([b - 20, 470], [b - 8, 462], [b, 470], [b + 6, 410], [b + 14, 505], [b + 22, 470], [b + 40, 468]);
  P.push([600, 470]);
  return mk(P, 4.5, C.neu, { prof: 'even', a: .9, nb: 0, rough: .15 });
}
function buildPers() {
  const S_ = [], X = [850, 960, 1070], cols = [C.psy, C.lin, C.phi];
  X.forEach((x, i) => {
    S_.push(mk(cr([[x - 62, 470], [x + 62, 468], [x + 64, 730], [x - 60, 732], [x - 62, 470]], 5), 3, INK2, { prof: 'even', a: .45, nb: 0, rough: .3 }));
    S_.push(mk(qcurve(x, 518, x, 560, 0, 10), 64, cols[i], { prof: 'leaf', a: .62, nb: 6 }));
    S_.push(mk(qctrl(x - 44, 642, x, 592, x + 44, 642, 14), 44, cols[i], { prof: 'leaf', a: .55, nb: 6 }));
    S_.push(mk(qctrl(x - 46, 646, x, 586, x + 46, 646, 14), 5, cols[i], { prof: 'even', a: .8, nb: 2 }));
    for (let k = 0; k < 3; k++) S_.push(mk(qcurve(x - 40, 670 + k * 18, x + 40 - k * 16, 670 + k * 18, 1, 6), 3.5, INK2, { prof: 'even', a: .55, nb: 0 }));
  });
  return { S: S_ };
}
function buildData() {
  const S_ = [];
  S_.push(mk(qcurve(1370, 712, 1610, 712, 0, 12), 4, INK2, { prof: 'even', a: .8, nb: 0 }));
  S_.push(mk(qcurve(1370, 712, 1370, 470, 0, 12), 4, INK2, { prof: 'even', a: .8, nb: 0 }));
  [[1410, 90, C.cs], [1460, 150, C.lin], [1510, 120, C.psy], [1560, 205, C.neu]].forEach(([x, h, c]) => S_.push(mk(qcurve(x, 706, x, 706 - h, rnd(-2, 2), 10), 32, c, { prof: 'even', a: .75, nb: 6 })));
  const N = [[1640, 480], [1700, 440], [1700, 520], [1760, 480]];
  for (const [a, b] of [[0, 1], [0, 2], [1, 3], [2, 3], [1, 2]]) S_.push(mk(qcurve(N[a][0], N[a][1], N[b][0], N[b][1], 2, 6), 2.6, C.cs, { prof: 'even', a: .55, nb: 0 }));
  for (const [x, y] of N) S_.push(mkWashStroke(x, y, 16, C.cs, .6));
  S_.push(mk(qcurve(1590, 560, 1640, 495, -10, 10), 2.6, INK2, { prof: 'tip', a: .5, nb: 0 }));
  return { S: S_ };
}
const STAMP = {};
function buildStamp() { STAMP.R = [0, 1, 2].map(() => [[-92, -52], [92, -52], [92, 52], [-92, 52]].map(([x, y]) => [x + rnd(-2.5, 2.5), y + rnd(-2.5, 2.5)])); }

// ---------- timing derived from the narration ----------
let T = {};
function makeTiming() {
  TL.lines.forEach((L, i) => { S[i] = L.t; D[i] = L.d; SL[i] = L.slot; });
  const sp = KEYS.map((k, i) => S[3] + D[3] * (.04 + i * .19));
  T = {
    sw: [S[0] - .9, S[0] + .9], title: [S[0] - .4, S[0] + 1.4], name: [S[0] + 1.2, S[0] + 2.6], expl: [S[1], S[1] + 1.8], school: [S[1] + 1.2, S[1] + 2.2],
    titleOut: [S[2] - 1.0, S[2] - .2],
    q: [S[2], S[2] + 1.5], head: [S[2] + 1.1, S[2] + 3.4],
    psy: [sp[0], sp[0] + 1.3], neu: [sp[1], sp[1] + 1.3], lin: [sp[2], sp[2] + 1.3], phi: [sp[3], sp[3] + 1.3], cs: [sp[4], sp[4] + 1.3],
    river: [S[4] - .35, S[4] + 1.6], bloom: [S[4] + .4, S[4] + 2.6], folds: [S[4] + 1.6, S[4] + 2.9],
    pageIn: [S[5] - 1.25, S[5] - .1], p2: [S[5] - .1, S[5] + 1.4],
    wear: [S[6], S[6] + 2.0], pulse: [S[6] + 1.2, S[6] + 3.2], pers: [S[7], S[7] + 2.0], data: [S[8], S[8] + 2.0],
    pageOut: [S[9] - 1.3, S[9] - .3], endTitle: [S[9] - .1, S[9] + 1.5], endSchool: [S[9] + 1.0, S[9] + 2.0], tag: [S[9] + D[9] * .5, S[9] + D[9] * .5 + 1.6],
    stamp: S[9] + D[9] + .35,
  };
  const end8 = Math.min(S[8] + D[8] + .2, T.pageOut[0] - .05);
  const k1 = [[0, 960, 540, 1.0], [T.titleOut[0], 960, 540, 1.0], [S[2] + .2, 960, 255, 1.9], [S[2] + 1.0, 960, 262, 1.85], [S[2] + 2.4, 960, 520, 1.3],
    [S[3] - .1, 960, 540, 1.05], [S[3] + D[3], 960, 540, 1.02], [S[4] - .3, 960, 540, 1.02], [S[4] + 2.8, 965, 470, 1.38], [T.pageIn[1], 965, 470, 1.38],
    [T.pageIn[1] + .4, 960, 540, 1.0], [TL.dur + 1, 960, 540, 1.0]];
  const k2 = [[T.pageIn[0], 960, 540, 1.0], [S[5] + D[5], 960, 540, 1.0], [S[6] - .2, 420, 590, 1.3], [S[7] - .5, 430, 590, 1.3], [S[7] + .3, 960, 590, 1.3],
    [S[8] - .5, 960, 590, 1.3], [S[8] + .3, 1520, 590, 1.3], [end8, 1500, 585, 1.24], [TL.dur + 1, 1500, 585, 1.24]];
  CAM1 = mkCam(k1); CAM2 = mkCam(k2);
}
let CAM1, CAM2;
function mkCam(K) { const x = monotone(K.map(k => [k[0], k[1]])), y = monotone(K.map(k => [k[0], k[2]])), z = monotone(K.map(k => [k[0], k[3]])); return t => [x(t), y(t), z(t)]; }
function setCam(cam, t, off = 0) { const [x, y, z] = cam(t); ctx.setTransform(z, 0, 0, z, 960 - x * z + off, 540 - y * z); }

// ---------- page 1 ----------
function paint(name, t) {
  const [a, b] = T[name], s = SP[name], p = seg(t, a, b);
  if (p <= 0) return;
  if (p >= 1 && s.spr) ctx.drawImage(s.spr.cv, s.spr.x0, s.spr.y0); else drawList(ctx, s.S, eio(p));
}
const NOTES = { psy: [330, 250, 400, 300], neu: [255, 610, 395, 690], lin: [1425, 220, 1470, 265], phi: [1600, 465, 1590, 528], cs: [1380, 680, 1420, 742] };
function notes(t) {
  for (const k of KEYS) {
    const [lx, ly, ax, ay] = NOTES[k], t0 = T[k][0] + .5;
    if (t < t0) continue;
    leader(lx + 40, ly + 20, ax, ay, seg(t, t0, t0 + .5), 14);
    hand(W_[k], lx, ly, seg(t, t0 + .2, t0 + 1.2), { size: 32 });
  }
}
function titlePage(t) {
  const a = 1 - ss(seg(t, T.titleOut[0], T.titleOut[1])); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  SP.sw.forEach((s, i) => drawS(ctx, s, eio(seg(t, T.sw[0] + i * .25, T.sw[0] + i * .25 + .8))));
  serif(W_.title, 960, 440, 132, seg(t, T.title[0], T.title[1]));
  serif(W_.name, 960, 520, 54, seg(t, T.name[0], T.name[1]), { it: true, a: .85 });
  hand(W_.expl, 960, 690, seg(t, T.expl[0], T.expl[1]), { size: 44, align: 'center' });
  mono(W_.school, 962, 760, ss(seg(t, T.school[0], T.school[1])), { align: 'center', size: 17, sp: 4 });
  ctx.restore();
}
function question(t) {
  if (t < T.q[0]) return;
  const a = 1 - ss(seg(t, T.endTitle[0] - .6, T.endTitle[0])); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  hand(W_.q, 960, 236, seg(t, T.q[0], T.q[1]), { size: 74, align: 'center', w: 600 });
  drawS(ctx, SP.underline, seg(t, T.q[1] - .2, T.q[1] + .4));
  ctx.restore();
}
function header(t, H, t0) {
  const a = ss(seg(t, t0, t0 + 1)); if (a <= 0) return;
  mono(H[0], 90, 92, a); mono(H[1], 1830, 92, a, { align: 'right' });
}
function page1(t) {
  titlePage(t);
  if (t > T.titleOut[1] - .3) header(t, W_.hdr1, T.titleOut[1]);
  question(t);
  const hp = seg(t, T.head[0], T.head[1]);
  if (hp > 0) { if (hp >= 1) ctx.drawImage(SP.head.spr.cv, SP.head.spr.x0, SP.head.spr.y0); else drawList(ctx, SP.head.S, eio(hp)); }
  for (const k of KEYS) paint(k, t);
  SP.rivers.forEach((r, i) => { const a = T.river[0] + i * .2; drawS(ctx, r.s, eio(seg(t, a, a + 1.3))); });
  SP.brain.W.forEach((w, i) => { const a = T.bloom[0] + i * .3; drawWash(w, eo(seg(t, a, a + 1.4))); });
  drawList(ctx, SP.brain.F, seg(t, T.folds[0], T.folds[1]));
  notes(t);
  if (t >= T.endTitle[0]) {
    serif(W_.title, 960, 168, 104, seg(t, T.endTitle[0], T.endTitle[1]));
    mono(W_.school, 962, 214, ss(seg(t, T.endSchool[0], T.endSchool[1])), { align: 'center', size: 16, sp: 3 });
    hand(W_.tag, 960, 262, seg(t, T.tag[0], T.tag[1]), { size: 34, align: 'center' });
  }
  stamp(t);
}
function stamp(t) {
  const u = t - T.stamp; if (u < 0) return;
  const sc = 1 + .22 * (1 - eo(clamp(u / .14))), a = clamp(u / .08);
  ctx.save(); ctx.translate(1715, 880); ctx.rotate(-.09); ctx.scale(sc, sc); ctx.globalAlpha = a;
  for (const R of STAMP.R) { ctx.beginPath(); R.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.lineWidth = 4; ctx.strokeStyle = rgba(ACCENT, .45); ctx.stroke(); }
  ctx.beginPath(); ctx.rect(-80, -40, 160, 80); ctx.lineWidth = 2; ctx.strokeStyle = rgba(ACCENT, .6); ctx.stroke();
  ctx.font = '700 50px "Cormorant Garamond"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba(ACCENT, .82);
  ctx.letterSpacing = '4px'; ctx.fillText('PJATK', 3, 2); ctx.letterSpacing = '0px';
  ctx.restore();
}

// ---------- page 2 ----------
function page2(t) {
  header(t, W_.hdr2, T.pageIn[1]);
  hand(W_.p2, 960, 200, seg(t, T.p2[0], T.p2[1]), { size: 66, align: 'center', w: 600 });
  drawS(ctx, SP.underline2, seg(t, T.p2[1] - .1, T.p2[1] + .5));
  paint('wear', t);
  drawS(ctx, SP.pulse, eio(seg(t, T.pulse[0], T.pulse[1])));
  paint('pers', t);
  paint('data', t);
  const N2 = [['wear', 250, 380, 420, 455], ['pers', 820, 405, 900, 470], ['data', 1370, 400, 1450, 600]];
  for (const [k, lx, ly, ax, ay] of N2) {
    const t0 = T[k][0] + .6; if (t < t0) continue;
    leader(lx + 40, ly + 20, ax, ay, seg(t, t0, t0 + .5), 14);
    hand(W_[k === 'wear' ? 'wear' : k === 'pers' ? 'pers' : 'data'], lx, ly, seg(t, t0 + .2, t0 + 1.3), { size: 34 });
  }
}

// ---------- subtitles (screen space; only in the English + Polish subtitles version) ----------
const fade2 = (t, a, b, fi = .25, fo = .35) => ss(seg(t, a, a + fi)) * (1 - ss(seg(t, b - fo, b)));
function subEnd(i) { const nx = S[i + 1] !== undefined ? S[i + 1] - .2 : 1e9; return Math.min(nx, S[i] + SL[i]); }
function wrap(txt, maxW) {
  if (ctx.measureText(txt).width <= maxW) return [txt];
  const w = txt.split(' '); let best = null;
  for (let i = 1; i < w.length; i++) { const a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(ctx.measureText(a).width, ctx.measureText(b).width); if (!best || m < best[0]) best = [m, a, b]; }
  return [best[1], best[2]];
}
function subs(t) {
  TL.lines.forEach((L, i) => {
    const f = fade2(t, S[i] - .15, subEnd(i)); if (f <= 0) return;
    ctx.save(); ctx.globalAlpha = f; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = 'italic 600 54px "Cormorant Garamond"'; const lines = wrap(L.pl, 1560);
    const y0 = lines.length > 1 ? 966 : 1024;
    ctx.shadowColor = rgba(PAPER, 1); ctx.shadowBlur = 24;
    for (let k = 0; k < 3; k++) { ctx.fillStyle = rgba(INK, .95); lines.forEach((ln, j) => ctx.fillText(ln, 960, y0 + j * 58)); }
    ctx.restore();
  });
}

// ---------- render ----------
let PAPER_IMG;
function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const inP = eio(seg(t, T.pageIn[0], T.pageIn[1])), outP = eio(seg(t, T.pageOut[0], T.pageOut[1]));
  const off = W * (1 - inP) - W * outP, show2 = inP > 0 && outP < 1, cover = show2 && Math.abs(off) < 1;
  if (!cover) { setCam(CAM1, t); ctx.drawImage(PAPER_IMG, -120, -120, W + 240, H + 240); page1(t); }
  if (show2) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save();
    ctx.beginPath(); ctx.rect(off, 0, W, H); ctx.clip();
    // a soft shadow along the edge of the sheet that slides over
    const ex = off > 0 ? off : W + off, g = ctx.createLinearGradient(ex - 40, 0, ex + 2, 0);
    setCam(CAM2, t, off); ctx.drawImage(PAPER_IMG, -900, -300, W + 1800, H + 600); page2(t);
    ctx.restore(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!cover) {
      const sx = off > 0 ? off : W + off, gr = ctx.createLinearGradient(off > 0 ? sx - 46 : sx + 46, 0, sx, 0);
      gr.addColorStop(0, 'rgba(60,45,30,0)'); gr.addColorStop(1, 'rgba(60,45,30,.22)');
      ctx.fillStyle = gr; ctx.fillRect(off > 0 ? sx - 46 : sx, 0, 46, H);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (SUBS) subs(t);
}
window.render = render;

(async () => {
  TL = await (await fetch(`timeline_${VER}.json`)).json();
  LANG = TL.lang; SUBS = TL.subs; W_ = TXT[LANG]; window.DUR = TL.dur;
  makeTiming();
  window.TEXTS = t => SUBS ? TL.lines.map((L, i) => [L, i]).filter(([L, i]) => t >= S[i] - .15 && t <= subEnd(i)).map(([L, i]) => ({ id: 'l' + L.n, text: L.pl, x0: 180, y0: 920, x1: 1740, y1: 1040 })) : [];
  window.EV = [
    { t: T.sw[0], type: 'brush', d: 1.8 }, { t: T.expl[0], type: 'pencil', d: 1.6 }, { t: T.titleOut[0], type: 'wash', d: 1.2, g: .5 },
    { t: T.q[0], type: 'pencil', d: 1.5 }, { t: T.head[0], type: 'brush', d: 2.3 },
    ...KEYS.flatMap((k, i) => [{ t: T[k][0], type: 'brush', d: 1.3, pan: [-.5, -.5, .5, .5, .5][i] }, { t: T[k][0] + .7, type: 'pencil', d: .9, pan: [-.5, -.5, .5, .5, .5][i] }]),
    { t: T.river[0], type: 'wash', d: 3.2, g: 1 }, { t: T.pageIn[0], type: 'page', d: 1.2 }, { t: T.p2[0], type: 'pencil', d: 1.4 },
    { t: T.wear[0], type: 'brush', d: 2, pan: -.5 }, { t: T.pulse[0], type: 'beat', d: 2 }, { t: T.pers[0], type: 'brush', d: 2 }, { t: T.data[0], type: 'brush', d: 2, pan: .5 },
    ...['wear', 'pers', 'data'].map((k, i) => ({ t: T[k][0] + .8, type: 'pencil', d: 1.1, pan: [-.5, 0, .5][i] })),
    { t: T.pageOut[0], type: 'page', d: 1.0 }, { t: T.endTitle[0], type: 'pencil', d: 1.6 }, { t: T.tag[0], type: 'pencil', d: 1.5 }, { t: T.stamp, type: 'stamp' },
  ];
  window.TIMING = { S, D, SL, T, voice: TL.voice, dur: TL.dur };
  PAPER_IMG = new Image(); PAPER_IMG.src = 'paper.jpg'; await PAPER_IMG.decode();
  await Promise.all(['500 74px Caveat', '500 32px Caveat', '500 132px "Cormorant Garamond"', 'italic 500 54px "Cormorant Garamond"', 'italic 600 54px "Cormorant Garamond"', '700 50px "Cormorant Garamond"', '400 17px "IBM Plex Mono"'].map(f => document.fonts.load(f, 'Aąęółżźść')));
  withSeed(11, () => { SP.head = buildHead(); SP.head.spr = sprite(SP.head.S); });
  withSeed(21, () => { SP.psy = buildPsy(); }); withSeed(31, () => { SP.neu = buildNeu(); }); withSeed(41, () => { SP.lin = buildLin(); });
  withSeed(51, () => { SP.phi = buildPhi(); }); withSeed(61, () => { SP.cs = buildCs(); });
  withSeed(91, () => { SP.wear = buildWear(); SP.pulse = buildPulse(); }); withSeed(92, () => { SP.pers = buildPers(); }); withSeed(93, () => { SP.data = buildData(); });
  for (const k of [...KEYS, 'wear', 'pers', 'data']) SP[k].spr = sprite(SP[k].S);
  withSeed(71, () => { SP.rivers = buildRivers(); SP.brain = buildBrain(); buildStamp(); SP.sw = buildSwatches(); });
  withSeed(81, () => { SP.underline = mk(qcurve(745, 290, 1170, 284, -5, 24), 6, INK2, { prof: 'even', nb: 3, a: .7 }); SP.underline2 = mk(qcurve(700, 254, 1220, 250, -5, 24), 6, INK2, { prof: 'even', nb: 3, a: .7 }); });
  window.READY = true;
})();

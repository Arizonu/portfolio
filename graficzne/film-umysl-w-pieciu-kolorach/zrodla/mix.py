# Score (synthesised kalimba + glockenspiel + soft pad), foley from events.json, narration → out/mix.wav (48 kHz stereo)
# usage: "$LIB/.venv/bin/python" mix.py   (run after events.mjs has written events.json)
import json, os, re, sys, numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, resample_poly, fftconvolve
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
VER = sys.argv[1] if len(sys.argv) > 1 else 'pl'
SR = 48000
ev = json.load(open(f'events_{VER}.json')); TLJ = json.load(open(f'timeline_{VER}.json'))
DUR = float(ev['dur']); EV = ev['ev']
S = [L['t'] for L in TLJ['lines']]; Dd = [L['d'] for L in TLJ['lines']]
SIL = (S[4] - 1.45, S[4] - .35)            # brush lifted before the colours meet
TURN = S[5] - 1.25; FIN = S[9] - 1.3
N = int(DUR * SR); rng = np.random.default_rng(5)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def tt(d): return np.arange(int(d * SR)) / SR
def st(x, pan=0.0):
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    return np.stack([x * l * 1.414, x * r * 1.414], 1)
def put(buf, t, x):
    i = int(t * SR); j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += x[:j - i]
def rms(x): return np.sqrt(np.mean(x ** 2) + 1e-12)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

# ---------- score: 84 bpm, bars of 4 beats ----------
BEAT = 60 / 84; BAR = 4 * BEAT
mus = np.zeros((N, 2))
def kalimba(m, v=1.0, d=2.2):
    t = tt(d); f = mtof(m)
    x = np.sin(2 * np.pi * f * t) * np.exp(-t / .9) + .25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t / .25) + .12 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / .06)
    x[:int(.003 * SR)] *= np.linspace(0, 1, int(.003 * SR))
    return x * v
def glock(m, v=1.0, d=2.5):
    t = tt(d); f = mtof(m)
    return v * (np.sin(2 * np.pi * f * t) * np.exp(-t / 1.1) + .4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .3) + .2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / .1))
def pad(ms, d, v=1.0, att=.9, rel=1.2):
    t = tt(d + rel); x = np.zeros(len(t))
    for m in ms:
        for det in (-.07, 0, .07):
            ph = 2 * np.pi * mtof(m + det) * t
            x += sum(np.sin(ph * h) / h for h in (1, 2, 3, 4))
    x = lp(x, 1500)
    e = np.minimum(1, t / att) * np.where(t < d, 1, np.exp(-(t - d) / (rel / 3)))
    return x * e / len(ms) * v
def bass(m, d, v=1.0):
    t = tt(d + .6); f = mtof(m)
    x = np.sin(2 * np.pi * f * t) + .45 * np.sin(4 * np.pi * f * t) + .2 * np.sin(6 * np.pi * f * t)
    e = np.minimum(1, t / .05) * np.exp(-t / 1.6) * np.where(t < d, 1, np.exp(-(t - d) / .15))
    return x * e * v

# chords per bar (D, Bm, G, A …), MIDI ≥ 48 for pads
CH = {'D': ([62, 66, 69, 74], 50), 'Bm': ([59, 62, 66, 71], 47 + 12), 'G': ([55, 59, 62, 67], 55), 'A': ([57, 61, 64, 69], 57), 'Em': ([55, 59, 64, 67], 52)}
motif = [74, 78, 81, None, 83, 81, 78, None]           # eighth notes, one bar
motif2 = [76, None, 78, 81, None, 78, 76, 74]
def kal_bar(t0, pat, v=.5, pan=0.0, up=0):
    for i, m in enumerate(pat):
        if m is None: continue
        put(mus, t0 + i * BEAT / 2, st(kalimba(m + up, v * (1 if i % 2 == 0 else .75)), pan + (.2 if i % 2 else -.2)))

SILENCE = SIL
kal_bar(0.05, motif, .42); kal_bar(BAR, motif2, .4)
prog = ['D', 'Bm', 'G', 'A', 'Em', 'A', 'D', 'Bm', 'G', 'A']
def section(t0, t1, start_chord=0, v=1.0, mot=True):
    b = 0
    while t0 + b * BAR < t1 - .5:
        tb = t0 + b * BAR; notes, root = CH[prog[(start_chord + b) % len(prog)]]
        d = min(BAR, t1 - .3 - tb)
        put(mus, tb, st(pad(notes, d, .5 * v, rel=.35 if tb + BAR > t1 else 1.2)))
        put(mus, tb, st(bass(root - 12 if root >= 60 else root, d, .45 * v)))
        if mot: kal_bar(tb, motif if b % 2 == 0 else motif2, .34 * v)
        b += 1
section(2 * BAR, SIL[0])
for k, sk in enumerate(['psy', 'neu', 'lin', 'phi', 'cs']):
    tt_ = S[3] + Dd[3] * (.04 + k * .19)
    put(mus, tt_, st(glock([86, 85, 83, 81, 86][k], .3), [-.5, -.5, .5, .5, .5][k]))
mus[int((SIL[0] - .25) * SR):int(SIL[0] * SR)] *= np.linspace(1, 0, int(.25 * SR))[:, None]
mus[int(SIL[0] * SR):int(SIL[1] * SR)] = 0
# the colours meet: swell
put(mus, SIL[1], st(pad(CH['G'][0] + [74], 1.8, .8, att=1.2, rel=.8)))
put(mus, SIL[1] + 1.8, st(pad(CH['A'][0] + [76], 1.8, .85, att=.6, rel=.8)))
put(mus, SIL[1], st(bass(55, 1.8, .45))); put(mus, SIL[1] + 1.8, st(bass(57, 1.8, .45)))
kal_bar(SIL[1], motif, .3, up=12)
# page two: lighter, plucked, a new section of the journal
section(TURN + .2, FIN, 6, v=.85)
for tt_ in (S[6], S[7], S[8]): put(mus, tt_, st(glock(88, .22), 0))
# finale: resolve on D
put(mus, FIN, st(pad(CH['D'][0] + [78], DUR - FIN - 1.5, .7, att=.6, rel=1.6)))
put(mus, FIN, st(bass(50, 3.5, .5)))
for i, (dt, m) in enumerate([(0, 74), (.36, 78), (.71, 81), (1.43, 86), (2.86, 81), (4.29, 78), (5.71, 74)]):
    if FIN + dt < DUR - 1: put(mus, FIN + dt, st(kalimba(m, .36), (-.3, .3)[i % 2]))
tst = [e_['t'] for e_ in EV if e_['type'] == 'stamp'][0]
put(mus, tst, st(glock(86, .28)))
e = np.ones(N); a = int((DUR - 2.4) * SR); e[a:] = np.linspace(1, 0, N - a) ** 1.4; mus *= e[:, None]

# ---------- foley from the page's events ----------
fx = np.zeros((N, 2))
def brush(d):
    n = int(d * SR); x = bp(rng.standard_normal(n), 900, 4200)
    t = np.arange(n) / SR; trem = .65 + .35 * np.sin(2 * np.pi * 7.5 * t + rng.uniform(0, 6)) * np.sin(2 * np.pi * 1.3 * t)
    env = np.minimum(1, t / .08) * np.minimum(1, (d - t) / .25)
    return x * trem * env * .09
def pencil(d):
    n = int(d * SR); x = bp(rng.standard_normal(n), 2600, 7500)
    t = np.arange(n) / SR; g = (np.sin(2 * np.pi * rng.uniform(5, 8) * t) > -.2).astype(float); g = lp(g, 40)
    env = np.minimum(1, t / .03) * np.minimum(1, (d - t) / .1)
    return x * g * env * .07
def wash(d):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    out = np.zeros(n); B = 8
    for k in range(B):   # rising swept band
        i0, i1 = k * n // B, (k + 1) * n // B
        f = 300 + 1400 * k / B
        out[i0:i1] = bp(x, f, f * 2.2)[i0:i1]
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.3
    return lp(out, 3000) * env * .14
def stamp_snd():
    t = tt(.5); f = 70 * np.exp(-t * 6)
    th = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .08)
    sl = bp(rng.standard_normal(len(t)), 500, 3000) * np.exp(-t / .025)
    return th * .9 + sl * .35
def page_flip(d):
    n = int(d * SR); t = np.arange(n) / SR; x = rng.standard_normal(n)
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2 * (1 + .5 * np.sin(2 * np.pi * 9 * t))
    return (bp(x, 600, 5000) * env * .16 + bp(x, 150, 600) * env * .06)
def heart():
    t = tt(.4); f = 55
    b = np.sin(2 * np.pi * f * t) * np.exp(-t / .06)
    return (b + np.roll(b, int(.17 * SR)) * .6) * .5
for e_ in EV:
    k, t0, pan = e_['type'], e_['t'], e_.get('pan', 0)
    if k == 'brush': put(fx, t0, st(brush(e_['d']), pan))
    elif k == 'pencil': put(fx, t0, st(pencil(e_['d']), pan * .6))
    elif k == 'wash': put(fx, t0, st(wash(e_['d']) * e_.get('g', 1), 0))
    elif k == 'page': put(fx, t0, st(page_flip(e_['d']), .3))
    elif k == 'beat':
        for j in range(3): put(fx, t0 + j * .7, st(heart(), -.4))
    elif k == 'stamp': put(fx, t0, st(stamp_snd(), .55))
# room / paper bed (stays through the silence)
pk = np.fft.irfft(np.fft.rfft(rng.standard_normal(N)) / np.sqrt(np.maximum(1, np.arange(N // 2 + 1))), N)
bed = lp(pk, 700); bed = bed / rms(bed) * .004
fx += np.stack([bed, np.roll(bed, 2400)], 1)

# ---------- narration ----------
vo = np.zeros((N, 2)); env_vo = np.zeros(N)
def comp(x, thr=.18, ratio=3.0):
    a = np.abs(x); e = np.zeros_like(a); c = 0
    att, rel = np.exp(-1 / (.003 * SR)), np.exp(-1 / (.12 * SR))
    for i in range(len(a)): c = att * c + (1 - att) * a[i] if a[i] > c else rel * c + (1 - rel) * a[i]; e[i] = c
    g = np.where(e > thr, (thr + (e - thr) / ratio) / np.maximum(e, 1e-9), 1)
    return x * g
for L in TLJ['lines']:
    x, sr = sf.read(f"vo/{TLJ['voice']}_{L['n']}.wav")
    if x.ndim > 1: x = x.mean(1)
    if sr != SR: x = resample_poly(x, SR, sr)
    x = comp(x / (np.abs(x).max() + 1e-9) * .9, thr=.3, ratio=2.0)
    put(vo, L['t'], st(x * .8, 0))
    i = int(L['t'] * SR); env_vo[i:i + len(x)] = 1
# duck music ~4 dB under the voice, smoothed
sm = np.convolve(env_vo, np.ones(int(.25 * SR)) / int(.25 * SR), 'same')
mus *= (1 - .37 * sm)[:, None]

# balance: voice RMS ~10 dB over music where they overlap
vm = vo[env_vo > 0]; mm = mus[env_vo > 0]
mus *= (rms(vm) / 10 ** (10 / 20)) / (rms(mm) + 1e-9)
fx *= rms(vm) / (rms(vm) + 1e-9)

# light room reverb on music + foley
IRn = int(1.4 * SR); IR = rng.standard_normal((IRn, 2)) * np.exp(-np.arange(IRn) / SR * 4)[:, None]
IR = np.stack([lp(IR[:, 0], 5000), lp(IR[:, 1], 5000)], 1); IR /= np.sqrt((IR ** 2).sum(0))
def verb(x2, wet):
    y = np.stack([fftconvolve(x2[:, 0], IR[:, 0])[:len(x2)], fftconvolve(x2[:, 1], IR[:, 1])[:len(x2)]], 1)
    return x2 * (1 - wet) + y * wet
mix = verb(mus, .28) + verb(fx, .15) + verb(vo, .08)
# low-end check: keep 20–120 Hz modest
mix = hp(mix.T, 35).T
mix = mix / (np.abs(mix).max() + 1e-9) * .89
os.makedirs('out', exist_ok=True)
sf.write(f'out/mix_{VER}.wav', mix.astype(np.float32), SR, subtype='PCM_24')
lo = rms(lp(mix[:, 0], 120)); hi = rms(hp(mix[:, 0], 120))
print(f'mix.wav {DUR:.1f}s · peak {np.abs(mix).max():.2f} · low/high band {20*np.log10(lo/hi):.1f} dB')

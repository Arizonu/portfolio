"""Prepare Conte69 cortical surface + maps + Schaefer-400 + Mesulam + FC into a compact binary bundle."""
import sys, json, numpy as np, nibabel as nib
from scipy import sparse

D = sys.argv[1]
OUT = sys.argv[2]

hemis = ['lh', 'rh']
pos, tri = [], []
for h in hemis:
    g = nib.load(f'{D}/surfaces/conte69_32k_{h}.gii')
    pos.append(g.darrays[0].data.astype(np.float64))
    tri.append(g.darrays[1].data.astype(np.int64))
sph = [nib.load(f'{D}/surfaces/conte69_32k_{h}_sphere.gii').darrays[0].data.astype(np.float64) for h in hemis]
nv = pos[0].shape[0]


def adjacency(F, n):
    i = np.concatenate([F[:, 0], F[:, 1], F[:, 2], F[:, 1], F[:, 2], F[:, 0]])
    j = np.concatenate([F[:, 1], F[:, 2], F[:, 0], F[:, 0], F[:, 1], F[:, 2]])
    A = sparse.coo_matrix((np.ones(len(i)), (i, j)), shape=(n, n)).tocsr()
    A.data[:] = 1
    deg = np.asarray(A.sum(1)).ravel()
    return sparse.diags(1 / deg) @ A


def inflate(P, F, it=220):
    W = adjacency(F, len(P))
    X = P.copy()
    c0 = P.mean(0)
    r0 = np.sqrt(((P - c0) ** 2).sum(1)).mean()
    for k in range(it):
        X = X + 0.55 * (W @ X - X)
    # restore size
    c = X.mean(0)
    r = np.sqrt(((X - c) ** 2).sum(1)).mean()
    X = (X - c) * (r0 / r) + c0
    return X


infl = [inflate(pos[i], tri[i]) for i in range(2)]

# separate hemispheres for inflated / sphere views
for i, s in enumerate([-1, 1]):
    gap = 6.0
    inner = infl[i][:, 0].max() if s < 0 else infl[i][:, 0].min()
    infl[i][:, 0] += (-gap - inner) if s < 0 else (gap - inner)
    sp = sph[i] * 0.72
    sp = sp - sp.mean(0)
    sp[:, 0] += s * (sp[:, 0].max() + 8)
    sp[:, 1] += pos[i][:, 1].mean()
    sp[:, 2] += pos[i][:, 2].mean()
    sph[i] = sp

blobs = []
manifest = {'nv': int(nv), 'hemis': hemis, 'arrays': {}}
off = 0


def add(name, arr, meta=None):
    global off
    b = arr.tobytes()
    pad = (-len(b)) % 8
    manifest['arrays'][name] = {'offset': off, 'length': len(b), 'dtype': str(arr.dtype), 'shape': list(arr.shape), **(meta or {})}
    blobs.append(b + b'\0' * pad)
    off += len(b) + pad


def add_pos(name, P):
    lo = P.min(0)
    hi = P.max(0)
    sc = (hi - lo) / 65535.0
    q = np.round((P - lo) / sc).astype(np.uint16)
    add(name, q, {'lo': lo.tolist(), 'scale': sc.tolist()})


for i, h in enumerate(hemis):
    add_pos(f'mid_{h}', pos[i])
    add_pos(f'infl_{h}', infl[i])
    add_pos(f'sph_{h}', sph[i])
    add(f'tri_{h}', tri[i].astype(np.uint16))

maps = {
    'curv': 'conte69_32k_curvature', 'thick': 'conte69_32k_thickness', 'myelin': 'conte69_32k_t1wt2w',
    'g1': 'conte69_32k_fc_gradient0', 'g2': 'conte69_32k_fc_gradient1', 'mpc': 'conte69_32k_mpc_gradient0'
}
for k, f in maps.items():
    a = np.loadtxt(f'{D}/matrices/main_group/{f}.csv')
    lo, hi = float(np.nanmin(a)), float(np.nanmax(a))
    q = np.where(np.isnan(a), 65535, np.round((a - lo) / (hi - lo) * 65534)).astype(np.uint16)
    p2, p98 = np.nanpercentile(a, [2, 98])
    add(f'map_{k}', q, {'lo': lo, 'hi': hi, 'p2': float(p2), 'p98': float(p98), 'mean': float(np.nanmean(a))})

sch = np.loadtxt(f'{D}/parcellations/schaefer_400_conte69.csv').astype(np.uint16)
mes = np.loadtxt(f'{D}/parcellations/mesulam_conte69.csv').astype(np.uint8)
add('sch400', sch)
add('mesulam', mes)
fc = np.loadtxt(f'{D}/matrices/main_group/schaefer_400_mean_connectivity_matrix.csv', delimiter=',')
flo, fhi = float(fc.min()), float(fc.max())
add('fc400', np.round((fc - flo) / (fhi - flo) * 255).astype(np.uint8), {'lo': flo, 'hi': fhi})

# parcel centroids (mid surface)
P = np.vstack(pos)
cent = np.zeros((400, 3))
cnt = np.zeros(400)
for l in range(1, 401):
    m = sch == l
    cent[l - 1] = P[m].mean(0)
    cnt[l - 1] = m.sum()
manifest['parcelCentroids'] = np.round(cent, 1).tolist()
manifest['parcelVertexCount'] = cnt.astype(int).tolist()
# RH ordering check (first 31 parcels occipital?)
manifest['checkRHvisY'] = float(cent[200:231, 1].mean())
manifest['checkLHvisY'] = float(cent[0:31, 1].mean())

with open(f'{OUT}/cortex.bin', 'wb') as fh:
    for b in blobs:
        fh.write(b)
with open(f'{OUT}/cortex.json', 'w') as fh:
    json.dump(manifest, fh)
print('bytes', off, 'RH vis y', manifest['checkRHvisY'], 'LH vis y', manifest['checkLHvisY'])

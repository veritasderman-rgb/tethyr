#!/usr/bin/env python3
"""Výšková mapa a masky terénu odvozené z malované mapy Torilu (toril-east-west.jpg).

Výstup do ../assets/terrain/:
  map.jpg        textura (podklad, mírně doostřená a s vyrovnanými barvami)
  height.bin     Uint16 LE, rozměr W x H (polovina podkladu), výška = (v/65535)*(HMAX-HMIN)+HMIN
  mask.png       R = les, G = poušť, B = hory/kopce (0..255), A = ledovec
  meta.json      rozměry, rozsah výšek, měřítko
Spouští se: python3 tools/build_terrain.py [cesta k podkladu]
Mapa je jen věrohodná, ne geodeticky přesná: výšky se odhadují z barev a kresby.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'assets', 'terrain')
SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/work/web/data/toril-east-west.jpg'
DEBUG = os.environ.get('DEBUG')
os.makedirs(OUT, exist_ok=True)

img = Image.open(SRC).convert('RGB')
W0, H0 = img.size
a = np.asarray(img).astype(np.float32)
R, G, B = a[..., 0], a[..., 1], a[..., 2]
lum = 0.299 * R + 0.587 * G + 0.114 * B
mx = a.max(-1); mn = a.min(-1)
sat = (mx - mn) / np.maximum(mx, 1)

# ---------------------------------------------------------------- voda: modravé pixely (i tmavomodré popisky v moři)
blue = (B > R + 18) & (B >= G - 4) & (sat > 0.08)
# ledovec: skoro bílý a studený (vysoký jas, nízká sytost) – nesmí se splést s vodou
ice = (lum > 222) & (sat < 0.09) & (B >= R)
blue &= ~ice
# vyčištění: zaplnit popisky v moři, odstranit drobné skvrny
water = ndi.binary_closing(blue, structure=np.ones((5, 5)), iterations=2)
water = ndi.binary_opening(water, structure=np.ones((2, 2)))
lab, n = ndi.label(water)
sizes = ndi.sum(water, lab, index=np.arange(1, n + 1))
# komponenty dotýkající se okraje mapy = oceán; velké vnitřní = jezera/moře
edge = np.unique(np.concatenate([lab[0, :], lab[-1, :], lab[:, 0], lab[:, -1]]))
big = np.zeros(n + 1, bool)
for i, s in enumerate(sizes, 1):
    if s > 900 or (i in edge and s > 200):
        big[i] = True
sea = big[lab]
sea = ndi.binary_fill_holes(sea | ~ndi.binary_dilation(~sea, iterations=1)) & sea | sea
# ostrůvky menší než pár pixelů do moře zahrnout jen když jsou to popisky (tmavé), jinak nechat
land = ~sea
lab2, n2 = ndi.label(land)
s2 = ndi.sum(land, lab2, index=np.arange(1, n2 + 1))
tiny = np.zeros(n2 + 1, bool)
for i, s in enumerate(s2, 1):
    if s < 6:
        tiny[i] = True
sea |= tiny[lab2]
land = ~sea
river = water & land            # řeky a malá jezera: jen mělké zářezy

# ---------------------------------------------------------------- les, poušť, hory
forest = (G > R + 2) & (G > B + 8) & land & (lum < 215)
desert = (R > G + 14) & (G > B + 18) & (lum > 170) & land
# hory: hustá kresba tmavších hnědošedých tahů (tenké popisky a cesty mají malou hustotu)
forest_d = ndi.binary_dilation(forest, iterations=4)
mpx = (lum < 208) & (lum > 70) & (sat < 0.34) & ~forest_d & land & (R >= G - 8) & ~blue
dens = ndi.uniform_filter(mpx.astype(np.float32), 9)
mtn = np.clip((dens - 0.30) / 0.35, 0, 1)
icepx = ice & land
mtn = np.maximum(mtn, np.clip((ndi.uniform_filter(((lum < 215) & icepx | mpx).astype(np.float32), 9) - 0.4) / 0.4, 0, 1) * 0)
mtn_s = ndi.gaussian_filter(mtn, 1.6)
mtn_s = np.clip((mtn_s - 0.08) / 0.6, 0, 1)
mtn_big = ndi.gaussian_filter(mtn_s, 6)            # masiv pro základnu pohoří

forest_s = np.clip(ndi.gaussian_filter(forest.astype(np.float32), 2.0) * 1.6 - 0.25, 0, 1) * land
desert_s = np.clip(ndi.gaussian_filter(desert.astype(np.float32), 3.0) * 1.4 - 0.2, 0, 1) * land
ice_s = np.clip(ndi.gaussian_filter((ice & land).astype(np.float32), 2.0) * 1.5 - 0.2, 0, 1)

# ---------------------------------------------------------------- výšky (jednotky světa = pixely podkladu)
d_land = ndi.distance_transform_edt(land)      # vzdálenost od moře na souši
d_sea = ndi.distance_transform_edt(sea)        # vzdálenost od pobřeží v moři
yy, xx = np.mgrid[0:H0, 0:W0].astype(np.float32)

def noise(scale, seed, oct=4):
    rng = np.random.default_rng(seed)
    out = np.zeros((H0, W0), np.float32); amp = 1.0; tot = 0
    for o in range(oct):
        s = scale / (2 ** o)
        gw, gh = int(W0 / s) + 3, int(H0 / s) + 3
        g = rng.random((gh, gw)).astype(np.float32)
        up = ndi.zoom(g, (H0 / (gh - 2), W0 / (gw - 2)), order=3)[:H0, :W0]
        out += up * amp; tot += amp; amp *= 0.5
    return np.clip(out / tot, 0, 1)

n1 = noise(40, 1); n2 = noise(9, 2, 3); rid = 1 - np.abs(noise(14, 3, 4) * 2 - 1); rid = rid ** 2.2
base = 0.25 + 1.6 * (1 - np.exp(-d_land / 45.0)) + (n1 - 0.5) * 0.9
base = np.maximum(base, 0.12)
h = base.copy()
h += mtn_big * 3.2 + mtn_s * (2.6 + 7.5 * rid) * (0.65 + 0.7 * n1)
h += mtn_s * (n2 - 0.5) * 1.2
h += forest_s * 0.25 + desert_s * (np.sin(xx * 0.55 + n2 * 9) * 0.5 + 0.5) * 0.35 * (1 - mtn_s)
h += ice_s * 1.2
h -= river.astype(np.float32) * 0.18 * (1 - mtn_s)
h = np.where(land, h, 0)
depth = -(0.25 + 3.2 * (1 - np.exp(-d_sea / 30.0)) + (n1 - 0.5) * 0.6)
h = np.where(sea, depth, h)
# plynulý přechod na pobřeží
h = ndi.gaussian_filter(h, 0.9)
h = np.where(land, np.maximum(h, 0.08), np.minimum(h, -0.08))

HMIN, HMAX = float(h.min()), float(h.max())
print('výšky', HMIN, HMAX, 'moře %', sea.mean() * 100, 'hory %', (mtn_s > 0.3).mean() * 100)

# polovina rozlišení pro síť a dotazy na výšku
W, H = W0 // 2, H0 // 2
hs = ndi.zoom(h, (H / H0, W / W0), order=1)
q = np.round((hs - HMIN) / (HMAX - HMIN) * 65535).astype('<u2')
q.tofile(os.path.join(OUT, 'height.bin'))

def u8(x):
    return np.clip(x * 255, 0, 255).astype(np.uint8)
mask = np.dstack([u8(forest_s), u8(desert_s), u8(mtn_s), u8(ice_s)])
Image.fromarray(mask, 'RGBA').resize((W, H), Image.BILINEAR).save(os.path.join(OUT, 'mask.png'), optimize=True)
seam = u8(sea.astype(np.float32))
Image.fromarray(seam).resize((W, H), Image.BILINEAR).save(os.path.join(OUT, 'sea.png'), optimize=True)

# textura: lehké doostření a teplejší pergamen
tex = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
tex = ImageEnhance.Contrast(tex).enhance(1.04)
tex.save(os.path.join(OUT, 'map.jpg'), quality=90, optimize=True, progressive=True)

meta = {'src': os.path.basename(SRC), 'size': [W0, H0], 'grid': [W, H], 'hmin': HMIN, 'hmax': HMAX,
        'milesPerUnit': 2.6, 'note': 'jednotka světa = 1 pixel podkladu; výšky přehnané'}
json.dump(meta, open(os.path.join(OUT, 'meta.json'), 'w'), ensure_ascii=False, indent=1)

if DEBUG:
    dbg = np.dstack([u8(mtn_s), u8(forest_s), u8(sea.astype(np.float32))])
    Image.fromarray(dbg).save('/tmp/look/dbg_mask.png')
    hv = (h - HMIN) / (HMAX - HMIN)
    Image.fromarray(u8(hv)).save('/tmp/look/dbg_height.png')
    Image.fromarray(u8(ice_s)).save('/tmp/look/dbg_ice.png')
print('hotovo', W, H)

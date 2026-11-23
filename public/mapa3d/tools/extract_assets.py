#!/usr/bin/env python3
"""Převezme 3D modely a zvuky z repozitáře desetimesti (models_*.js, sounds.js = base64 v ES modulech)
a uloží je jako samostatné soubory, aby se daly nahrávat líně po jednom.
  assets/models/<jméno>.glb     (models_hlite.js se přeskakuje, obsahuje totožné domy)
  assets/sounds/<jméno>.mp3
Spouští se: python3 tools/extract_assets.py [cesta k desetimesti]
"""
import base64, json, os, re, sys

SRC = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/veritasderman-rgb/desetimesti'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_M = os.path.join(HERE, '..', 'assets', 'models')
OUT_S = os.path.join(HERE, '..', 'assets', 'sounds')
os.makedirs(OUT_M, exist_ok=True); os.makedirs(OUT_S, exist_ok=True)

def load(path):
    s = open(path, encoding='utf-8').read()
    s = s[s.index('{'):s.rindex('}') + 1]
    return json.loads(s)

index = {}
for f in sorted(os.listdir(SRC)):
    m = re.match(r'models_(\w+)\.js$', f)
    if not m:
        continue
    grp = m.group(1)
    for k, v in load(os.path.join(SRC, f)).items():
        if grp == 'hlite':
            continue          # v repozitáři jsou totožné s models_houses.js
        name = k
        data = base64.b64decode(v)
        open(os.path.join(OUT_M, name + '.glb'), 'wb').write(data)
        index[name] = {'group': grp, 'bytes': len(data)}
json.dump(index, open(os.path.join(OUT_M, 'index.json'), 'w'), indent=1)
snd = load(os.path.join(SRC, 'sounds.js'))
for k, v in snd.items():
    open(os.path.join(OUT_S, k + '.mp3'), 'wb').write(base64.b64decode(v))
print(len(index), 'modelů,', len(snd), 'zvuků')

#!/usr/bin/env python3
"""Hlas proroctví (iterace 8): nahrávky „Alaundo“ → assets/proroctvi/kap1–3.mp3 (mono 64 kb/s) a časy veršů.

Zdroj: SRC_PROROCTVI (výchozí /home/claude/proroctvi): kap1.mp3–kap3.mp3 a timing.json, který vyrábí
make_timing.py ve zdrojové složce (faster-whisper, jazyk cs, zarovnání na trojverší a dvojverší; jednotky bez
rozpoznaného slova úměrně podle délky textu). Když timing.json chybí, časy se rozdělí úměrně podle počtu znaků.
Výstup: assets/proroctvi/kapN.mp3, data/proroctvi-timing.json (kopie časů v repu), public/data/proroctvi-audio.json
{"chapters": [{"n": 1, "file": "assets/proroctvi/kap1.mp3", "duration": s, "at": [trojverší, verš 0, verš 1, …]}]}.
Spouští se opakovaně; převádí jen to, co chybí nebo je starší než zdroj (--force převede vše).
"""
import json, os, subprocess as sp, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('SRC_PROROCTVI', '/home/claude/proroctvi')
OUT = os.path.join(ROOT, 'assets', 'proroctvi')
P = json.load(open(os.path.join(ROOT, 'public', 'data', 'prophecy.json')))
force = '--force' in sys.argv
os.makedirs(OUT, exist_ok=True)

def dur(p):
    return float(sp.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]))

timing = None
tp = os.path.join(SRC, 'timing.json')
if os.path.exists(tp):
    timing = json.load(open(tp))
    json.dump(timing, open(os.path.join(ROOT, 'data', 'proroctvi-timing.json'), 'w'), ensure_ascii=False, indent=1)
elif os.path.exists(os.path.join(ROOT, 'data', 'proroctvi-timing.json')):
    timing = json.load(open(os.path.join(ROOT, 'data', 'proroctvi-timing.json')))

out = {'hlas': 'Alaundo', 'chapters': []}
for c in P['chapters']:
    n = c['n']
    src = os.path.join(SRC, f'kap{n}.mp3')
    dst = os.path.join(OUT, f'kap{n}.mp3')
    if os.path.exists(src) and (force or not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst)):
        sp.check_call(['ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '1', '-ar', '44100', '-b:a', '64k', '-map_metadata', '-1', dst])
        print('převedeno', dst, os.path.getsize(dst) // 1024, 'kB')
    if not os.path.exists(dst):
        print('chybí nahrávka', src); continue
    D = round(dur(dst), 2)
    units = [' '.join(c['tercet'])] + [' '.join(v['t']) for v in c['verses']]
    t = (timing or {}).get(str(n))
    if t and len(t['units']) == len(units):
        at = [u['start'] for u in t['units']]
        how = 'whisper'
    else:
        tot = sum(len(u) for u in units); acc = 0; at = []
        for u in units:
            at.append(round(D * acc / tot, 2)); acc += len(u)
        how = 'úměrně'
    out['chapters'].append({'n': n, 'file': f'assets/proroctvi/kap{n}.mp3', 'duration': D, 'at': at})
    print(f'kapitola {n}: {D} s, {len(at)} jednotek, časy {how}')
json.dump(out, open(os.path.join(ROOT, 'public', 'data', 'proroctvi-audio.json'), 'w'), ensure_ascii=False, separators=(',', ':'))

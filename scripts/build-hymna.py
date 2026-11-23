#!/usr/bin/env python3
"""Hymna „Rauko“: text + časy řádků → data/hymna.json (načítá ho oddíl Hymna).

  python3 scripts/build-hymna.py

Text:  SRC_HYMNA/rauko.txt (jinak data/hymna.txt). První řádek „RAUKO – hymna …“ se vynechává, text se jinak nemění.
Časy:  SRC_HYMNA/timing.json (pole čísel = začátky všech řádků textu v pořadí, nebo {"lines": [...], "sekce": {...}}),
       jinak data/hymna-timing.json. Nesedí-li počet řádků, časy se rozloží úměrně délce (a skript to ohlásí).
"""
import json, os, re, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.environ.get('SRC_HYMNA', '/home/claude/hymna')
LAB = {'Intro': 'Úvod', 'Verse 1': 'I. sloka', 'Pre-Chorus': 'Předrefrén', 'Chorus': 'Refrén', 'Verse 2': 'II. sloka',
       'Bridge': 'Přechod', 'Guitar Solo': 'Kytarové sólo', 'Final Chorus': 'Závěrečný refrén', 'Outro': 'Závěr'}

txt = next((p for p in (SRC + '/rauko.txt', ROOT + '/data/hymna.txt') if os.path.exists(p)))
raw = open(txt, encoding='utf-8').read().split('\n')
secs = []
for ln in raw:
    ln = ln.rstrip()
    m = re.match(r'^\[(.+?)\]\s*(\(.*\))?$', ln)
    if m:
        secs.append({'tag': m.group(1), 'note': (m.group(2) or '').strip('()'), 'label': LAB.get(m.group(1), m.group(1)), 'lines': []})
    elif ln.strip() and secs:
        secs[-1]['lines'].append({'x': ln.strip()})
n = sum(len(s['lines']) for s in secs)

tp = SRC + '/timing.json'
tsrc = tp if os.path.exists(tp) else ROOT + '/data/hymna-timing.json'
t = json.load(open(tsrc, encoding='utf-8'))
lines = t if isinstance(t, list) else t.get('lines', [])
sekce = {} if isinstance(t, list) else t.get('sekce', {})
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', SRC + '/rauko.mp3'], capture_output=True, text=True).stdout.strip() or 0) if os.path.exists(SRC + '/rauko.mp3') else 0
exact = len(lines) == n
if not exact:
    print(f'  !! časů je {len(lines)}, řádků {n}: rozloženo úměrně (doplňte timing.json)')
    tot = dur or 360.0
    w = [max(8, len(l['x'])) for s in secs for l in s['lines']]
    acc, lines = 8.0, []
    for k in w:
        lines.append(round(acc, 2)); acc += (tot - 20) * k / sum(w)
i = 0
for s in secs:
    for l in s['lines']:
        l['t'] = round(float(lines[i]), 2); i += 1
    s['start'] = s['lines'][0]['t'] if s['lines'] else sekce.get(s['tag'])
out = {'zdroj_casu': os.path.relpath(tsrc, ROOT) if not tsrc.startswith(SRC) else 'timing.json', 'presne': exact and tsrc.startswith(SRC), 'delka': dur, 'sekce': secs}
json.dump(out, open(ROOT + '/data/hymna.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'data/hymna.json: {len(secs)} částí, {n} řádků, časy z {out["zdroj_casu"]}, délka {dur:.1f} s')

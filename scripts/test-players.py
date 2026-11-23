#!/usr/bin/env python3
"""Kontrola obsahových pravidel: hráčské postavy nesmí mít svědectví, hlas ani video; PJ je Zdeněk T.; zakázané výrazy.
Spuštění: python3 scripts/test-players.py (exit 1 při chybě)."""
import json, os, re, sys, glob
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda p: json.load(open(os.path.join(R, p), encoding='utf-8'))
bad = []
chars = J('public/data/characters.json')
players = [c for c in chars if c.get('kind') == 'hrac']
norm = lambda s: re.sub(r'\s+', ' ', str(s or '').lower().strip())
pid = {c['id'] for c in players}
pname = {norm(x) for c in players for x in [c.get('name'), c.get('full_name'), *(c.get('aliases') or [])] if x}
print(f'hráčských postav: {len(players)} ({", ".join(sorted(pid))})')
for src in ['data/svedectvi.json', 'public/data/svedectvi.json']:
    for w in J(src):
        if w['id'] in pid or norm(w['jmeno']) in pname: bad.append(f'{src}: svědectví hráčské postavy {w["id"]} / {w["jmeno"]}')
        for t in w['text']:
            pass
for f in glob.glob(os.path.join(R, 'assets/voices/*.mp3')) + glob.glob(os.path.join(R, 'assets/video/*')) + glob.glob(os.path.join(R, 'public/img/wit/*')):
    b = re.sub(r'(-\d+)?\.[^.]+$', '', os.path.basename(f))
    if b in pid: bad.append(f'médium hráčské postavy: {os.path.relpath(f, R)}')
for k in J('assets/voices/timing.json'):
    if k in pid: bad.append(f'timing.json: {k}')
doc = J('data/dokument.json')
for k in doc['knihy']:
    for i in k['sv']:
        if i in pid: bad.append(f'dokument.json: {i}')
for i in doc['finale']['sv']:
    if i in pid: bad.append(f'dokument.json finále: {i}')
# zdroje textu
FORB = ['Granan', 'Schamedar', 'Wu Lej', 'povídk', 'Pavlovi', '@']
TXT = ['data/vypraveni/*.md', 'data/*.json', 'data/*.txt', 'src/**/*.js', 'index.html']
for pat in TXT:
    for f in glob.glob(os.path.join(R, pat), recursive=True):
        s = open(f, encoding='utf-8').read()
        for w in FORB:
            if w in s and not (w == '@' and f.endswith(('.js', '.html'))): bad.append(f'{os.path.relpath(f, R)}: zakázaný výraz „{w}“')
        for m in re.finditer(r'(Pán[a-zé ]* jeskyn[ěeí]|\bPJ\b)[^.\n]{0,40}Lukáš', s):
            bad.append(f'{os.path.relpath(f, R)}: Lukáš jako PJ? „{m.group(0)}“')
        for m in re.finditer(r'Lukáš[^.\n]{0,25}(Pán[a-zé ]* jeskyn|\bPJ\b)', s):
            if 'hráč' not in m.group(0) and 'Zdeněk' not in m.group(0) and ' a Pán' not in m.group(0) and ', Pán' not in m.group(0): bad.append(f'{os.path.relpath(f, R)}: Lukáš jako PJ? „{m.group(0)}“')
print('\n'.join(bad) if bad else 'OK  žádné svědectví, hlas ani video hráčských postav; PJ = Zdeněk T.; bez zakázaných výrazů')
sys.exit(1 if bad else 0)

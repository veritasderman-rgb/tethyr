#!/usr/bin/env python3
"""Import svědectví NPC (sada v2) do data/svedectvi.json. Jde spouštět opakovaně.

  python3 scripts/import-svedectvi.py [cesta/k/svedectvi_v2.json]

Text (pole `text`) se přebírá PŘESNĚ, beze změn. Z každého záznamu se berou pole
id, jmeno, role, strana, vazba, portret, hlas_popis, text, zdroje a stav + stav_titulek (jen u padlých a zmizelých).
Pole `opory`, `rezie`, `vzhled_pro_portret`, `_w`, `_s` se do webu nepřebírají.
Dopočítává se `skupina` (spojenci / nepřátelé / neutrální / nadhled) a `fokus` (bod zájmu obrazu;
zachová se z předchozího data/svedectvi.json, jinak výchozí).
Hráčské postavy (kind „hrac“ v characters.json) se do výstupu nikdy nedostanou.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('SRC_SVEDECTVI', '/home/claude/voices/svedectvi_v3.json')
# Sada v3 (iterace 7): anglický dabing. `text` = mluvené anglické věty (text_en bez audio tagů v [hranatých závorkách]),
# `titulky` = české titulky (titulky_cs), `jazyk` = 'en'. Časování vět odpovídá větám `text`.
NADHLED = {'elminster', 'khelben', 'khelbenova-dcera', 'alustriel', 'simbul', 'alusair'}
# stav (ze zdroje): žije | padl | zmizel; stav_titulek = dovětek pod jménem (např. „† padl ve Feng Asay“).
# Kdyby zdroj stav neměl, doplní se odsud.
STAV = {
    'kung-lao': ('padl', '† padl ve Feng Asay'),
    'ruda-rytirka': ('padl', '† padla v Bitvě o Rudou pevnost'),
    'rivalen': ('padl', '† padl na vrcholu Pyramidy času'),
    'sar-saratar': ('padl', '† padl v Anaurochu'),
}
KEEP = ('id', 'jmeno', 'role', 'strana', 'vazba', 'portret', 'hlas_popis', 'text', 'titulky', 'jazyk', 'zdroje', 'stav', 'stav_titulek')

src = json.load(open(SRC, encoding='utf-8'))
try:
    old = {w['id']: w for w in json.load(open(ROOT + '/data/svedectvi.json', encoding='utf-8'))}
except Exception:
    old = {}
pcs = set()
try:
    pcs = {c['id'] for c in json.load(open(ROOT + '/public/data/characters.json', encoding='utf-8')) if c.get('kind') == 'hrac'}
except Exception:
    pass

out = []
for w in src:
    if w['id'] in pcs:
        print('  přeskočeno (hráčská postava):', w['id']); continue
    o = {k: w[k] for k in KEEP if k in w and w[k] is not None}
    if w.get('text_en'):
        import re as _re
        o['text'] = [_re.sub(r'\s{2,}', ' ', _re.sub(r'\[[^\]]*\]', '', s)).strip() for s in w['text_en']]
        o['titulky'] = list(w.get('titulky_cs') or [])
        o['jazyk'] = 'en'
        if len(o['titulky']) != len(o['text']):
            print('  !! počet titulků nesedí s větami:', w['id'])
    if 'stav' not in o and w['id'] in STAV:
        o['stav'], o['stav_titulek'] = STAV[w['id']]
    if o.get('stav', 'žije') == 'žije':
        o.pop('stav', None); o.pop('stav_titulek', None)
    elif not o.get('stav_titulek'):
        o.pop('stav_titulek', None)
    o['skupina'] = 'nadhled' if w['id'] in NADHLED else {'spojenec': 'spojenci', 'nepřítel': 'nepřátelé'}.get(w['strana'], 'neutrální')
    o['fokus'] = old.get(w['id'], {}).get('fokus', '40% 30%')
    out.append(o)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import upresneni  # noqa: E402  upřesnění autora: vazba a stav (text zůstává beze změny)
upresneni.fix_witnesses(out)
json.dump(out, open(ROOT + '/data/svedectvi.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'data/svedectvi.json: {len(out)} svědectví z {SRC}')

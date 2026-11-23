#!/usr/bin/env python3
"""Data kampaně pro 3D mapu → ../data/campaign.json a obrázky/média do ../media/.

Zdroje (jen se čtou):
  /home/claude/work/web/data          map.json (místa, trasa), world.json, sessions_*.json, characters.json, npcs.json
  /home/claude/tethyr/public/data      zpracovaná data webu (vazby míst na sezení a NPC, malby k sezením a bitvám)
  /home/claude/tethyr/public/img       malby, portréty ve WebP
  /home/claude/voices/svedectvi_v2.json, /home/claude/voices2/*.mp3 + timing.json, /home/claude/vid/<id>.mp4
Spouští se: python3 tools/build_data.py [--no-media]
"""
import json, os, re, shutil, subprocess, sys, unicodedata

WORK = os.environ.get('SRC_WORK', '/home/claude/work/web/data')
WEB = os.environ.get('SRC_WEB', '/home/claude/tethyr/public')
VOI = os.environ.get('SRC_VOICES', '/home/claude/voices')
VOI2 = os.environ.get('SRC_VOICES2', '/home/claude/voices2')
VID = os.environ.get('SRC_VID', '/home/claude/vid')
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
MEDIA = os.path.join(ROOT, 'media')
NO_MEDIA = '--no-media' in sys.argv

SAN = [(r'\bJosefov', 'Pepov'), (r'\bJosefův\b', 'Pepův'), (r'\bJosefa\b', 'Pepy'), (r'\bJosefem\b', 'Pepou'),
       (r'\bJosefovi\b', 'Pepovi'), (r'\bJosef\b', 'Pepa'), (r'Zdeněk Třešňák', 'Zdeněk T.'), (r'Třešňák\w*', 'T.'),
       (r'Kubás\w*', 'K.'), (r'Pavlovi[cč]\w*', ''), (r'Wu Lej', 'Wu Long')]
FORBID = re.compile(r'Granan|Silverkin|Schamedar|povídk|@|https?://', re.I)


def san(s):
    if isinstance(s, str):
        for a, b in SAN:
            s = re.sub(a, b, s)
        return s
    if isinstance(s, list):
        return [san(x) for x in s]
    if isinstance(s, dict):
        return {k: san(v) for k, v in s.items()}
    return s


def load(p):
    return json.load(open(p, encoding='utf-8'))


def slug(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def ym(s):
    """'8–12/2011' → (2011.58, 2011.99); '2007–2008' → (2007.0, 2008.99); '2011-06-21' → bod"""
    s = (s or '').replace('–', '-').replace(' ', '')
    m = re.match(r'^(\d{4})-(\d{2})(?:-(\d{2}))?$', s) or re.match(r'^(\d{4})-(\d{2})-(\d{2})', s)
    if m:
        v = int(m.group(1)) + (int(m.group(2)) - 1) / 12 + (int(m.group(3) or 1) - 1) / 372
        return v, v + 0.01
    parts = s.split('-')
    def one(p, end):
        m = re.match(r'^(?:(\d{1,2})/)?(\d{4})$', p)
        if m:
            y = int(m.group(2)); mo = m.group(1)
            if mo:
                return y + (int(mo) - 1) / 12 + (1 / 12 - 0.001 if end else 0)
            return y + (0.999 if end else 0)
        m = re.match(r'^(\d{1,2})$', p)
        return None
    if len(parts) == 1:
        return one(parts[0], False), one(parts[0], True)
    a, b = parts[0], parts[-1]
    if re.match(r'^\d{1,2}$', a) and '/' in b:          # 8-12/2011
        y = int(b.split('/')[1]); return y + (int(a) - 1) / 12, one(b, True)
    lo, hi = one(a, False), one(b, True)
    return lo, hi


# ---------------------------------------------------------------- načtení
MAP = load(WORK + '/map.json')
WORLD = load(WORK + '/world.json')
SES = []
for i in (1, 2, 3):
    SES += load(f'{WORK}/sessions_{i}.json')
WMAP = load(WEB + '/data/map.json')
WSES = {s['id']: s for s in load(WEB + '/data/sessions.json')}
WWORLD = load(WEB + '/data/world.json')
WNPC = load(WEB + '/data/npcs.json')
BOOKS = load(WEB + '/data/books.json')
CHARS = load(WEB + '/data/characters.json')
WIT = load(VOI + '/svedectvi_v2.json')
TIMING = load(VOI2 + '/timing.json') if os.path.exists(VOI2 + '/timing.json') else {}
SESS = {s['id']: s for s in SES}
for sid, s in WSES.items():              # zpracovaná verze má malby a hráče
    SESS.setdefault(sid, s)
    SESS[sid] = {**SESS[sid], 'ilu': s.get('ilu', []), 'players': s.get('players', []), 'minor': s.get('minor', False)}
wplace = {p['name']: p for p in WMAP['places'] + WMAP['off']}
for s in SESS.values():
    s['_k'] = ym(s.get('date'))[0] or 0
SES = sorted(SESS.values(), key=lambda s: s['_k'])

# ---------------------------------------------------------------- obrázky
IMGDIR = WEB + '/img/'
USED_IMG = {}


def img(key, want=640):
    """'ilu/K_003' → relativní cesta v media/; vybere nejmenší šířku >= want"""
    if not key:
        return None
    d, n = key.split('/', 1)
    folder = IMGDIR + d
    if not os.path.isdir(folder):
        return None
    cands = []
    for f in os.listdir(folder):
        m = re.match(re.escape(n) + r'-(\d+)\.webp$', f)
        if m:
            cands.append((int(m.group(1)), f))
    if not cands:
        return None
    cands.sort()
    pick = next((c for c in cands if c[0] >= want), cands[-1])
    rel = f'media/{d}/{pick[1]}'
    USED_IMG[rel] = os.path.join(folder, pick[1])
    return rel


# ---------------------------------------------------------------- modely a vzhled míst (ručně podle povahy místa)
MODEL = {
    'Castle Tethyr': ('castle', 'town', 1.5), 'Ithmong': ('town', 'town', 1), 'Nelanther': ('ship', 'port', 1),
    'Velen': ('lighthouse', 'port', 1), 'Klášter Subotami': ('temple', None, 1), 'Kozakura': ('pagoda', 'shou', 1.2),
    'Malatra': ('oak', None, 1), 'Opuštěný laoneyský klášter': ('cragmaw', None, 0.9), "Kuo Te' Lung": ('pagoda', 'shou', 1.5),
    "T'u Lung": ('pagoda', 'shou', 1.1), 'Tuiganské hlavní město': ('reghed', None, 1.2), 'Khazari': ('town', 'town', 0.9),
    'Balanzie': ('town', 'town', 0.9), 'Port': ('pagoda', 'port', 1), 'Wu Pi Te Shao': ('tooth', None, 1),
    'Ohňové hory': ('crater', None, 1.2), 'Údolí': ('elfhouse', 'elf', 1), 'Tyrův chrám v Tethyru': ('cathedral', None, 0.9),
    'Moonshae': ('circle', None, 1), 'Helmsport': ('citytower', 'port', 1), 'Nexal': ('pyramid', None, 1.2),
    'Stříbroluní': ('elftower', 'elf', 1.3), 'Vysoký les': ('oak', None, 1.4), 'Proskur': ('town', 'town', 0.9),
    'Labyrint Maxe Fredinia': ('bubble', None, 1), 'Sothasil': ('bubble', None, 1.3), 'Tvář vědění': ('tooth', None, 1.3),
    'Tempat Larang': ('pagoda', 'monastery', 1.2), 'Chrám Západního úsvitu': ('pagoda', 'shou', 1.4), 'Dračí let': ('manor', None, 1.1),
    'Pevnost Rudé rytířky': ('castle', None, 1.4), 'Knihovna Arenkae': ('tower', None, 1), 'Trpasličí doly pod Rudou pevností': ('mine', None, 0.9),
    'Wolfburg': ('citytower', 'town', 1), 'Ascore': ('xinlenal', None, 1.2), 'Khôltar': ('town', 'town', 1.1),
    'Chult': ('oak', None, 1.2), 'Chondalský les': ('oak', None, 1.1), 'Reghedský ledovec': ('icecave', None, 1.1),
    'Zakhara': ('tent', None, 1), 'Moře padlých hvězd': ('ship', None, 1.2), 'Evermeet': ('elftower', 'elf', 1.2),
    'Podtemno': ('mine', 'under', 1), 'Shoonach': ('cragmaw', None, 1.1), 'Mechový kámen': ('house', None, 0.8),
    'Semberholm': ('elfhouse', None, 0.9), 'Halruaa': ('wizard', 'elf', 1.2), 'Anauroch': (None, None, 1),
    'Sundabar': ('citygate', 'town', 1.1), 'Dungeon s remorhazem': ('remorhaz', None, 1), 'Základna Nest': ('gobcamp', None, 1),
    'Sossal': ('tent', None, 1), 'Turmish': ('town', 'town', 1.1), 'Ironfang Deep': ('mine', None, 1),
    'Velká trhlina': ('crater', None, 2.4), 'Mount Talath': ('temple', None, 1), 'Cham Fau': ('pagoda', 'shou', 1.2),
    'Mořské věže': ('lighthouse', None, 1.2), 'Dashadjen': ('tooth', None, 1), 'Hlubina': ('citytower', 'city', 1.5),
    'Oryndoll': ('cragmaw', 'under', 1), 'Anchorome': ('oak', None, 1), 'Selûnarra': ('xinlenal', None, 1.1),
    'Orofin': (None, None, 1), 'Temné jezero': (None, None, 1), 'Thultanthar': ('thultanthar', None, 1),
}
SPHERE_ICON = {'Sigil': 'sigil', 'Chronosova říše': 'hourglass', 'Feng Asay': 'orb', 'Krynn': 'moons', 'Ravenloft': 'castle',
               'Arborea': 'oak', 'World Serpent Inn': 'inn', 'Shadowfell': 'shadow', 'Avernus': 'crater', 'Chronosova pyramida': 'pyramid'}
# souřadnice bitev na podkladu (místa z dat; u bitev z pozadí světa podle popisu místa)
BATTLE_XY = {
    'Bitva kostí': (425, 122), 'Válka s tuiganskou hordou': (1000, 190), 'Obrana Evermeetu': (14, 262),
    'Bitva o Tvář vědění': (410, 160), 'Ústup z Cormanthoru': (640, 172), 'Bitva o Rudou pevnost': (185, 10),
    'Bitva o tethyrské državy': (288, 512), 'Námořní střety na Moři padlých hvězd': (835, 265), 'Pád Sundabaru': (352, 55),
    'Jezero páry a Kraken': (560, 602), 'Bitva u Velké trhliny': (962, 640), 'Bitva v Anaurochu': (505, 153),
    'Útok na Thultanthar': (508, 138), 'Poslední souboj na Pyramidě času': None,
}
BATTLE_PLACE = {'Bitva o Tvář vědění': 'Tvář vědění', 'Bitva o Rudou pevnost': 'Pevnost Rudé rytířky', 'Bitva o tethyrské državy': 'Wolfburg',
                'Námořní střety na Moři padlých hvězd': 'Moře padlých hvězd', 'Pád Sundabaru': 'Sundabar', 'Bitva u Velké trhliny': 'Velká trhlina',
                'Bitva v Anaurochu': 'Orofin', 'Útok na Thultanthar': 'Thultanthar', 'Poslední souboj na Pyramidě času': 'Chronosova pyramida',
                'Obrana Evermeetu': 'Evermeet'}
# svědci: odkud jsou (domovské místo); pár jich je doma mimo místa kampaně
WIT_PLACE = {
    'seung-mina': 'Chrám Západního úsvitu', 'kenshi': 'Chrám Západního úsvitu', 'hasagi': 'Chrám Západního úsvitu', 'honda': 'Chrám Západního úsvitu',
    'turfin': 'Údolí', 'isis': 'Evermeet', 'seltar': 'Thultanthar', 'gareth': 'Orofin', 'kung-lao': 'Tempat Larang', 'chuang-li': 'Tempat Larang',
    'mitsurugy': 'Kozakura', 'finian': 'Castle Tethyr', 'jenova': 'Dračí let', 'agathon': 'Mount Talath', 'arwin': 'Mořské věže',
    'asaman': 'Klášter Subotami', 'zako': "Kuo Te' Lung", 'betridal': 'Halruaa', 'ruda-rytirka': 'Pevnost Rudé rytířky', 'gatrya': 'Turmish',
    'iryklathagra': 'Dashadjen', 'thalaxia': 'Ithmong', 'yamun-ii': 'Tuiganské hlavní město', 'yamoh-hokhra': 'Tuiganské hlavní město',
    'axel-adamantis': 'Tvář vědění', 'devrel': 'Zakhara', 'rivalen': 'Thultanthar', 'sar-saratar': 'Temné jezero', 'elminster': 'Údolí',
    'khelben': 'Hlubina', 'alustriel': 'Stříbroluní', 'simbul': ('Aglarond', 965, 300), 'alusair': ('Cormyr', 560, 266),
}

# ---------------------------------------------------------------- georeference: oprava souřadnic proti podkladu
# V map.json je tethyrský shluk posunutý asi o 100 px do moře; Castle Tethyr dostává polohu tečky „Castle Tethyr“ na podkladu.
FIX = {'Castle Tethyr': (365, 568), 'Ithmong': (445, 575), 'Tyrův chrám v Tethyru': (382, 586)}
SEA_OK = {'Moře padlých hvězd', 'Labyrint Maxe Fredinia', 'Sothasil', 'Nelanther', 'Moonshae'}
from PIL import Image as _I
_sea = _I.open(os.path.join(ROOT, 'assets', 'terrain', 'sea.png')).convert('L'); _sw, _sh = _sea.size; _sp = _sea.load()
def is_sea(x, z):
    return _sp[min(_sw - 1, max(0, int(x / 2))), min(_sh - 1, max(0, int(z / 2)))] > 127
def snap(name, x, z):
    if name in FIX:
        return FIX[name][0], FIX[name][1], True
    if name in SEA_OK or x <= 20 or z >= 860 or not is_sea(x, z):
        return x, z, False
    for r in range(2, 60, 2):
        for k in range(24):
            import math
            a = k / 24 * 6.2832; px, pz = x + math.cos(a) * r, z + math.sin(a) * r
            if not is_sea(px, pz) and not is_sea(px + math.cos(a) * 3, pz + math.sin(a) * 3):
                return round(px), round(pz), True
    return x, z, False
FIXED = []

# ---------------------------------------------------------------- místa
places, pid = [], {}
word = lambda n: re.compile(r'(?<![\wÀ-ž])' + re.escape(n) + r'(?![\wÀ-ž])')


def sessions_for(name, visits):
    ws = list(wplace.get(name, {}).get('sessions', []))
    rx = word(name)
    for s in SES:
        if rx.search(s.get('title', '')):
            ws.append(s['id'])
    for v in visits:
        lo, hi = ym(v.get('real'))
        if lo is None:
            continue
        for s in SES:
            if lo - 0.01 <= s['_k'] <= hi + 0.01 and (rx.search(s.get('summary', '')) or rx.search(s.get('title', ''))):
                ws.append(s['id'])
    out = [x for x in dict.fromkeys(ws) if x in SESS]
    return sorted(out, key=lambda x: SESS[x]['_k'])


def npcs_for(name):
    idx = wplace.get(name, {}).get('npcs', [])
    out = []
    for i in idx[:60]:
        if 0 <= i < len(WNPC):
            n = WNPC[i]
            out.append({'n': n['name'], 'w': n.get('who', ''), 'k': n.get('kind', '')})
    return out


for p in MAP['places']:
    m = MODEL.get(p['name'], (None, None, 1))
    o = {'id': slug(p['name']), 'name': p['name'], 'region': p['region'], 'kind': p['kind'], 'desc': p['desc'],
         'x': snap(p['name'], p['x'], p['y'])[0], 'z': snap(p['name'], p['x'], p['y'])[1], 'approx': p.get('approx', False), 'visits': p['visits'],
         'sessions': sessions_for(p['name'], p['visits']), 'npcs': npcs_for(p['name']),
         'model': m[0], 'deco': m[1], 'scale': m[2], 'battles': [], 'wit': []}
    if snap(p['name'], p['x'], p['y'])[2]:
        o['moved'] = [p['x'], p['y']]; FIXED.append(f"{p['name']}: {p['x']},{p['y']} → {o['x']},{o['z']}")
    places.append(o); pid[p['name']] = o
spheres = []
for p in MAP['off']:
    o = {'id': slug(p['name']), 'name': p['name'], 'region': p['region'], 'kind': p['kind'], 'desc': p['desc'], 'visits': p['visits'],
         'sessions': sessions_for(p['name'], p['visits']), 'npcs': npcs_for(p['name']), 'icon': SPHERE_ICON.get(p['name'], 'orb'),
         'sphere': True, 'battles': [], 'wit': []}
    spheres.append(o); pid[p['name']] = o

# ---------------------------------------------------------------- trasa (místa na mapě + vložené cesty do sfér)
route = []
for r in MAP['route']:
    route.append({'p': pid[r['place']]['id'], 'real': r['real'], 'dr': r['dr'], 'what': r['what'], 'era': r['era'], 'walk': r.get('walk', False)})
for sp in spheres:
    for v in sp['visits']:
        lo = ym(v['real'])[0] or 0
        ins = len(route)
        for i, r in enumerate(route):
            if r['era'] == v['era'] or True:
                rl = ym(r['real'])[0] or 0
                if rl <= lo:
                    ins = i + 1
        route.insert(ins, {'p': sp['id'], 'real': v['real'], 'dr': v['dr'], 'what': v['what'], 'era': v['era'], 'walk': False, 'sphere': True})
byid = {o['id']: o for o in places + spheres}
for r in route:
    o = byid[r['p']]
    lo, hi = ym(r['real'])
    ss = [s for s in o['sessions'] if lo is not None and lo - 0.05 <= SESS[s]['_k'] <= hi + 0.05]
    if not ss and lo is not None:      # sezení ze stejné doby, která místo nebo jeho kraj zmiňují v názvu
        keys = [o['name']] + ([o['region']] if o.get('region') and o['region'] not in ('sféry', 'Faerûn', 'Jih', 'Sever') else [])
        ss = [s['id'] for s in SES if lo - 0.05 <= s['_k'] <= hi + 0.05 and any(word(k).search(s.get('title', '')) for k in keys)]
        if ss:
            r['f'] = 1                   # jen sezení ze stejné doby a kraje, ne přímo z místa
    if not ss and o['sessions'] and lo is not None:
        near = min(o['sessions'], key=lambda s: abs(SESS[s]['_k'] - lo))
        if abs(SESS[near]['_k'] - lo) < 0.6:
            ss = [near]
    r['s'] = ss[:6]
    r['k'] = round(lo or 0, 3)
    if not r.get('f'):
        o['sessions'] = sorted(set(o['sessions']) | set(ss), key=lambda x: SESS[x]['_k'])

# ---------------------------------------------------------------- bitvy
battles = []
for b in WWORLD['battles']:
    xy = BATTLE_XY.get(b['name'])
    era = None
    s = SESS.get(b.get('session') or '')
    if s:
        era = s.get('era')
    o = {'id': b['id'], 'name': b['name'], 'dr': b['dr'], 'real': b.get('real_label', ''), 'place': b['place'], 'summary': b['summary'],
         'outcome': b.get('outcome', ''), 'sides': b['sides'], 'session': b.get('session'), 'era': era,
         'bg': b.get('real_label') == 'pozadí světa',
         'img': [{'src': img('ilu/' + f, 640), 'cap': (b.get('captions') or [''] * 9)[i] if i < len(b.get('captions') or []) else ''} for i, f in enumerate(b.get('images') or [])]}
    if xy:
        o['x'], o['z'] = xy
    pl = BATTLE_PLACE.get(b['name'])
    if pl and pl in pid:
        o['pl'] = pid[pl]['id']; pid[pl]['battles'].append(b['id'])
    battles.append(o)

# ---------------------------------------------------------------- svědectví
wits = []
for w in WIT:
    home = WIT_PLACE.get(w['id'])
    o = {'id': w['id'], 'name': w['jmeno'], 'role': w['role'], 'side': w['strana'], 'bond': w.get('vazba', ''), 'text': w['text'],
         't': TIMING.get(w['id'], {}).get('starts'), 'dur': TIMING.get(w['id'], {}).get('duration')}
    if isinstance(home, tuple):
        o['home'] = home[0]; o['x'], o['z'] = home[1], home[2]
    elif home in pid:
        P = pid[home]; o['pl'] = P['id']; o['home'] = home
        if not P.get('sphere'):
            o['x'], o['z'] = P['x'], P['z']
        P['wit'].append(w['id'])
    o['vid'] = f'media/vid/{w["id"]}.mp4' if os.path.exists(f'{VID}/{w["id"]}.mp4') else None
    o['poster'] = f'media/vid/{w["id"]}.jpg' if os.path.exists(f'{VID}/{w["id"]}.jpg') else None
    o['audio'] = f'media/voices/{w["id"]}.mp3' if os.path.exists(f'{VOI2}/{w["id"]}.mp3') else None
    wits.append(o)

# ---------------------------------------------------------------- sezení (jen použitá) s malbami
used = set()
for o in places + spheres:
    used.update(o['sessions'])
for r in route:
    used.update(r['s'])
for b in battles:
    if b.get('session'):
        used.add(b['session'])
sessions = {}
for sid in sorted(used, key=lambda x: SESS[x]['_k']):
    s = SESS[sid]
    sessions[sid] = {'d': s.get('date_label') or s.get('date'), 'dr': s.get('dr_label') or (f"{s['dr']} DR" if s.get('dr') else ''),
                     'era': s.get('era'), 't': s.get('title', ''), 's': s.get('summary', ''), 'pl': s.get('players', []),
                     'ch': s.get('characters', []), 'hl': s.get('highlights', []),
                     'img': [{'src': img('ilu/' + i['f'], 640), 'cap': i.get('cap', '')} for i in s.get('ilu', [])][:3]}
    sessions[sid]['img'] = [i for i in sessions[sid]['img'] if i['src']]

# ---------------------------------------------------------------- knihy a družina
ERA_COL = {'I': '#c9a54a', 'II': '#d0573f', 'III': '#7fa37a', 'IV': '#6f9ccf', 'V': '#d7c49a', 'epilog': '#eadfc6'}
MOOD = {'I': 'dawn', 'II': 'frost', 'III': 'day', 'IV': 'storm', 'V': 'shadow', 'epilog': 'dusk'}
eras = []
for b in BOOKS:
    eras.append({'key': b['key'], 'kap': b['kap'], 'title': b['title'], 'real': b['real'], 'dr': b['dr'], 'col': ERA_COL[b['key']],
                 'mood': MOOD[b['key']], 'summary': b['summary'][:600]})
eras.append({'key': 'epilog', 'kap': 'Epilog', 'title': 'Epilog', 'real': '2026', 'dr': '1385–1400 DR', 'col': ERA_COL['epilog'], 'mood': 'dusk', 'summary': ''})
party = []
for c in CHARS:
    if c.get('kind') != 'hrac':
        continue
    pr = c.get('portrait') or {}
    party.append({'id': c['id'], 'name': c['name'], 'player': (c.get('player') or '').replace(', Pán jeskyně', ' (Pán jeskyně)'),
                  'race': c.get('race'), 'cls': c.get('class'), 'when': c.get('active_real'), 'img': img(pr.get('src'), 400) if pr else None})

out = san({'meta': {'title': 'Faerûn – 3D mapa Západních draků', 'src': 'toril-east-west.jpg', 'size': WMAP.get('size', [2576, 884]),
                    'milesPerUnit': 2.6, 'built': True},
           'eras': eras, 'places': places, 'spheres': spheres, 'route': route, 'battles': battles, 'witnesses': wits,
           'sessions': sessions, 'party': party})
print('opravené polohy:', *FIXED, sep='\n  ')
txt = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
bad = FORBID.findall(txt)
if bad:
    print('!! zakázaný obsah', set(bad))
os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
open(os.path.join(ROOT, 'data', 'campaign.json'), 'w', encoding='utf-8').write(txt)
print('campaign.json', len(txt) // 1024, 'kB;', len(places), 'míst,', len(spheres), 'sfér,', len(route), 'zastávek,', len(battles), 'bitev,',
      len(wits), 'svědků,', len(sessions), 'sezení,', len(USED_IMG), 'obrázků')

# ---------------------------------------------------------------- média
if NO_MEDIA:
    sys.exit()
for rel, src in USED_IMG.items():
    dst = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
        shutil.copy2(src, dst)
os.makedirs(MEDIA + '/vid', exist_ok=True); os.makedirs(MEDIA + '/voices', exist_ok=True)
for w in wits:
    i = w['id']
    if w['vid']:
        dst = f'{MEDIA}/vid/{i}.mp4'
        if not os.path.exists(dst):   # živý portrét: 640×360, bez zvuku, smyčka
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{VID}/{i}.mp4', '-vf', 'scale=640:-2', '-an', '-c:v', 'libx264',
                            '-crf', '27', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst], check=True)
    if w['poster']:
        dst = f'{MEDIA}/vid/{i}.jpg'
        if not os.path.exists(dst):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{VID}/{i}.jpg', '-vf', 'scale=480:-2', '-q:v', '4', dst], check=True)
    if w['audio']:
        dst = f'{MEDIA}/voices/{i}.mp3'
        if not os.path.exists(dst):   # řeč: mono 64 kb/s stačí
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{VOI2}/{i}.mp3', '-ac', '1', '-b:a', '64k', dst], check=True)
print('média hotová')

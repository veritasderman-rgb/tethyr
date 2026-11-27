#!/usr/bin/env python3
"""Vyrobí data webu (public/data/*.json) a obrázky WebP (public/img/...) ze zdrojů kroniky.

Spuštění:  python3 scripts/build-data.py            (data + chybějící obrázky)
           python3 scripts/build-data.py --no-img   (jen data)
           python3 scripts/build-data.py --force    (přegenerovat všechny obrázky)

Zdroje se jen čtou. Cesty ke zdrojům lze přepsat proměnnými prostředí SRC_WORK a SRC_BUILD.
"""
import ast, datetime, glob, json, os, re, sys, unicodedata
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import vypraveni as VYPR  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORK = os.environ.get('SRC_WORK', '/home/claude/work')
BUILD = os.environ.get('SRC_BUILD', '/home/claude/build')
PORT = os.environ.get('SRC_PORT', '/home/claude/port')
OSA = os.environ.get('SRC_OSA', '/home/claude/osa')
D = WORK + '/web/data/'
OUT = ROOT + '/public/data/'
IMG = ROOT + '/public/img/'
ARGS = set(sys.argv[1:])
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- čištění textu
# Hráči jen křestním jménem (Pepa, Zdeněk K., Zdeněk T., …), žádné zakázané odkazy.
SAN = [
    (r'\bJosefov', 'Pepov'), (r'\bJosefův\b', 'Pepův'), (r'\bJosefa\b', 'Pepy'), (r'\bJosefem\b', 'Pepou'),
    (r'\bJosefovi\b', 'Pepovi'), (r'\bJosef\b', 'Pepa'),
    (r'Zdeňkem Třešňákem', 'Zdeňkem T.'), (r'Zdeňka Třešňáka', 'Zdeňka T.'), (r'Zdeňku Třešňákovi', 'Zdeňku T.'),
    (r'Zdeněk Třešňák', 'Zdeněk T.'), (r'Třešňák\w*', 'T.'), (r'Kubás\w*', 'K.'), (r'Pavlovi[cč]\w*', ''),
    (r'Wu Lej', 'Wu Long'),
]
FORBID = re.compile(r'Granan|Silverkin|Schamedar|povídk|@|https?://', re.I)


def san(s):
    if not isinstance(s, str):
        return s
    for a, b in SAN:
        s = re.sub(a, b, s)
    return s


def clean(o):
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, list):
        return [clean(v) for v in o]
    return san(o)


def slug(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn')


def load(p):
    return json.load(open(p, encoding='utf-8'))


def dump(name, obj):
    txt = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    bad = FORBID.findall(txt)
    if bad:
        print('!! zakázaný obsah v', name, set(bad))
    open(OUT + name, 'w', encoding='utf-8').write(txt)
    print(f'  {name:22s} {len(txt) // 1024:5d} kB')


# ---------------------------------------------------------------- zdroje
S = []
for f in ['sessions_1', 'sessions_2', 'sessions_3']:
    S += load(D + f + '.json')
S = clean(S)
C = clean(load(D + 'characters.json'))
N = clean(load(D + 'npcs.json'))
WD = clean(load(D + 'world.json'))
MP = clean(load(D + 'map.json'))
import upresneni  # noqa: E402  upřesnění autora (přednost před daty kroniky)
S, C, WD, MP, N = upresneni.apply_all(S, C, WD, MP, N)
GAL = clean(load(BUILD + '/nove/gallery.json'))
FI = load(BUILD + '/foto/index.json')
MAN = []
for f in sorted(glob.glob(BUILD + '/ilu2/manifest_*.json')):
    MAN += [m for m in load(f) if m.get('ok', True) and os.path.exists(BUILD + '/ilu2/' + m['file'])]
seen = set(); MAN = [m for m in MAN if not (m['file'] in seen or seen.add(m['file']))]
MAN = clean(MAN)


def pdate(s):
    s = (s or '').strip()
    m = re.match(r'(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?', s)
    if not m:
        return None
    y, mo, d = int(m.group(1)), int(m.group(2) or 1), int(m.group(3) or 1)
    try:
        return datetime.date(y, mo, d)
    except ValueError:
        return datetime.date(y, mo, 1)


def sdate(s):
    return pdate(s.get('date')) or datetime.date(2003, 1, 1)


S.sort(key=lambda s: (sdate(s), s['id']))

# ---------------------------------------------------------------- knihy a kapitoly (stejně jako tištěná kronika)
ERA = {
    'I': ('Kniha první', 'První tažení', '2003–2011', '1372–1377 DR'),
    'II': ('Kniha druhá', 'Rudá pevnost a návraty', 'prosinec 2011–2015', '1383 DR'),
    'III': ('Kniha třetí', 'Nová krev, Shoonach, Halruaa', '2016–2018', '1383–1384 DR'),
    'IV': ('Kniha čtvrtá', 'Západní draci a Velká trhlina', '2019–2022', '1384 DR'),
    'V': ('Kniha pátá', 'Poslední tažení', '2023–2026', '1384–1385 DR'),
}
CHN = ast.literal_eval(open(BUILD + '/kniha.py', encoding='utf-8').read().split('CHN=', 1)[1].split('\n', 1)[0])
CHN.pop('s-2026-03-28', None); CHN['s-2026-05-02'] = 'Thultanthar a Pyramida času'  # v knize začíná kapitola akcí Maduro, na webu až Do pekla a nazpátek
GAME = {'hlavni': '', 'lovci': 'Sigilští lovci', 'solo': 'Hra ve dvou', 'priprava': 'Příprava', 'druha': 'Druhá hra'}
MINOR = {'s-2007-02-09', 's-2007-06-29', 's-2007-07-25', 's-2014-05-22', 's-2014-07-05', 's-2019-12-30', 's-2020-01-11',
         's-2020-04-26', 's-2020-05-29', 's-2020-12-18', 's-2021-06-19', 's-2026-01-10'}
CAMP = {c['key']: c for c in WD['campaigns']}
VYP = clean(VYPR.parse(ROOT + '/data/vypraveni'))  # ručně psané vyprávění ke kapitolám (data/vypraveni/*.md)

# hráči podle postav
PLAYER = {}
for c in C:
    if c.get('player'):
        for nm in {c['name'], c['name'].split()[0], c['id']}:
            PLAYER[norm(nm)] = c['player'].replace(', Pán jeskyně', '')
PLAYER['calla'] = 'Jana'

# ---------------------------------------------------------------- obrázky: seznam k převodu
JOBS = []  # (src, dst_base, widths, quality)


def job(src, dst, widths, q=74):
    JOBS.append((src, dst, tuple(widths), q))
    return dst


def ilu(file, w=(640, 1280)):
    return job(BUILD + '/ilu2/' + file, 'ilu/' + file.rsplit('.', 1)[0], w, 68)


ILU_DONE = set()


def ilu_need(f):
    """Převede malbu z ilu2 (jen jednou). D_ = svislé předěly, ostatní 1280×720."""
    f = f if f.endswith('.jpg') else f + '.jpg'
    if f in ILU_DONE or not os.path.exists(BUILD + '/ilu2/' + f): return
    ILU_DONE.add(f)
    ilu(f, (720, 1360) if f.startswith('D_') else (640, 1280))


for m in MAN:
    if m['file'][0] in 'DKP': ilu_need(m['file'])
for g in GAL:
    p = BUILD + '/nove/n%02d.jpg' % g['n']
    if os.path.exists(p):
        job(p, 'nove/n%02d' % g['n'], (480, 1200), 68)
FOTO = sorted(int(os.path.basename(p)[:-4]) for p in glob.glob(BUILD + '/foto/*.jpg'))
for n in FOTO:
    job(BUILD + '/foto/%03d.jpg' % n, 'foto/%03d' % n, (480, 1280), 60)  # iterace 10: q60 kvůli limitu repa
PORTS = sorted(os.path.basename(p)[:-4] for p in glob.glob(PORT + '/*.png'))
for k in PORTS:
    job(PORT + '/' + k + '.png', 'port/' + k, (480, 1280), 78)
job(D + 'toril-east-west.jpg', 'map/toril', (2576,), 82)
job(OSA + '/osa_full.png', 'osa/osa_full', (900, 1800, 2480), 80)
job(BUILD + '/img/znak_chramu.svg', 'misc/znak', ())

# ---------------------------------------------------------------- fotky ke sezením (podle data pořízení)
PH = {}
for n, x in FI.items():
    d = x['dt'][:10].replace(':', '-')
    PH.setdefault(d, []).append(int(n))
used = set()


def photos_for(s):
    a = pdate(s['date']) if re.match(r'\d{4}-\d{2}-\d{2}', s['date'] or '') else None
    if not a:
        return []
    b = pdate(s.get('date_end')) if re.match(r'\d{4}-\d{2}-\d{2}', s.get('date_end') or '') else a
    out = []
    for d, ns in PH.items():
        dd = pdate(d)
        if a - datetime.timedelta(days=1) <= dd <= b + datetime.timedelta(days=1):
            out += [n for n in sorted(ns) if n not in used and os.path.exists(BUILD + '/foto/%03d.jpg' % n)]
    used.update(out)
    return out


# ---------------------------------------------------------------- bitvy
BATTLES = []
for b in WD['battles']:
    b = dict(b); b['id'] = 'b-' + slug(b['name'])
    lab = b.get('real_label') or ''
    ds = re.findall(r'(\d+)\.\s*(\d+)\.\s*(\d{4})', lab); ys = re.findall(r'(\d{4})', lab)
    zc = re.search(r'začátek (\d{4})', lab)
    end = None
    if zc: end = datetime.date(int(zc.group(1)), 3, 31)
    elif ds: end = datetime.date(int(ds[-1][2]), int(ds[-1][1]), int(ds[-1][0]))
    elif ys: end = datetime.date(int(ys[-1]), 12, 31)
    b['session'] = None
    if end:
        cand = [s for s in S if sdate(s) <= end]
        if cand: b['session'] = max(cand, key=sdate)['id']
    b['images'] = [m['file'][:-4] for m in MAN if m.get('target') == 'bitvy' and m.get('battle') == b['name']]
    b['captions'] = [m.get('caption', '') for m in MAN if m.get('target') == 'bitvy' and m.get('battle') == b['name']]
    BATTLES.append(b)
BAT_BY_SES = {}
for b in BATTLES:
    if b['session']: BAT_BY_SES.setdefault(b['session'], []).append(b['id'])

# ---------------------------------------------------------------- sezení
GBYS = {}
for g in GAL:
    if g.get('session'): GBYS.setdefault(g['session'], []).append(g)
sessions = []
for s in S:
    o = {k: s.get(k) for k in ['id', 'date', 'date_end', 'date_label', 'era', 'game', 'title', 'region', 'dr', 'dr_label',
                               'where_played', 'characters', 'summary', 'npcs', 'highlights', 'lore']}
    o['game_label'] = GAME.get(s['game'], '')
    o['players'] = list(dict.fromkeys(PLAYER.get(norm(c), PLAYER.get(norm(c.split()[0]), '')) for c in s['characters']))
    o['players'] = [p for p in o['players'] if p]
    o['cast'] = [[c, PLAYER.get(norm(c), PLAYER.get(norm(c.split()[0]), ''))] for c in s['characters']]
    o['ilu'] = [{'f': m['file'][:-4], 'cap': m.get('caption', '')} for m in MAN if m.get('target') == 'kronika' and m.get('session') == s['id']]
    o['gal'] = [{'n': g['n'], 'cap': g.get('caption', ''), 'w': g['w'], 'h': g['h']} for g in GBYS.get(s['id'], [])]
    o['photos'] = photos_for(s)
    o['battles'] = BAT_BY_SES.get(s['id'], [])
    o['minor'] = s['id'] in MINOR
    o['year'] = sdate(s).year
    sessions.append({k: v for k, v in o.items() if v not in (None, [], '')} | {'id': s['id']})

# kapitoly v rámci knih
# úsek trasy družiny (indexy do map.json route) pro mapku u každé kapitoly a pro střih v režimu dokument
CH_ROUTE = {
    'ch-z-tethyru-na-vychod': [0, 1, 2, 3, 4, 5, 6], 'ch-shou-lung-a-velke-tazeni': [7, 8, 9, 10, 11, 12, 13, 14, 15],
    'ch-navrat-tyruv-chram-a-sigil': [21, 17, 22, 16, 18, 19, 20], 'ch-stity-apokalypsy': [23, 24, 25, 26, 27, 28, 29],
    'ch-feng-asay-a-tempat-larang': [30, 31, 32], 'ch-draci-let-a-knihovna-arenkae': [33, 34, 35, 36],
    'ch-pod-rudou-pevnosti': [36, 37, 38], 'ch-bitva-o-rudou-pevnost': [38, 39], 'ch-navrat-domu-a-houv-prestup': [40, 41, 44, 45, 43],
    'ch-kholtar-chult-a-hoova-mala': [43, 46, 47, 48], 'ch-sever-lod-a-zakhara': [49, 42, 50], 'ch-lovci-a-zachrana-ze-zakhary': [40, 51],
    'ch-nova-krev-a-more-padlych-hvezd': [53, 54, 55], 'ch-namorni-tazeni': [56], 'ch-tethyr-v-novem-slozeni': [41, 57],
    'ch-runovladci-a-shoonach': [52, 58, 60, 61], 'ch-shoonach-finale': [58, 59], 'ch-severska-druzina': [60, 62], 'ch-halruaa': [59, 63],
    'ch-anauroch-zaver-druhe-hry': [60, 65, 64], 'ch-spojeni-druzin-a-odlet': [66], 'ch-prvni-dungeony-a-arborea': [66, 67, 68, 69],
    'ch-cesta-zapadnich-draku': [71], 'ch-lovci-v-turmishi': [70], 'ch-tovarna-temnych-a-deepgate': [70, 73], 'ch-velka-trhlina': [74, 72],
    'ch-mount-talath-zacatek-konce': [75, 76, 77], 'ch-cham-fau-a-navrat-na-faerun': [78, 79],
    'ch-morske-veze-draci-a-illithide': [79, 82, 83, 84, 81], 'ch-selunarra-a-vyklad-proroctvi': [80, 85], 'ch-vycvik-a-velka-rada': [86],
    'ch-anauroch': [86, 88], 'ch-thultanthar-a-pyramida-casu': [88, 89, 90], 'ch-epilog': [91, 92],
}
books = []
for k, (kap, tit, real, dr) in ERA.items():
    ss = [s for s in sessions if s['era'] == k]
    chapters = []
    # epilog stojí v páté knize zvlášť, na konci
    main = [s for s in ss if s['id'] != 's-2026-09-05-epilog']
    for s in main:
        if s['id'] in CHN or not chapters:
            chapters.append({'title': CHN.get(s['id'], s.get('region', '')).replace('Arenkai', 'Arenkae'), 'sessions': []})
        chapters[-1]['sessions'].append(s['id'])
    if k == 'V':
        chapters.append({'title': 'Epilog: budoucnosti', 'sessions': ['s-2026-09-05-epilog'], 'id': 'ch-epilog'})
    for ch in chapters:
        grp = [s for s in ss if s['id'] in ch['sessions']]
        yrs = sorted({s['year'] for s in grp}); drs = sorted({s['dr'] for s in grp if s.get('dr')})
        ch['real'] = f'{yrs[0]}–{yrs[-1]}' if yrs[0] != yrs[-1] else str(yrs[0])
        ch['drs'] = (f'{drs[0]}–{drs[-1]}' if drs[0] != drs[-1] else str(drs[0])) + ' DR' if drs else ''
        ch['id'] = ch.get('id') or 'ch-' + slug(ch['title'])
        v = VYP.get(ch['id'], [])
        ch['words'] = VYPR.words(v)
        ch['min'] = max(1, round(ch['words'] / 170))
        ch['route'] = CH_ROUTE.get(ch['id'], [])
        cast = {}
        for s in grp:
            for c, pl in s.get('cast', []):
                cast.setdefault(c, pl)
        ch['cast'] = [[c, pl] for c, pl in cast.items()]
        gl = []
        for s in grp:
            gl += [{'k': 'ilu/' + m['f'], 'cap': m['cap'], 's': s['id']} for m in s.get('ilu', [])]
            gl += [{'k': 'nove/n%02d' % g['n'], 'cap': g['cap'], 's': s['id']} for g in s.get('gal', [])]
            gl += [{'k': 'foto/%03d' % n, 'cap': 'U stolu, ' + s['date_label'], 's': s['id']} for n in s.get('photos', [])]
        ch['gallery'] = gl
        ch['regions'] = list(dict.fromkeys(s.get('region') for s in grp if s.get('region')))
        ch['players'] = list(dict.fromkeys(p for s in grp for p in s.get('players', [])))
    c = CAMP.get(k, {})
    sub = {'I': ['klid'], 'II': ['lovci'], 'III': ['druha'], 'IV': [], 'V': ['epilog']}[k]
    div = next((m['file'][:-4] for m in MAN if m.get('target') == 'kniha-' + k), None)
    books.append({'key': k, 'kap': kap, 'title': tit, 'real': real, 'dr': dr, 'sessions': len(ss), 'summary': c.get('summary', ''),
                  'key_places': c.get('key_places', []), 'key_enemies': c.get('key_enemies', []), 'img': div,
                  'side': [{'key': x, 'title': CAMP[x]['title'], 'summary': CAMP[x]['summary'],
                            'real': f"{CAMP[x]['real_from']}–{CAMP[x]['real_to']}", 'dr': f"{CAMP[x]['dr_from']}–{CAMP[x]['dr_to']} DR"} for x in sub if x in CAMP],
                  'chapters': chapters})

# ---------------------------------------------------------------- postavy
GALC = {}
for g in GAL:
    if g.get('char'): GALC.setdefault(g['char'], []).append(g)


def portrait_of(cid):
    if cid in PORTS: return {'src': 'port/' + cid, 'kind': 'port'}
    alias = {'seung-mina': ('ilu', 'T3_032'), 'princove-stinu': ('ilu', 'T3_050'), 'yamoh-hokhra': ('ilu', 'P_023'),
             'yamun-ii': ('ilu', 'T1_040'), 'zesion': ('ilu', 'K_024'), 'devrel': ('ilu', 'K_012'), 'thalaxia': ('ilu', 'K_001'),
             'axel-adamantis': ('ilu', 'K_040'), 'lao': ('ilu', 'T2_026'), 'kung-lao': ('ilu', 'T1_040'), 'mitsurugy': ('ilu', 'K_017'),
             'finian': ('ilu', 'K_018'), 'jenova': ('ilu', 'K_039')}
    best = {'nathan': 79, 'theira': 17, 'zia': 77, 'arwin': 10, 'sar-saratar': 69, 'agathon': 16}
    if cid in best: return {'src': 'nove/n%02d' % best[cid], 'kind': 'nove'}
    if cid in alias: ilu_need(alias[cid][1]); return {'src': 'ilu/' + alias[cid][1], 'kind': 'ilu'}
    return None


chars = []
for c in C:
    o = dict(c); o['portrait'] = portrait_of(c['id'])
    o['sessions'] = [s['id'] for s in sessions if any(norm(x) == norm(c['name']) or norm(x) == norm(c['name'].split()[0]) for x in s.get('characters', []))]
    chars.append(o)

# ---------------------------------------------------------------- vedlejší postavy → sezení
STOP = {'kral', 'kralovna', 'lord', 'lady', 'pan', 'pani', 'mistr', 'general', 'baron', 'princ', 'admiral', 'kapitan', 'velekneznka', 'sir', 'otec', 'matka'}
ses_txt = {s['id']: norm(' '.join([s.get('title', ''), s.get('summary', ''), ' '.join(s.get('npcs', [])), ' '.join(s.get('highlights', []))])) for s in sessions}
npcs = []
for i, x in enumerate(N):
    names = [x['name']] + (x.get('aliases') or [])
    keys = set()
    for nm in names:
        base = re.sub(r'[„“"][^„“"]*[„“"]|\([^)]*\)', '', nm).strip()
        parts = [p for p in re.split(r'[\s,]+', norm(base)) if len(p) > 3 and p not in STOP]
        if parts: keys.add(norm(base).strip())
        if len(parts) >= 1 and len(parts[0]) >= 5: keys.add(parts[0])
    hits = []
    for sid, t in ses_txt.items():
        if any(re.search(r'\b' + re.escape(k) + r'\w{0,4}\b', t) for k in keys if len(k) >= 4):
            hits.append(sid)
    o = {k: x.get(k) for k in ['name', 'aliases', 'who', 'group', 'region', 'when', 'kind', 'canon']}
    o['i'] = i; o['sessions'] = hits[:40]
    npcs.append({k: v for k, v in o.items() if v not in (None, [], '')})

# ---------------------------------------------------------------- mapa
# Oprava poloh (shodně s 3D mapou): tethyrský shluk v map.json leží asi o 100 px západněji, Castle Tethyr byl v moři.
MAP_FIX = {'Castle Tethyr': (365, 568), 'Ithmong': (445, 575), 'Tyrův chrám v Tethyru': (382, 586), 'Port': (1962, 461),
           'Dračí let': (259, 531), 'Reghedský ledovec': (137, 10), 'Mechový kámen': (256, 523), 'Mořské věže': (116, 628)}
for p in MP['places']:
    if p['name'] in MAP_FIX: p['x'], p['y'] = MAP_FIX[p['name']]
for p in MP['places'] + MP['off']:
    p['id'] = slug(p['name'])
PL = {p['name']: p for p in MP['places']}
# Pořadí zastávek podle chronologie sezení (v map.json jsou některé úseky klikaté a čáry se kříží).
# Uvnitř jednoho sezení (např. s-2006 = celé tažení po Shou Lungu) data pořadí neurčují: drží se pořadí
# ze shrnutí sezení (Kuo Te' Lung → T'u Lung → … Tuigan → Balanzie) a zbytek tak, aby se trasa nekřížila.
# Klíč = indexy v map.json, hodnota = nové pořadí týchž indexů.
ROUTE_REORDER = {
    (7, 8, 9, 10, 11, 12, 13, 14, 15): (7, 8, 9, 14, 15, 10, 11, 12, 13),  # Shou Lung (s-2006)
    (16, 17, 18, 19, 20, 21, 22): (17, 21, 22, 16, 18, 19, 20),            # s-2006-12 → s-2007-02 → Maztica (s-2007)
    (23, 24, 25, 26, 27, 28, 29): (23, 24, 25, 27, 26, 28, 29),            # Štíty Apokalypsy (s-2008, s-2009)
    (46, 47, 48): (47, 48, 46),                                            # 5/2014: Chult, Chondalský les, Khôltar
}
ORDER = list(range(len(MP['route'])))
for k, v in ROUTE_REORDER.items():
    for a, b in zip(k, v): ORDER[a] = b
NEWIDX = {old: new for new, old in enumerate(ORDER)}
for k in CH_ROUTE:
    CH_ROUTE[k] = [NEWIDX[i] for i in CH_ROUTE[k]]
for k in ('ch-shou-lung-a-velke-tazeni', 'ch-navrat-tyruv-chram-a-sigil', 'ch-stity-apokalypsy', 'ch-kholtar-chult-a-hoova-mala'):
    CH_ROUTE[k] = sorted(CH_ROUTE[k])   # kapitoly z přeskládaných úseků: body v novém pořadí
for b in books:
    for ch in b['chapters']:
        ch['route'] = CH_ROUTE.get(ch['id'], [])
route = []
for r in (MP['route'][i] for i in ORDER):
    p = PL.get(r['place'])
    route.append(dict(r, x=p['x'] if p else None, y=p['y'] if p else None))
place_ses = {}
for p in MP['places'] + MP['off']:
    k = norm(p['name']); k2 = norm(p['name'].split(',')[0])
    place_ses[p['name']] = [s['id'] for s in sessions if k in ses_txt[s['id']] or (len(k2) > 4 and k2 in ses_txt[s['id']])][:30]
place_npc = {}
for p in MP['places'] + MP['off']:
    k = norm(p['name'])
    place_npc[p['name']] = [n['i'] for n in npcs if k in norm(n.get('when', '') + ' ' + n.get('who', '') + ' ' + n.get('region', ''))][:40]
# zastávky trasy: rok (pro posuvník let), sezení z téže doby, kapitola Příběhu
def ym(t):
    """'8–12/2011' → (2011.58, 2011.99); '2007–2008' → (2007.0, 2008.99)"""
    t = (t or '').replace('–', '-').replace(' ', '')
    def one(q, end):
        m = re.match(r'^(?:(\d{1,2})/)?(\d{4})$', q)
        if not m: return None
        y = int(m.group(2))
        if m.group(1): return y + (int(m.group(1)) - 1) / 12 + (1 / 12 - 0.001 if end else 0)
        return y + (0.999 if end else 0)
    parts = t.split('-')
    if len(parts) == 1: return one(parts[0], False), one(parts[0], True)
    a, b = parts[0], parts[-1]
    if re.match(r'^\d{1,2}$', a) and '/' in b:
        y = int(b.split('/')[1]); return y + (int(a) - 1) / 12, one(b, True)
    return one(a, False), one(b, True)


def skey(s):
    d = sdate(s); return d.year + (d.month - 1) / 12 + (d.day - 1) / 372


SKEY = {s['id']: skey(s) for s in S}
CH_OF_SES = {sid: ch['id'] for b in books for ch in b['chapters'] for sid in ch['sessions']}
CH_OF_IDX = {}
for k, v in CH_ROUTE.items():
    for i in v: CH_OF_IDX.setdefault(i, k)
for i, r in enumerate(route):
    lo, hi = ym(r['real'])
    ss = [x for x in place_ses.get(r['place'], []) if lo is not None and lo - 0.05 <= SKEY.get(x, 0) <= hi + 0.05]
    if not ss and lo is not None:   # sezení z téže doby, která jmenují kraj v názvu
        reg = (PL.get(r['place']) or {}).get('region', '')
        ss = [x['id'] for x in S if lo - 0.05 <= SKEY[x['id']] <= hi + 0.05 and (norm(r['place']) in norm(x.get('title', '')) or (reg and norm(reg) in norm(x.get('title', ''))))][:3]
    r['k'] = round(lo or 2003, 3)
    if ss: r['s'] = sorted(ss, key=lambda x: SKEY[x])[:6]
    r['ch'] = CH_OF_IDX.get(i) or next((CH_OF_SES[x] for x in r.get('s', []) if x in CH_OF_SES), None) or (route[i - 1].get('ch') if i else None)
# bitvy a svědci u míst (vazby z 3D mapy, aby obě mapy ukazovaly totéž)
try:
    CAMP3D = json.load(open(ROOT + '/public/mapa3d/data/campaign.json', encoding='utf-8'))
    P3 = {o['id']: o for o in CAMP3D['places'] + CAMP3D['spheres']}
    B3 = [{'id': b['id'], 'name': b['name'], 'x': b.get('x'), 'y': b.get('z'), 'pl': b.get('pl'), 'era': b.get('era'), 'real': b.get('real'), 'dr': b.get('dr')}
          for b in CAMP3D['battles'] if not b.get('bg')]
except (OSError, KeyError, ValueError):
    P3, B3 = {}, []
for p in MP['places'] + MP['off']:
    o = P3.get(p['id'], {})
    if o.get('battles'): p['battles'] = o['battles']
    if o.get('wit'): p['wit'] = o['wit']
    if o.get('sphere') and o.get('icon'): p['icon'] = o['icon']
PID = {p['id']: p for p in MP['places']}
for b in B3:
    if b['x'] is None and b['pl'] in PID: b['x'], b['y'] = PID[b['pl']]['x'], PID[b['pl']]['y']
mapdata = {'size': [2576, 884], 'battles': [b for b in B3 if b['x'] is not None], 'places': [dict(p, sessions=place_ses[p['name']], npcs=place_npc[p['name']]) for p in MP['places']],
           'off': [dict(p, sessions=place_ses[p['name']], npcs=place_npc[p['name']]) for p in MP['off']], 'route': route}

# ---------------------------------------------------------------- proroctví
raw = [l.strip().lstrip('﻿') for l in open(WORK + '/txt/Alaundovo.txt', encoding='utf-8').read().split('\n')]
raw = [l for l in raw if l][1:]
chs = []
for l in raw:
    if re.match(r'(?i)^kapitola\s+\d', l): chs.append([])
    elif chs: chs[-1].append(l)
PIMG = [m for m in MAN if m.get('target') == 'Alaundovo proroctví' and m['file'].startswith('P_')]
# výklady: jen to, co stojí v datech (npcs/characters/sezení) nebo v textech hráčů (písně)
VYKLAD = [
    ('Ke Strážcům nepatří, devátá z desíti', 'Arwin en Rewin', 'postavy: Arwin („devátá z desíti v Alaundově proroctví“)'),
    ('Ta z bouře zrozená, se zlatým hlasem', 'Storm „Bouře“ Lenlo', 'rejstřík: Storm Lenlo, „ta z bouře zrozená“ z proroctví'),
    ('Ta z bouře zrozená a kněžna černé dýky', 'Storm „Bouře“ Lenlo', 'rejstřík: Storm Lenlo, „ta z bouře zrozená“ z proroctví'),
    ('Za pomstou žene se svatý muž z východu', 'Ho Wu Long proti Yamohu Hokhrovi', 'postavy: Ho, svatý muž z východu; Yamoh Hokhra, šaman z plání'),
    ('S šamanem z plání střetnout se chce', 'Ho Wu Long proti Yamohu Hokhrovi', 'bitva v Anaurochu'),
    ('Boji se vyhýbá velký mág světla', 'kostěj z cizího světa je arcidemilich Sar Saratar; velký mág světla Elminster', 'postavy: Sar Saratar; bitva v Anaurochu'),
    ('Odemykač světů, klíče má ke všemu', 'Rauko Daerond', 'píseň „Soukolí věčnosti“: „Za stínem se žene Rauko — Odemykač světů“'),
    ('Lidé jen tuší, moudří to ví', 'Ilthyn, matka země', 'píseň „Soukolí věčnosti“: „Ilthin, matka země… v ní dříme klíč“'),
]


def split_pair(l):
    c = [m.start() for m in re.finditer(r',\s', l)]
    if not c or len(l) < 50: return [l]
    mid = len(l) / 2; i = min(c, key=lambda x: abs(x - mid))
    if abs(i - mid) > len(l) * .28: return [l]
    return [l[:i + 1].strip(), l[i + 1:].strip()]


proph = []
for ci, c in enumerate(chs):
    verses = []
    for li, l in enumerate(c[3:]):
        v = {'t': split_pair(l)}
        nl = norm(l)
        for m in PIMG:
            vv = norm(m.get('verse', ''))
            if vv and nl.startswith(vv[:max(12, len(vv) - 2)]):
                v['img'] = m['file'][:-4]; v['cap'] = m.get('caption', '')
        for pre, who, src in VYKLAD:
            if re.sub(r'\s+', ' ', nl).startswith(re.sub(r'\s+', ' ', norm(pre))): v['who'] = who; v['src'] = src
        verses.append(v)
    img = next((m['file'][:-4] for m in MAN if m.get('target') == f'proroctvi-{ci + 1}'), None)
    proph.append({'n': ci + 1, 'tercet': c[:3], 'verses': verses, 'img': img})
prophecy = {'chapters': proph, 'img': next((m['file'][:-4] for m in MAN if m.get('target') == 'proroctvi'), None),
            'intro': 'Proroctví sepsal Pán jeskyně jako věštbu starého Alaunda, pána v hnědé kutně s brýlemi. Má tři kapitoly. Každé dvojverší patří jedné postavě, dvojici soupeřů nebo události poslední bitvy. Družina je dostala od illithidů z Oryndollu výměnou za nautiloid a jednoho večera ho skoro celé rozluštila.'}

# ---------------------------------------------------------------- časová osa (data z osa.py)
osa_src = open(OSA + '/osa.py', encoding='utf-8').read()


def lit(name):
    m = re.search(r'^' + name + r'=\[(.*?)^\]', osa_src, re.S | re.M) or re.search(r'^' + name + r'=(\[.*?\])\s*$', osa_src, re.M)
    txt = m.group(0).split('=', 1)[1]
    txt = re.sub(r'#\s.*', '', txt)
    return ast.literal_eval(txt)


CHL = lit('CH'); EV = lit('EV'); BK = lit('BK')
# DR k reálnému času (z dat sezení)
drmap = [(sdate(s).year + (sdate(s).timetuple().tm_yday - 1) / 366, s['dr']) for s in S if s.get('dr') and s['dr'] < 1400]
timeline = {'lines': [{'name': a, 'player': b, 't0': c, 't1': d, 'lane': e, 'color': f} for a, b, c, d, e, f in CHL],
            'events': [{'t': t, 'label': l} for t, l in EV], 'books': [{'t0': a, 't1': b, 'label': c} for a, b, c, d in BK],
            'dr': drmap, 'dr_events': [x for x in WD['dr_timeline']],
            'sessions': [{'id': s['id'], 't': round(sdate(s).year + (sdate(s).timetuple().tm_yday - 1) / 366, 3), 'dr': s.get('dr'), 'era': s['era'], 'title': s['title']} for s in sessions]}

# ---------------------------------------------------------------- svět, galerie, fotky, stůl
world = {'stats': WD['stats'], 'campaigns': WD['campaigns'], 'places': WD['places'], 'factions': WD['factions'],
         'artifacts': WD['artifacts'], 'dr_timeline': WD['dr_timeline'], 'battles': BATTLES}
gallery = {'historky': WD.get('historky', {}), 'nove': [{'n': g['n'], 'kind': g['kind'], 'title': g['title'], 'cap': g.get('caption', ''), 'session': g.get('session'), 'w': g['w'], 'h': g['h']} for g in GAL],
           'foto': [{'n': n, 'dt': FI.get(str(n), {}).get('dt', ''), 'w': FI.get(str(n), {}).get('w'), 'h': FI.get(str(n), {}).get('h')} for n in FOTO],
           'ilu': [{'f': m['file'][:-4], 'target': m.get('target'), 'cap': m.get('caption', ''), 'session': m.get('session'), 'battle': m.get('battle')} for m in MAN]}

# ---------------------------------------------------------------- svědectví
SV = upresneni.fix_witnesses(load(ROOT + '/data/svedectvi.json'))  # text svědectví se NESMÍ měnit (je přesně tak, jak byl namluven)
VID = os.environ.get('SRC_VID', '/home/claude/vid')
HOME_MAP = {'khelbenova-dcera': (198, 192)}  # domovské místo na mapě (x, y) pro svědky bez portrétu
sid = {s['id'] for s in sessions}; bid = {b['id'] for b in BATTLES}
PCIDS = {c['id'] for c in chars if c.get('kind') == 'hrac'}
for w in SV:
    if w['id'] in PCIDS or w.get('hrac'):
        print('  !! hráčská postava nesmí mít svědectví:', w['id'])
    words = len(' '.join(w['text']).split())
    miss = [z for z in w.get('zdroje', []) if re.match(r'(s|b)-', z) and z not in sid and z not in bid]  # txt:…, hymna a poznámky (např. „upřesnění autora“) se nekontrolují
    ok = 'OK' if 90 <= words <= 170 and not miss else '!!'
    if ok != 'OK' or '-v' in ARGS:
        print(f"  {ok} svědectví {w['id']:16s} {words:4d} slov  {'chybí zdroje: ' + ','.join(miss) if miss else ''}")
    if clean(w['text']) != w['text']:
        print('  !! text svědectví by čištění změnil:', w['id'])
    # portrét: nový portrét z videí (…_portret.png), jinak poster videa, jinak klíč z dat
    for cand in (f"{VID}/{w['id']}_portret.png", f"{VID}/{w['id']}.jpg"):
        if os.path.exists(cand):
            w['portret'] = job(cand, 'wit/' + w['id'], (640, 1280), 80)
            break
    else:
        if not w.get('portret'):
            # svědek bez tváře: ztemnělý výřez mapy kolem domovského místa (Hlubina pro dceru Khelbena)
            from PIL import Image, ImageFilter, ImageEnhance
            cx, cy = HOME_MAP.get(w['id'], (198, 192))
            os.makedirs('/tmp/wit-cache', exist_ok=True)
            cp = f"/tmp/wit-cache/{w['id']}.png"
            mp = Image.open(D + 'toril-east-west.jpg').convert('RGB')
            cw, ch = 400, 225
            box = (max(0, min(mp.width - cw, cx - cw // 2)), max(0, min(mp.height - ch, cy - ch // 2)))
            cr = mp.crop((box[0], box[1], box[0] + cw, box[1] + ch)).resize((1280, 720), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2.2))
            ImageEnhance.Brightness(ImageEnhance.Color(cr).enhance(.55)).enhance(.62).save(cp)
            w['portret'] = job(cp, 'wit/' + w['id'], (640, 1280), 76)
        if str(w.get('portret', '')).startswith('ilu/'): ilu_need(w['portret'][4:])
        if not w.get('portret') or (not os.path.exists(IMG + w['portret'] + '-480.webp') and not any(j[1] == w['portret'] for j in JOBS)):
            print('  !! portrét nenalezen:', w['id'], w.get('portret'))
    w.pop('casy', None)
    if os.path.exists(f"{ROOT}/assets/video/{w['id']}_plne.mp4"): w['video_plne'] = True  # celé video se synchronizovanými ústy
SV = [clean({k: v for k, v in w.items() if k not in ('text', 'titulky')}) | {k: w[k] for k in ('text', 'titulky') if k in w} for w in SV]

# ---------------------------------------------------------------- vyprávění: kontrola odkazů a stylu
C3D = load(ROOT + '/public/mapa3d/data/campaign.json')
IDS = {'w': {w['id'] for w in SV}, 'm': {p['id'] for p in C3D['places'] + C3D['spheres']}, 'b': {b['id'] for b in BATTLES},
       'c': {c['id'] for c in chars}, 's': {s['id'] for s in sessions},
       'p': {f"{ci + 1}-{vi}" for ci, c in enumerate(proph) for vi in range(len(c['verses']))}}
ALLCH = [c for b in books for c in b['chapters']]
nbad = VYPR.validate(VYP, ALLCH, IDS)
print(f'vyprávění: {len(VYP)} kapitol, {sum(c["words"] for c in ALLCH)} slov, {nbad} problémů')
PLACE_NAME = {p['id']: p['name'] for p in C3D['places'] + C3D['spheres']}
stats = {'sessions': len(sessions), 'pcs': sum(1 for c in chars if c.get('kind') == 'hrac'), 'battles': len(BATTLES), 'npcs': len(npcs)}

# ---------------------------------------------------------------- zápis
print('data →', OUT)
dump('sessions.json', sessions)
dump('books.json', books)
dump('characters.json', chars)
dump('npcs.json', npcs)
dump('world.json', world)
dump('map.json', mapdata)
dump('prophecy.json', prophecy)
dump('timeline.json', timeline)
gallery['ilu'] = [x for x in gallery['ilu'] if x['f'] + '.jpg' in ILU_DONE]
dump('gallery.json', gallery)
dump('svedectvi.json', SV)
dump('vypraveni.json', {'chapters': VYP, 'places': PLACE_NAME})
dump('stats.json', stats)


# ---------------------------------------------------------------- obrázky
def convert(j):
    src, dst, widths, q = j
    from PIL import Image
    base = IMG + dst
    os.makedirs(os.path.dirname(base), exist_ok=True)
    if src.endswith('.svg'):
        import shutil
        if not os.path.exists(base + '.svg'): shutil.copy(src, base + '.svg')
        return 0
    done = 0
    im = None
    for w in widths:
        out = f'{base}-{w}.webp'
        if os.path.exists(out) and '--force' not in ARGS and os.path.getmtime(out) >= os.path.getmtime(src):
            continue
        if im is None:
            im = Image.open(src); im.load()
            if im.mode not in ('RGB', 'RGBA'): im = im.convert('RGB')
            if im.mode == 'RGBA': im = im.convert('RGB')
        ww = min(w, im.width)
        r = im if ww == im.width else im.resize((ww, round(im.height * ww / im.width)), Image.LANCZOS)
        r.save(out, 'WEBP', quality=q, method=6)
        done += 1
    return done


if '--no-img' not in ARGS:
    with ProcessPoolExecutor(max(2, (os.cpu_count() or 2))) as ex:
        n = sum(ex.map(convert, JOBS, chunksize=4))
    # rozměry pro layout
    from PIL import Image
    dims = {}
    for src, dst, widths, q in JOBS:
        if widths:
            try:
                with Image.open(src) as im: dims[dst] = [im.width, im.height, list(widths)]
            except Exception: pass
    dump('images.json', dims)
    tot = sum(os.path.getsize(p) for p in glob.glob(IMG + '**/*', recursive=True) if os.path.isfile(p))
    print(f'obrázky: {n} nově převedených, celkem {tot / 1e6:.1f} MB')

# ---------------------------------------------------------------- lexikon, hledání a hover odkazy (iterace 7)
import subprocess  # noqa: E402
subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build-lexikon.py')], check=True)

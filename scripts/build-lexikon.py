#!/usr/bin/env python3
"""Lexikon, vyhledávací index a hover karty (iterace 7).

Spouští se po build-data.py (build-data ho na konci volá sám):  python3 scripts/build-lexikon.py

Čte public/data/*.json (už vyčištěná data kroniky), data/svedectvi.json a public/mapa3d/data/campaign.json a zapíše
  public/data/lexikon.json  – hesla: osoby (postavy, svědci a 810 vedlejších postav), místa (2D i 3D mapa),
                              frakce a organizace, pojmy (předměty a artefakty z dat). Texty hesel jen z dat.
  public/data/search.json   – fulltextový index (odstavce kapitol, sezení, osoby, místa, bitvy, verše, svědectví);
                              web ho stahuje až při prvním hledání.
  public/data/vypraveni.json – doplní odkazy [jméno](x:heslo) u PRVNÍHO výskytu jména osoby nebo místa v odstavci
                              (z nich jsou hover karty). Ručně psané odkazy (w:, c:, m:) zůstávají; heslo k nim dohledá web.
"""
import json, os, re, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = ROOT + '/public/data/'


def load(p):
    return json.load(open(p, encoding='utf-8'))


def slug(s):
    s = ''.join(c for c in unicodedata.normalize('NFD', s.lower()) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFD', (s or '').lower()) if unicodedata.category(c) != 'Mn')


def first_sentence(t, n=230):
    t = (t or '').strip()
    if not t:
        return ''
    m = re.match(r'(.+?[.!])(\s|$)', t)
    s = m.group(1) if m else t
    if len(s) > n:
        s = s[:n].rsplit(' ', 1)[0] + '…'
    return s


def strip_links(t):
    return re.sub(r'\[([^\]]+)\]\([a-z]:[^)]+\)', r'\1', t or '')


S = load(OUT + 'sessions.json')
B = load(OUT + 'books.json')
C = load(OUT + 'characters.json')
N = load(OUT + 'npcs.json')
W = load(OUT + 'world.json')
M = load(OUT + 'map.json')
P = load(OUT + 'prophecy.json')
V = load(OUT + 'vypraveni.json')
SV = load(OUT + 'svedectvi.json')
G = load(OUT + 'gallery.json')
IMGS = load(OUT + 'images.json')
C3D = load(ROOT + '/public/mapa3d/data/campaign.json')
STAV_W = load(ROOT + '/data/svedkove-stav.json')

SES = {s['id']: s for s in S}
CH = {c['id']: (b, c) for b in B for c in b['chapters']}
CH_OF_SES = {sid: c['id'] for b in B for c in b['chapters'] for sid in c['sessions']}
CH_ORDER = [c['id'] for b in B for c in b['chapters']]
WIT = {w['id']: w for w in SV}
WIT_BY_NAME = {}
for w in SV:
    WIT_BY_NAME[norm(w['jmeno'].split(' (')[0])] = w['id']

# ---------------------------------------------------------------- stav (žije / padl / zmizel)
# Upřesnění autora mají přednost (Kung Lao padl ve Feng Asay, Yamoh zmizel, Sar Saratar padl, Khelben zmizel).
STAV_FIX = {'kung lao': ('padl', 'Feng Asay · Broskvová zahrada'), 'chuang-li': ('padl', 'Cham Fau, v souboji s Ho Wu Longem'),
            'lord ryden': ('padl', 'při prošetřování Cham Fau rukou Chuang-Li'), 'arduna': ('žije', 'vedle Hoa jediný dosud žijící šedý mnich'), 'yamoh hokhra': ('zmizel', 'v bitvě o Anauroch zmizel v dračí podobě (1385 DR)'),
            'sar saratar': ('padl', 'v bitvě o Anauroch ho rozdrtil Elminster (1385 DR)'), 'khelben arunsun': ('zmizel', 'zmizel, Černou věž drží jeho dcera'),
            'seung mina': ('žije', 'Hoova žena'), 'rivalen tanthul': ('padl', 'padl na vrcholu Pyramidy času (1385 DR)'),
            'clariburnus tanthul': ('padl', 'padl na vrcholu Pyramidy času (1385 DR)')}


def guess_stav(*texts):
    t = ' '.join(x or '' for x in texts).lower()
    t = re.sub(r'\bmálem \w+|\btéměř \w+', '', t)
    if re.search(r'\bnežije\b|\bpadl[aio]?\b|\bzemřel|\bzahynul|\bzabit[aá]?\b|\bzničen|\brozdrtil|\brozdrcen', t):
        return 'padl'
    if re.search(r'\bzmizel[aio]?\b|\bztratil[aio]? se\b|\bztracen', t):
        return 'zmizel'
    return None


# ---------------------------------------------------------------- portréty
PORT_KEYS = {k.split('/', 1)[1]: k for k in IMGS if k.startswith('port/')}
NOVE = {norm(g['title']): f"nove/n{g['n']:02d}" for g in G['nove'] if g['kind'] == 'postava' and f"nove/n{g['n']:02d}" in IMGS}


def portrait_for(name, aliases=()):
    for nm in [name, *aliases]:
        if norm(nm) in NOVE:
            return NOVE[norm(nm)]
    toks = [slug(x) for x in re.split(r'[\s„“"]+', name) if x]
    for t in toks:
        if t in PORT_KEYS:
            return PORT_KEYS[t]
    return None


ENT = {}  # id → heslo
BY_NORM = {}  # normalizované jméno → id (osoby)


def add(e):
    ENT[e['id']] = e
    return e


# ---------------------------------------------------------------- osoby: postavy (characters.json)
CHAR_ENT = {}
for c in C:
    nm = c['name']
    eid = 'o-' + c['id']
    pc = c['kind'] == 'hrac'
    wid = c['id'] if c['id'] in WIT else WIT_BY_NAME.get(norm(nm))
    st = c.get('status') or guess_stav(c.get('fate'))
    fx = STAV_FIX.get(norm(c.get('full_name') or nm)) or STAV_FIX.get(norm(nm))
    stx = None
    if fx: st, stx = fx
    if wid and WIT[wid].get('stav'): st = WIT[wid]['stav']; stx = stx or WIT[wid].get('stav_titulek', '').lstrip('† ')
    if wid and not st: st = 'žije'
    img = (WIT[wid]['portret'] if wid else None) or (c.get('portrait') or {}).get('src') or portrait_for(nm, c.get('aliases') or [])
    if img and img not in IMGS: img = None
    vaz = (WIT[wid]['vazba'] if wid else None)
    if pc:
        vaz = f"Hráčská postava · hraje {c['player']}" if c.get('player') else 'Hráčská postava'
    e = add({'id': eid, 't': 'osoba', 'n': nm, 'fn': c.get('full_name') if c.get('full_name') not in (None, nm) else None,
             'al': [a for a in (c.get('aliases') or []) if a and a != nm], 's': first_sentence(c.get('intro')),
             'd': ' '.join(x for x in [c.get('intro'), ('Osud: ' + c['fate']) if c.get('fate') else ''] if x)[:700],
             'img': img, 'stav': st, 'stx': stx, 'strana': 'družina' if pc else ('nepřítel' if c['kind'] == 'protivnik' else 'spojenec'),
             'vaz': vaz, 'pc': c['id'], 'wit': wid, 'grp': 'Tethyrská královská družina' if pc else None,
             'reg': c.get('origin'), 'ses': list(c.get('sessions') or []), 'kind': c['kind']})
    CHAR_ENT[c['id']] = eid
    for k in [nm, c.get('full_name'), *(c.get('aliases') or [])]:
        if k: BY_NORM.setdefault(norm(k), eid)
    if len(nm.split()) > 1 and len(nm.split()[0]) >= 4: BY_NORM.setdefault(norm(nm.split()[0]), eid)

# ---------------------------------------------------------------- osoby: svědci, kteří nejsou v characters.json
for w in SV:
    if any(e.get('wit') == w['id'] for e in ENT.values()):
        continue
    nm = w['jmeno'].split(' (')[0]
    eid = 'o-' + w['id']
    st = w.get('stav') or 'žije'
    stx = (w.get('stav_titulek') or '').lstrip('† ') or None
    fx = STAV_FIX.get(norm(nm))
    if fx: st, stx = fx
    add({'id': eid, 't': 'osoba', 'n': nm, 'fn': w['jmeno'] if w['jmeno'] != nm else None, 'al': [], 's': w['role'][:1].upper() + w['role'][1:] + '.',
         'd': '', 'img': w.get('portret'), 'stav': st, 'stx': stx, 'strana': w.get('strana'), 'vaz': w.get('vazba'),
         'wit': w['id'], 'grp': None, 'reg': None, 'ses': [z for z in w.get('zdroje', []) if z in SES]})
    BY_NORM.setdefault(norm(nm), eid)
    BY_NORM.setdefault(norm(w['jmeno']), eid)
    if len(nm.split()) > 1 and len(nm.split()[0]) >= 4: BY_NORM.setdefault(norm(nm.split()[0]), eid)

# ---------------------------------------------------------------- osoby: vedlejší postavy (npcs.json)
NPC_ENT = {}
for n in N:
    nm = n['name']
    keys = [nm, *(n.get('aliases') or [])]
    hit = next((BY_NORM[norm(k)] for k in keys if norm(k) in BY_NORM), None)
    # „král X“, „lord X“: zkusit i bez titulu
    if not hit:
        bare = re.sub(r'^(král|královna|lord|lady|kapitán|generál|velekněžka|mistr|baron|princ|admirál|sir)\s+', '', nm, flags=re.I)
        hit = BY_NORM.get(norm(bare))
    if hit:
        e = ENT[hit]
        e['ses'] = sorted(set(e['ses']) | set(n.get('sessions') or []))
        e.setdefault('grp', None)
        if not e.get('grp'): e['grp'] = n.get('group')
        if not e.get('reg'): e['reg'] = n.get('region')
        if not e.get('d'): e['d'] = n.get('who', '')
        e['npc'] = n['i']
        e['al'] = sorted(set(e['al']) | {a for a in (n.get('aliases') or []) if a != e['n']})
        NPC_ENT[n['i']] = hit
        continue
    eid = 'o-' + slug(nm)
    while eid in ENT: eid += '-2'
    fx = STAV_FIX.get(norm(nm))
    st, stx = fx if fx else (guess_stav(n.get('who'), n.get('when')), None)
    who = n.get('who') or ''
    sent = who.split(';')[0].strip()
    rest = '; '.join(x.strip() for x in who.split(';')[1:])
    add({'id': eid, 't': 'osoba', 'n': nm, 'fn': None, 'al': [a for a in (n.get('aliases') or []) if a != nm],
         's': (rest[:1].upper() + rest[1:] if rest else sent[:1].upper() + sent[1:]).rstrip('.') + '.',
         'd': who + (('. Kdy a kde: ' + n['when']) if n.get('when') else ''), 'img': portrait_for(nm, n.get('aliases') or []),
         'stav': st, 'stx': stx, 'strana': n.get('kind'), 'vaz': None, 'wit': WIT_BY_NAME.get(norm(nm)), 'grp': n.get('group'),
         'reg': n.get('region'), 'ses': list(n.get('sessions') or []), 'npc': n['i'], 'canon': n.get('canon')})
    NPC_ENT[n['i']] = eid
    for k in keys:
        BY_NORM.setdefault(norm(k), eid)

# dcera Khelbena Arunsuna: jméno neznáme (upřesnění autora)
for e in ENT.values():
    if e.get('wit') == 'khelbenova-dcera':
        e['s'] = 'Dcera arcimága Khelbena Arunsuna; po otcově zmizení drží Černou věž v Hlubině. Jméno v kronice nezaznělo.'

# ---------------------------------------------------------------- místa (2D mapa = 3D mapa, stejné id)
PL2 = {p['id']: p for p in M['places'] + M['off']}
for p in C3D['places'] + C3D['spheres']:
    pid = p['id']
    p2 = PL2.get(pid, {})
    eid = 'm-' + pid
    ses = sorted(set(p.get('sessions') or []) | set(p2.get('sessions') or []))
    chs = {r['ch'] for r in M['route'] if r.get('place') == p['name'] and r.get('ch')}
    npcs = [NPC_ENT[i] for i in (p2.get('npcs') or []) if isinstance(i, int) and i in NPC_ENT]
    add({'id': eid, 't': 'misto', 'n': p['name'], 'fn': None, 'al': [], 's': first_sentence(p.get('desc')), 'd': p.get('desc', ''),
         'img': None, 'kind': p.get('kind'), 'reg': p.get('region') or p2.get('region'), 'm2': pid if pid in PL2 else None, 'm3': pid,
         'sphere': pid in {s['id'] for s in C3D['spheres']}, 'ses': ses, 'chx': sorted(chs),
         'visits': [f"{v.get('real', '')} · {v.get('dr', '')} DR · {v.get('what', '')}" for v in (p.get('visits') or [])][:8],
         'who': npcs[:30], 'bat': [b['id'] for b in W['battles'] if b.get('place') and (p['name'] in b['place'])], 'wits': p.get('wit') or []})

# Broskvová zahrada: podsféra, kam přecházejí zemřelí šedí mniši (upřesnění autora 23. 11. 2026); na mapách není
add({'id': 'm-broskvova-zahrada', 't': 'misto', 'n': 'Broskvová zahrada', 'fn': None, 'al': ['laoneyské nebe'],
     's': 'Podsféra, „laoneyské nebe“, kam přecházejí zemřelí šedí mniši (šedí laoneyové); lze je tam vyhledat a mluvit s nimi.',
     'd': 'Podsféra, „laoneyské nebe“, kam přecházejí šedí mniši, kteří zemřou. Lze je tam vyhledat a mluvit s nimi. Je tam mimo jiné Hoův otec, císař Lei Wu-Long, a Wang Fei-Hung. Kung Lao, který zemřel ve Feng Asay, je tam také a Ho u něj přestupoval. Dlí tam i astrální tělo a duše Lorda Rydena, kterého zabila Chuang-Li při prošetřování Cham Fau; Ho ho tam roku 1385 DR navštívil a prošel u něj Rydenovým cvičením cesty vzduchu. Chuang-Li, zrádkyně, tam není. Jediným dosud žijícím šedým mnichem vedle Hoa je Arduna. V sezení o Shou Lungu (1380–1382 DR) se Ho u Li-Longa ptal na Broskvovou zahradu; je to totéž místo.',
     'img': None, 'kind': 'podsféra', 'reg': 'sféry', 'sphere': True, 'ses': ['s-2011-12-21', 's-2020-07-17', 's-2025-03-01'],
     'who': [x for x in (BY_NORM.get('kung lao'), BY_NORM.get('lei wu-long'), BY_NORM.get('wang fei-hung'), BY_NORM.get('lord ryden')) if x]})

# ---------------------------------------------------------------- frakce a organizace
for f in W['factions']:
    eid = 'f-' + slug(f['name'])
    mem = []
    for m in f.get('members') or []:
        mid = BY_NORM.get(norm(m)) or BY_NORM.get(norm(m.split(' ')[0]))
        mem.append([m, mid])
    add({'id': eid, 't': 'frakce', 'n': f['name'], 'fn': None, 'al': [], 's': first_sentence(f.get('desc')), 'd': f.get('desc', ''),
         'img': None, 'kind': f.get('kind'), 'strana': f.get('kind') if f.get('kind') in ('spojenec', 'nepřítel') else None,
         'mem': mem, 'ses': []})

# ---------------------------------------------------------------- pojmy: předměty a artefakty z dat
for a in W['artifacts']:
    eid = 'p-' + slug(a['name'])
    own = a.get('owner')
    add({'id': eid, 't': 'pojem', 'n': a['name'], 'fn': None, 'al': [], 's': first_sentence(a.get('desc')), 'd': a.get('desc', ''),
         'img': None, 'kind': 'předmět', 'own': [own, BY_NORM.get(norm(own or '')) or BY_NORM.get(norm((own or '').split(' ')[0]))] if own else None,
         'ses': []})

# ---------------------------------------------------------------- vazby osob na kapitoly
for e in ENT.values():
    e['ch'] = sorted({CH_OF_SES[s] for s in e.get('ses', []) if s in CH_OF_SES} | set(e.pop('chx', []) or []), key=CH_ORDER.index)

# ---------------------------------------------------------------- odkazy x: v textu kapitol (první výskyt v odstavci)
LETTER = 'a-zA-ZáčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ'
SUF = r'(?:a|e|u|i|y|o|ou|em|ovi|ův|ova|ovu|ovo|ovy|ově|ově|ům|ech|ami|ách|í|ím|ích|ího|ému|ěm|ích)?'
STOP = {'devátá', 'port', 'chrám', 'sever', 'jih', 'údolí', 'hora', 'klec', 'dračí', 'stín', 'temní', 'pyramida', 'rada', 'osmička', 'zesion', 'lovci',
        'kniha', 'královna', 'král', 'lord', 'lady', 'mistr', 'pán', 'paní', 'velká', 'velký', 'bílý', 'černý', 'zelený', 'rudá', 'rudý', 'stříbrný',
        'druhá', 'první', 'nový', 'nová', 'staré', 'starý', 'smrt', 'bitva', 'arena', 'aréna', 'drak', 'draci', 'věž', 'brána', 'loď', 'město',
        'svatý', 'svatá', 'princ', 'princové', 'sedm', 'tři', 'dva', 'jeden', 'kapitán', 'generál', 'baron', 'sir', 'otec', 'matka', 'syn', 'dcera'}


STOP = {norm(x) for x in STOP}
TITLES = {norm(x) for x in ('baron', 'král', 'královna', 'lord', 'lady', 'kapitán', 'generál', 'velekněžka', 'velekněz', 'mistr', 'princ', 'princezna', 'admirál', 'sir', 'císař', 'císařovna', 'chán', 'upír', 'drak')}
PLAYERS = {norm(x) for x in ('Pepa', 'Pepy', 'Pepovi', 'Pepou', 'Lukáš', 'Lukáše', 'Tomáš', 'Tomáše', 'Venca', 'Vency', 'Vojta', 'Vojty', 'Terka', 'Terky', 'Terčin', 'Jana', 'Jany', 'Janin', 'Zdeněk', 'Zdeňka', 'Pán')}
PLACE_NAMES = set()


def tok_pat(tok):
    t = re.escape(tok)
    if len(tok) >= 5 and tok[-1].lower() in 'aeiouyáéěíóúůý':
        return re.escape(tok[:-1]) + '[a-záčďéěíňóřšťúůýž]{0,3}'
    return t + SUF


def name_pats(e):
    pats = []
    names = [e['n'], *[a for a in (e.get('al') or []) if norm(a) not in PLACE_NAMES or e['t'] == 'misto']]
    if e.get('fn'): names.append(e['fn'])
    for nm in names:
        nm = re.sub(r'[„“"()]', ' ', nm).strip()
        toks = [t for t in nm.split() if t]
        while len(toks) > 1 and norm(toks[0]) in STOP | TITLES:
            toks = toks[1:]
        if not toks or not toks[0][:1].isupper():
            continue
        if len(toks) == 1 and (len(toks[0]) < 4 and e['n'] != 'Ho' or norm(toks[0]) in STOP):
            continue
        pats.append(r'\s+'.join(tok_pat(t) for t in toks))
    # samotné křestní jméno u víceslovných jmen osob, pokud je jednoznačné (doplní se níž)
    return pats


PLACE_NAMES |= {norm(e['n']) for e in ENT.values() if e['t'] == 'misto'}
FIRST = {}
for e in ENT.values():
    if e['t'] != 'osoba': continue
    toks = re.sub(r'[„“"()]', ' ', e['n']).split()
    if len(toks) >= 2 and len(toks[0]) >= 4 and toks[0][:1].isupper() and norm(toks[0]) not in STOP:
        FIRST.setdefault(toks[0], set()).add(e['id'])
ONLY_N = {norm(e['n']) for e in ENT.values()}

# priorita: postavy a svědci > místa > vedlejší postavy; delší vzory dřív
MATCH = []
for e in ENT.values():
    if e['t'] not in ('osoba', 'misto'):
        continue
    pr = 0 if (e.get('pc') or e.get('wit') or e.get('kind') in ('pruvodce', 'protivnik')) else (1 if e['t'] == 'misto' else 2)
    ps = name_pats(e)
    toks = re.sub(r'[„“"()]', ' ', e['n']).split()
    if e['t'] == 'osoba' and len(toks) >= 2 and len(FIRST.get(toks[0], ())) == 1 and norm(toks[0]) not in ONLY_N:
        ps.append(tok_pat(toks[0]))
    for p in ps:
        MATCH.append((pr, -len(p), p, e['id']))
MATCH.sort()
# jména, která sdílí víc hesel stejné priority, vynechat (nejednoznačná)
seen_p = {}
for pr, _, p, eid in MATCH:
    seen_p.setdefault(p, set()).add((pr, eid))
RX = []
for pr, _, p, eid in MATCH:
    best = min(x[0] for x in seen_p[p])
    if pr != best or len({x[1] for x in seen_p[p] if x[0] == best}) > 1:
        continue
    RX.append((re.compile(rf'(?<![{LETTER}])({p})(?![{LETTER}])'), eid))

LINK = re.compile(r'\[([^\]]+)\]\(([a-z]):([^)]+)\)')
CH_HITS = {}  # heslo → kapitoly, kde se jméno v textu objevuje
LINK_ENT = {'w': {e['wit']: e['id'] for e in ENT.values() if e.get('wit')}, 'c': CHAR_ENT, 'm': {e['m3']: e['id'] for e in ENT.values() if e.get('m3')}}


def annotate(text, chid):
    # chránit existující odkazy
    keep = []

    def hold(m):
        keep.append(m.group(0))
        k, i = m.group(2), m.group(3)
        eid = LINK_ENT.get(k, {}).get(i)
        if eid: CH_HITS.setdefault(eid, set()).add(chid); used.add(eid)
        return f'\x00{len(keep) - 1}\x00'
    used = set()
    t = LINK.sub(hold, text)
    for rx, eid in RX:
        if eid in used:
            m = rx.search(t)
            if m: CH_HITS.setdefault(eid, set()).add(chid)
            continue
        m = rx.search(t)
        if not m:
            continue
        # nezasahovat do chráněných míst a nespojovat dvě jména
        s, e2 = m.span(1)
        if '\x00' in t[s:e2] or norm(m.group(1)) in PLAYERS:
            continue
        used.add(eid); CH_HITS.setdefault(eid, set()).add(chid)
        keep.append(f'[{m.group(1)}](x:{eid})')
        t = t[:s] + f'\x00{len(keep) - 1}\x00' + t[e2:]
    for _ in range(3):
        t = re.sub(r'\x00(\d+)\x00', lambda mm: keep[int(mm.group(1))], t)
    return t


nx = 0
for chid, blocks in V['chapters'].items():
    for b in blocks:
        if 'p' in b:
            b['p'] = annotate(re.sub(r'\[([^\]]+)\]\(x:[^)]+\)', r'\1', b['p']), chid)
            nx += b['p'].count('](x:')
for eid, chs in CH_HITS.items():
    e = ENT[eid]
    e['ch'] = sorted(set(e['ch']) | chs, key=CH_ORDER.index)

# ---------------------------------------------------------------- zápis lexikonu
for e in ENT.values():
    for k in [k for k, v in e.items() if v in (None, [], '', False)]:
        del e[k]
    e['ses'] = e.get('ses', [])[:40]
    if 'ses' in e and not e['ses']: del e['ses']
ents = sorted(ENT.values(), key=lambda e: norm(e['n']).lstrip('„"'))
lex = {'n': len(ents), 'entries': ents, 'byWit': LINK_ENT['w'], 'byChar': CHAR_ENT,
       'chTitle': {c['id']: c['title'] for b in B for c in b['chapters']}}


def dump(name, obj):
    txt = json.dumps(obj, ensure_ascii=False, separators=(',', ':'))
    open(OUT + name, 'w', encoding='utf-8').write(txt)
    print(f'  {name:22s} {len(txt) // 1024:5d} kB')


dump('lexikon.json', lex)
dump('vypraveni.json', V)
from collections import Counter  # noqa: E402
cnt = Counter(e['t'] for e in ents)
print(f"lexikon: {cnt['osoba']} osob, {cnt['misto']} míst, {cnt['frakce']} frakcí, {cnt['pojem']} pojmů; hover odkazů v textu: {nx}")

# ---------------------------------------------------------------- vyhledávací index
IX = []


def ix(k, eid, t, sub, x, h):
    IX.append([k, t, sub, re.sub(r'\s+', ' ', x or '').strip()[:1200], h])


for b in B:
    for c in b['chapters']:
        ix('kap', c['id'], c['title'], f"{b['kap']} · {c['real']} u stolu", '', '#' + c['id'])
        for i, bl in enumerate(V['chapters'].get(c['id'], [])):
            txt = strip_links(bl.get('p') or bl.get('q') or '')
            ix('odst', c['id'], c['title'], f"{b['kap']} · odstavec {i + 1}" + (f" · citace, {bl.get('kdo')}" if 'q' in bl else ''), txt, '#' + c['id'])
for s in S:
    ix('ses', s['id'], s['title'], f"sezení {s.get('date_label', '')} · {s.get('dr_label', '')}",
       ' '.join([s.get('summary') or '', ' '.join(s.get('highlights') or []), ' '.join(s.get('npcs') or [])]), '#' + s['id'])
for e in ents:
    k = {'osoba': 'os', 'misto': 'mi', 'frakce': 'fr', 'pojem': 'po'}[e['t']]
    sub = {'os': 'osoba', 'mi': 'místo', 'fr': 'frakce', 'po': 'pojem'}[k]
    if e.get('stav') in ('padl', 'zmizel'): sub += ' · ' + e['stav']
    if e.get('grp'): sub += ' · ' + e['grp']
    elif e.get('reg'): sub += ' · ' + e['reg']
    ix(k, e['id'], e['n'], sub, ' '.join([' '.join(e.get('al', [])), e.get('fn', ''), e.get('s', ''), e.get('d', '')[:500]]), '#lx/' + e['id'])
for bt in W['battles']:
    ix('bit', bt['id'], bt['name'], f"bitva · {bt.get('place', '')} · {bt.get('dr', '')} DR", (bt.get('summary') or '') + ' ' + (bt.get('outcome') or ''), '#' + bt['id'])
for ci, c in enumerate(P['chapters']):
    for vi, v in enumerate(c['verses']):
        t = ' / '.join(v['t'])
        ix('ver', f'pv-{ci + 1}-{vi}', t[:70], f"Alaundovo proroctví · kapitola {['I', 'II', 'III'][ci]}" + (f" · {v['who']}" if v.get('who') else ''), t + ' ' + (v.get('who') or ''), f'#pv-{ci + 1}-{vi}')
for w in SV:
    ix('sv', w['id'], w['jmeno'], f"svědectví · {w['role']}", ' '.join(w.get('titulky') or w['text']), f"#svedectvi/{w['id']}")
dump('search.json', {'v': 1, 'items': IX})
print(f'hledání: {len(IX)} položek')

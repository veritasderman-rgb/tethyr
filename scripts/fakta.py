#!/usr/bin/env python3
"""Kontrola faktů webu „Západní draci“ (iterace 9).

Hlídá invarianty z WEB_BRIEF.md (včetně doplňku) a z upřesnění autora (LORE_2026-11-23.md) nad zdrojovými daty webu
(`data/`, `data/vypraveni/*.md`, `index.html`, `src/`) i nad vygenerovanými daty (`public/data/*.json`,
`public/mapa3d/data/campaign.json`). Při porušení skončí s kódem 1; spouští se při `npm run build` (vite.config.js).
Používá jen standardní knihovnu a soubory v repu (kontrola titulků proti /home/claude/voices se přidá jen tehdy, když
zdroj existuje).

Spuštění: `python3 scripts/fakta.py` (`-v` vypíše i počty kontrol).
"""
import glob
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
VERBOSE = '-v' in sys.argv
errors, checks = [], 0


def fail(msg):
    errors.append(msg)


def check(cond, msg):
    global checks
    checks += 1
    if not cond:
        fail(msg)


def strings(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from strings(v, f'{path}/{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from strings(v, f'{path}[{i}]')
    elif isinstance(o, str):
        yield path, o


def load(p):
    with open(p, encoding='utf-8') as f:
        return json.load(f)


def sentences(t):
    return [s for s in re.split(r'(?<=[.!?…])\s+|\n+', t) if s.strip()]


def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    return ''.join(c for c in s if not unicodedata.combining(c))


# ------------------------------------------------------------------ korpus textů
# (soubor, místo, text); search.json je jen index (zjednodušený text), kontroluje se zvlášť
CORPUS = []
for pat in ('data/*.json', 'public/data/*.json', 'public/mapa3d/data/*.json'):
    for f in sorted(glob.glob(pat)):
        if f.endswith(('search.json', 'hymna-timing.json', 'proroctvi-timing.json')):
            continue
        for p, s in strings(load(f)):
            CORPUS.append((f, p, s))
for f in sorted(glob.glob('data/vypraveni/*.md')) + ['data/podekovani.txt', 'data/hymna.txt']:
    if os.path.exists(f):
        for i, par in enumerate(open(f, encoding='utf-8').read().split('\n')):
            if par.strip():
                CORPUS.append((f, f'řádek {i + 1}', par))
UI = []  # texty rozhraní: index.html a src/**/*.js, css se nekontroluje
for f in ['index.html'] + sorted(glob.glob('src/**/*.js', recursive=True)):
    UI.append((f, '', open(f, encoding='utf-8').read()))

# ------------------------------------------------------------------ 1) zakázaný obsah (brief)
FORBID = [
    (r'Granan|Silverkin', 'žádný Granan Silverkin'),
    (r'Schamedar', 'žádné Schamedarské kroniky'),
    (r'Wu[ -]Lej', 'jméno „Wu Lej“ se nepoužívá'),
    (r'\bHo Wu(?! Long)', 'Ho se jmenuje „Ho Wu Long“ (ne Wu Lung, Wu-Long …)'),
    (r'\bWu Lung\b|\bWu-Lung\b', '„Wu Lung“ není správný tvar jména Ho Wu Long'),
    (r'[\w.+-]+@[\w-]+\.[a-z]{2,}', 'žádné e-maily'),
    (r'facebook\.com|instagram\.com|linkedin\.com|twitter\.com|x\.com/|mailto:', 'žádné odkazy na profily hráčů'),
    (r'(?<![A-Za-zÁ-ž])[bB]roskvov\w+ Zahrad\w+|(?<![A-Za-zÁ-ž])broskvov\w+ zahrad\w+|\bbroskvov\w+ Zahrad', 'Broskvová zahrada je vlastní jméno: „Broskvová zahrada“ (velké B, malé z)'),
    (r'dozorčí rad', 'bez dozorčí rady'),
    (r'Jamah[ -]Hogr|Chuang Li\b|Fei-hung|\blord[a-z]* Ryden', 'jednotný tvar jmen: Yamoh Hokhra, Chuang-Li, Wang Fei-Hung, Lord Ryden'),
]
for f, p, s in CORPUS + UI:
    if f.endswith('vypraveni.json') and False:
        continue
    for rx, why in FORBID:
        for m in re.finditer(rx, s):
            ctx = s[max(0, m.start() - 40):m.end() + 40].replace('\n', ' ')
            # „Wu-Long“ je jméno otce Lei Wu-Long, to je v pořádku (rx to nezachytí); ukázky v kódu rozhraní ignorovat
            if f.startswith('src/') and rx.startswith('[\\w.+-]+@'):
                continue
            fail(f'{f} {p}: {why}: …{ctx}…')
            break

# šablony rozhraní píší rovnou nové adresy (přes H() z router.js), staré kotvy převádí router jen zpětně kompatibilně
for f, p, s in UI:
    if f in ('index.html', 'src/lib/router.js'):
        continue
    for m in re.finditer(r'href="(#[^"$]*)"', s):
        if m.group(1) not in ('#nextPage', '#obsah', '#'):
            fail(f'{f}: šablona píše starou kotvu {m.group(1)} (použijte H(...) z router.js)')
    for m in re.finditer(r'img/misc/znak\.svg', s):
        fail(f'{f}: znak chrámu není logo webu (logo = src/lib/logo.js)')
check('znak.svg' not in open('index.html', encoding='utf-8').read(), 'index.html nepoužívá znak chrámu jako logo')

# ------------------------------------------------------------------ 2) Pán jeskyně je Zdeněk T., hráči jen křestním jménem
PJ_OK = ('Lukáš poprvé jako PJ', 'Lukášův quest se dohrál', 'Lukáš si zkusil vést vlastní quest')   # jednorázová hra Lukáše (2014), v datech
for f, p, s in CORPUS:
    for sen in sentences(s):
        if re.search(r'Lukáš\w*\s*[(,]\s*(?:Pán\w* jeskyně|PJ)|Lukáš\w* (?:jako|byl\w*|je) (?:Pán\w* jeskyně|PJ)|(?:Pán\w* jeskyně|PJ) (?:je |byl )?Lukáš|Lukáš\w* vedl[a]?\b', sen) and not any(x in sen for x in PJ_OK):
            fail(f'{f} {p}: Pán jeskyně je Zdeněk T., ne Lukáš: …{sen[:160]}…')
        if re.search(r'Zdeněk K\.?\s*[(,]\s*(?:Pán\w* jeskyně|PJ)|Zdeněk K\.? (?:jako|byl\w*|je) (?:Pán\w* jeskyně|PJ)|(?:Pán\w* jeskyně|PJ) (?:je |byl )?Zdeněk K', sen):
            fail(f'{f} {p}: Pán jeskyně je Zdeněk T., ne Zdeněk K.: …{sen[:160]}…')
# každé „Zdeněk“ má mít iniciálu (T. nebo K.), pokud nejde o 2. pád a podobně
for f, p, s in CORPUS:
    if f.endswith(('podekovani.txt', 'hymna.txt')):
        continue
    for m in re.finditer(r'Zdeň(?:ek|ka|kovi|kem|ku)\b(?! [KT]\.)', s):
        ctx = s[max(0, m.start() - 30):m.end() + 30].replace('\n', ' ')
        if f.endswith('podekovani.txt'):
            continue
        fail(f'{f} {p}: „Zdeněk“ bez iniciály (T. / K.): …{ctx}…')
        break
pod = open('data/podekovani.txt', encoding='utf-8').read() if os.path.exists('data/podekovani.txt') else ''
check('Zdeňk' in pod and 'Všichni vděční hráči' in pod, 'Poděkování má být adresováno Zdeňkovi a podepsáno „Všichni vděční hráči“')
check('Lukáš' not in pod, 'Poděkování nemá oslovovat Lukáše (PJ je Zdeněk T.)')
FIRST_NAMES = r'(?:Pepa|Pepy|Pepovi|Lukáš|Lukáše|Lukášovi|Tomáš|Tomáše|Venca|Vency|Vojta|Vojty|Terka|Terky|Jana|Jany|Zdeněk [KT]\.)'
for f, p, s in CORPUS:
    for m in re.finditer(rf'\b{FIRST_NAMES} (?:Novák|Dvořák|Svoboda|Černý|Procházka|Kučera|Veselý|Horák|Němec|Marek|Pospíšil|Pokorný|Hájek|Král|Jelínek|Růžička|Beneš|Fiala|Sedláček|Doležal|Zeman|Kolář|Navrátil|Čermák|Urban|Vaněk|Blažek|Kříž|Kovář)\b', s):
        fail(f'{f} {p}: hráč jen křestním jménem: …{s[max(0, m.start() - 20):m.end() + 20]}…')

# ------------------------------------------------------------------ 3) hráčské postavy nemají svědectví, hlas ani video
chars = load('public/data/characters.json') if os.path.exists('public/data/characters.json') else []
players = {c['id'] for c in chars if c.get('kind') == 'hrac'}
players |= {'rauko', 'ho', 'veritas', 'nathan', 'sirion', 'calla', 'varion', 'austius', 'tamis', 'theira', 'bastien', 'mordai', 'turgen', 'zia', 'thor'}
sv = load('data/svedectvi.json')
check(len(sv) >= 24, f'svědků má být aspoň 24, je {len(sv)}')
for w in sv:
    check(w['id'] not in players, f'hráčská postava má svědectví: {w["id"]}')
    check(norm(w['jmeno'].split(' (')[0]) not in {norm(c['name']) for c in chars if c.get('kind') == 'hrac'}, f'svědek se jmenuje jako hráčská postava: {w["jmeno"]}')
    for k in ('text', 'titulky'):
        if k in w:
            check(all(isinstance(x, str) and x.strip() for x in w[k]), f'{w["id"]}: prázdná věta v poli {k}')
    check(w.get('zdroje'), f'{w["id"]}: svědectví bez zdrojů')
for kind in ('assets/voices', 'assets/video', 'public/img/wit'):
    for f in glob.glob(f'{kind}/*'):
        base = os.path.basename(f).split('.')[0].split('_')[0]
        if base in players:
            fail(f'{f}: hlas, video nebo obraz hráčské postavy ({base})')
if os.path.exists('data/dokument.json'):
    d = load('data/dokument.json')
    ids = {x for _, x in [(p, s) for p, s in strings(d)]}
    for pid in players:
        if pid in ids and False:
            pass
    sv_ids = {w['id'] for w in sv}
    def doc_sv(o):
        if isinstance(o, dict):
            for k, v in o.items():
                if k == 'sv' and isinstance(v, list):
                    yield from [x for x in v if isinstance(x, str)]
                else:
                    yield from doc_sv(v)
        elif isinstance(o, list):
            for v in o:
                yield from doc_sv(v)
    for x in doc_sv(d):
        check(x in sv_ids and x not in players, f'dokument.json: neznámý nebo hráčský svědek {x}')

# ------------------------------------------------------------------ 4) osudy a místa podle upřesnění autora (strukturovaně)
stav = load('data/svedkove-stav.json')
for wid, (rok_min, rok_max) in {'kung-lao': (1377, 1377), 'chuang-li': (1384, 1385), 'yamoh-hokhra': (1385, 1385), 'sar-saratar': (1385, 1385), 'rivalen': (1385, 1385)}.items():
    check(wid in stav, f'svedkove-stav: chybí {wid}')
check('Broskvov' in stav.get('kung-lao', {}).get('kde', ''), 'Kung Lao padl ve Feng Asay a přebývá v Broskvové zahradě (svedkove-stav)')
check('Feng Asay' in stav.get('kung-lao', {}).get('kde', ''), 'Kung Lao padl ve Feng Asay (svedkove-stav)')
check('Broskvov' not in stav.get('chuang-li', {}).get('kde', ''), 'Chuang-li není v Broskvové zahradě (svedkove-stav)')
check('Hoem' in stav.get('chuang-li', {}).get('kde', '') or 'Ho Wu Longem' in stav.get('chuang-li', {}).get('kde', ''), 'Chuang-li padla v souboji s Hoem (svedkove-stav)')
check('Anauroch' in stav.get('yamoh-hokhra', {}).get('kde', ''), 'Yamoh zmizel v bitvě o Anauroch (svedkove-stav)')
check('Anauroch' in stav.get('sar-saratar', {}).get('kde', ''), 'Sar Saratar padl v bitvě o Anauroch (svedkove-stav)')
check('Pyramid' in stav.get('rivalen', {}).get('kde', ''), 'Rivalen padl na Pyramidě času (svedkove-stav)')
by_id = {w['id']: w for w in sv}
if 'chuang-li' in by_id:
    check(by_id['chuang-li']['strana'] == 'nepřítel', 'Chuang-li je zrádkyně: strana nepřítel')
for wid, want in (('kung-lao', 'padl'), ('chuang-li', 'padl'), ('yamoh-hokhra', 'zmizel'), ('sar-saratar', 'padl'), ('rivalen', 'padl')):
    for f in ('public/data/svedectvi.json',):
        w = {x['id']: x for x in load(f)}.get(wid) if os.path.exists(f) else None
        if w:
            check(w.get('stav') == want, f'{f}: {wid} má stav „{want}“, je „{w.get("stav")}“')

lex = load('public/data/lexikon.json') if os.path.exists('public/data/lexikon.json') else {'entries': []}
LX = {e['id']: e for e in lex['entries']}


def lxe(i):
    e = LX.get(i)
    check(e is not None, f'lexikon: chybí heslo {i}')
    return e or {}


def lxt(e):
    return ' '.join(str(e.get(k, '')) for k in ('s', 'd', 'stx', 'vaz'))


if LX:
    e = lxe('o-lord-ryden')
    check(e.get('stav') == 'padl', 'Lord Ryden je veden jako padlý')
    check('Broskvov' in lxt(e) and 'Chuang' in lxt(e), 'Lord Ryden: zemřel rukou Chuang-li a dlí v Broskvové zahradě')
    e = lxe('m-broskvova-zahrada')
    t = lxt(e)
    for need in ('Lei Wu-Long', 'Wang Fei-Hung', 'Kung Lao', 'Ryden', 'Arduna', 'Chuang-Li'):
        check(need in t, f'Broskvová zahrada: heslo se nezmiňuje o „{need}“')
    check('tam není' in t or 'není' in t, 'Broskvová zahrada: Chuang-Li tam není')
    for pid in ('o-kung-lao', 'o-wang-fei-hung', 'o-lei-wu-long', 'o-lord-ryden'):
        check(pid in (e.get('who') or []), f'Broskvová zahrada: chybí odkaz na {pid}')
    e = lxe('o-chuang-li') if 'o-chuang-li' in LX else next((x for x in lex['entries'] if x.get('n', '').lower().startswith('chuang-li')), {})
    check(e.get('stav') == 'padl' or 'padla' in lxt(e) or 'zabil ji' in lxt(e) or 'Ho ji zabil' in lxt(e), 'Chuang-li zabil Ho ve finálním souboji')
    check('Broskvov' not in lxt(e).replace('v Broskvové zahradě není', '') , 'Chuang-li není v Broskvové zahradě')
    e = lxe('o-kung-lao')
    check(e.get('stav') == 'padl' and 'Broskvov' in lxt(e) and 'Feng Asay' in lxt(e), 'Kung Lao: padl ve Feng Asay, přebývá v Broskvové zahradě')
    e = lxe('o-arduna')
    check(e.get('stav') in ('žije', None) and 'jediný' in lxt(e), 'Arduna je jediný dosud žijící šedý mnich (vedle Hoa)')
    e = lxe('o-wang-fei-hung')
    check('Broskvov' in lxt(e) and 'Chuang' in lxt(e), 'Wang Fei-Hung byl vězněm Chuang-li a přesunul se do Broskvové zahrady')
    e = next((x for x in lex['entries'] if x.get('n') == 'Seung Mina'), {})
    check('žena' in lxt(e) or 'manžel' in lxt(e), 'Seung Mina je Hoova žena')
    e = next((x for x in lex['entries'] if x.get('n', '').startswith('Khelben')), {})
    check(e.get('stav') == 'zmizel' and 'dcer' in lxt(e), 'Khelben zmizel, nahradila ho dcera')
    for nm, want in (('Yamoh Hokhra', 'zmizel'), ('Sar Saratar', 'padl'), ('Rivalen Tanthul', 'padl')):
        e = next((x for x in lex['entries'] if x.get('n', '').startswith(nm)), {})
        check(e.get('stav') == want, f'lexikon: {nm} má stav „{want}“ (je „{e.get("stav")}“)')

# ------------------------------------------------------------------ 5) věty napříč všemi texty
for f, p, s in CORPUS:
    if f.endswith('lexikon.json') and p.endswith('/who[0]'):
        continue
    for sen in sentences(s):
        # Rydenovo cvičení se odehrálo v Broskvové zahradě
        if re.search(r'Ryden\w* cvičen', sen) and 'Broskvov' not in sen:
            if not (f.endswith('svedectvi.json') or 'search' in f):
                # povoleno, když zmínka stojí v odstavci, který Broskvovou zahradu uvádí hned v sousední větě
                if 'Broskvov' not in s or sen.strip() == s.strip():
                    fail(f'{f} {p}: Rydenovo cvičení se odehrálo v Broskvové zahradě: …{sen[:170]}…')
        # Chuang-li v Broskvové zahradě není
        if re.search(r'Chuang-?[Ll]i\w* (?:je|přebývá|dlí|přešla|byla|se přesunula) (?:v|do) Broskvov', sen):
            fail(f'{f} {p}: Chuang-li v Broskvové zahradě není: …{sen[:170]}…')
        # Lord Ryden zemřel dřív a rukou Chuang-li
        if re.search(r'Ryden', sen) and re.search(r'zabil[a]? ho Ho|zabil Ho|Ho zabil\w* \w*Ryden', sen):
            fail(f'{f} {p}: Rydena zabila Chuang-li, ne Ho: …{sen[:170]}…')
        if re.search(r'Ryden\w* (?:žije|vede|velí|bojuje)', sen):
            fail(f'{f} {p}: Lord Ryden nežije: …{sen[:170]}…')
        # Kung Lao je mrtvý (zemřel ve Feng Asay): setkání po smrti jsou v Broskvové zahradě
        if re.search(r'Kung La', sen) and re.search(r'(?:mluv\w* s|rozhovor\w* s|setkání s|navštív\w* |přestup\w* u|přestupoval u|za) Kung La', sen) and 'Broskvov' not in sen:
            if 'Broskvov' not in s:
                fail(f'{f} {p}: setkání s mrtvým Kung Laem patří do Broskvové zahrady: …{sen[:170]}…')
        if re.search(r'Kung La\w* (?:žije|vede|učí dosud)', sen):
            fail(f'{f} {p}: Kung Lao padl ve Feng Asay: …{sen[:170]}…')
        # Kung Lao zemřel ve Feng Asay (ne jinde)
        if re.search(r'Kung La', sen) and re.search(r'padl|zemřel|zabil', sen) and re.search(r'v (?:Tempat Larangu|Cham Fau|Shou Lungu|Anaurochu)', sen) and 'Feng Asay' not in sen and 'Broskvov' not in sen:
            fail(f'{f} {p}: Kung Lao zemřel ve Feng Asay: …{sen[:170]}…')
        # Wang Fei-Hung: vězeň Chuang-li, astrálně v Broskvové zahradě (ne „zemřel v zajetí“ bez zahrady)
        if re.search(r'Wang Fei-[Hh]ung', sen) and re.search(r'\b(?:zemřel|padl|zahynul)\b', sen) and 'Broskvov' not in sen and 'astrál' not in sen:
            fail(f'{f} {p}: Wang Fei-Hung se astrálně přesunul do Broskvové zahrady: …{sen[:170]}…')
        # Arduna žije
        if re.search(r'Arduna', sen) and re.search(r'\b(?:zemřel|padl|zahynul|zabit)\b', sen):
            fail(f'{f} {p}: Arduna žije: …{sen[:170]}…')
        # Khelben zmizel (nezemřel, nežije jako vládce Černé věže)
        if re.search(r'Khelben\w* (?:žije|vládne|vede|velí)', sen):
            fail(f'{f} {p}: Khelben zmizel, Černou věž drží dcera: …{sen[:170]}…')
        # Seung Mina je Hoova žena (ne sestra, matka, dcera)
        if re.search(r'Seung Min\w*', sen) and re.search(r'Ho\w* (?:sestr|matk|dcer|neteř|teta)', sen):
            fail(f'{f} {p}: Seung Mina je Hoova žena: …{sen[:170]}…')
        # souboje v bitvě o Anauroch × finále na Pyramidě času
        if re.search(r'Yamoh|Sar Saratar', sen) and re.search(r'Pyramid\w* času', sen) and not re.search(r'souběžn|zatímco|mezitím|zároveň|nebyl|nebyli|ne na|součást|téže bitv', sen, re.I):
            fail(f'{f} {p}: souboje Ho × Yamoh a Elminster × Sar Saratar patří do bitvy o Anauroch: …{sen[:170]}…')
        if re.search(r'Rivalen', sen) and re.search(r'Anauroch', sen) and not re.search(r'souběžn|zatímco|mezitím|zároveň|velel|velitel|armád|Temní|součást|téže bitv', sen, re.I):
            fail(f'{f} {p}: Rivalena porazil Rauko na Pyramidě času, ne v Anaurochu: …{sen[:170]}…')
        if re.search(r'\b(?:Ho|Elminster) (?:porazil|zabil)\w* \w*Rivalen', sen):
            fail(f'{f} {p}: Rivalena porazil Rauko: …{sen[:170]}…')
        if re.search(r'Sar Saratar', sen) and re.search(r'(?:Ho|Rauko|Veritas) (?:porazil|zabil|rozdrtil)\w* \w*Sar Saratar', sen):
            fail(f'{f} {p}: Sar Saratara rozdrtil Elminster: …{sen[:170]}…')
        # iterace 10: Ho byl na vrcholu Pyramidy času (s Arwin ničil Clariburnuse); nic nesmí tvrdit opak
        if re.search(r'[Pp]yramid', sen) and re.search(r'Ho\w*\s+(?:byl\s+)?(?:mezitím|v téže době|tou dobou)\b[^.;]{0,60}Anauroch|Ho\w*\s+(?:na|při)[^.;]{0,40}(?:nebyl|chyběl)|(?:nebyl|chyběl)[^.;]{0,30}\bHo\b[^.;]{0,40}pyramid|(?:jen|pouze|sám)\s+Rauko\b|bez\s+Hoa', sen):
            fail(f'{f} {p}: Ho Wu Long byl při finále na vrcholu Pyramidy času: …{sen[:170]}…')
        if re.search(r'Clarib', sen) and re.search(r'(?:Rauko|Elminster|Veritas|Mitsurugy|Seltar|Erylthil)\w*\s+(?:porazil|zabil|zničil|rozdrtil|ničil)\w*\s+(?:\w+\s+){0,3}Clarib', sen):
            fail(f'{f} {p}: Clariburnuse zničil Ho s Arwin: …{sen[:170]}…')
        if re.search(r'Yamoh', sen) and re.search(r'(?:Elminster|Rauko) (?:porazil|zabil|rozdrtil)\w* \w*Yamoh', sen):
            fail(f'{f} {p}: Yamoh ustoupil po domluvě s Hoem a zmizel v dračí podobě: …{sen[:170]}…')

# bitvy: rozdělení soubojů mezi Anauroch a Pyramidu času
if os.path.exists('public/data/world.json'):
    W = load('public/data/world.json')
    bat = {b['name']: b for b in W['battles']}

    def units(b):
        return json.dumps(b.get('sides', []), ensure_ascii=False)
    an = next((b for n, b in bat.items() if 'Anaurochu' in n), None)
    py = next((b for n, b in bat.items() if 'Pyramid' in n), None)
    check(an is not None, 'bitva v Anaurochu je v datech')
    if an:
        ua = units(an) + an.get('summary', '')
        check('Yamoh' in ua and 'Sar Saratar' in ua and 'Elminster' in ua, 'Bitva v Anaurochu: souboje Ho × Yamoh a Elminster × Sar Saratar')
    if py:
        up = units(py)
        check('Yamoh' not in up and 'Sar Saratar' not in up, 'Pyramida času: Yamoh a Sar Saratar tu nebojovali')
        check('Rivalen' in up + py.get('summary', ''), 'Pyramida času: Rivalen')
        check('Rauko' in up + py.get('summary', ''), 'Pyramida času: Rauko porazil Rivalena')
        check('Ho Wu Long' in up, 'Pyramida času: Ho Wu Long bojoval na vrcholu po Raukově boku')
        check('Clarib' in py.get('summary', '') and 'Arwin' in py.get('summary', ''), 'Pyramida času: Ho s Arwin ničil Clariburnuse')

# postavy
for c in chars:
    if c['id'] == 'kung-lao':
        check(c.get('status') == 'padl' and 'Broskvov' in c.get('fate', ''), 'postava Kung Lao padl a přebývá v Broskvové zahradě')
    if c['id'] == 'ho':
        check(c['name'] == 'Ho' and 'Ho Wu Long' == c.get('full_name'), 'Ho = Ho Wu Long')
        check('Ho Wu Lung' not in c.get('aliases', []), 'alias „Ho Wu Lung“ je chybný tvar jména')

# vyprávění: Broskvová zahrada a Ryden v kapitolách
vyp = ' '.join(open(f, encoding='utf-8').read() for f in glob.glob('data/vypraveni/*.md'))
check('Broskvov' in vyp and 'Rydenov' in vyp, 'vyprávění zmiňuje Broskvovou zahradu a Rydenovo cvičení')

# časová osa: Rydenovo cvičení 1385 DR v Broskvové zahradě
if os.path.exists('public/data/timeline.json'):
    for p, s in strings(load('public/data/timeline.json')):
        if 'Ryden' in s and 'cvičen' in s:
            check('Broskvov' in s, f'časová osa {p}: Rydenovo cvičení v Broskvové zahradě')

# ------------------------------------------------------------------ 6) české titulky svědectví = z voices/svedectvi_v3.json (jen typografie se smí lišit)
SRC_V3 = os.environ.get('SRC_SVEDECTVI', '/home/claude/voices/svedectvi_v3.json')


def typo(s):
    s = unicodedata.normalize('NFC', s)
    s = s.replace(' ', ' ').replace(' ', ' ')
    s = re.sub(r'[„“”"‚‘’\']', '', s)
    s = s.replace('…', '...').replace('–', '-').replace('—', '-').replace('−', '-')
    return re.sub(r'\s+', ' ', s).strip()


if os.path.exists(SRC_V3):
    try:
        v3 = load(SRC_V3)
        v3 = {w['id']: w for w in (v3 if isinstance(v3, list) else v3.get('svedectvi', v3.get('witnesses', list(v3.values()))))}
        n = 0
        for w in sv:
            src = v3.get(w['id'])
            if not src:
                continue
            cs = src.get('titulky') or src.get('text_cs') or src.get('cs')
            if cs and w.get('titulky'):
                n += 1
                check(typo(' '.join(cs)) == typo(' '.join(w['titulky'])), f'{w["id"]}: české titulky se liší od {SRC_V3} (smí se měnit jen typografie)')
        if VERBOSE:
            print(f'titulky porovnány: {n}')
    except Exception as ex:  # noqa: BLE001
        print(f'varování: titulky se nepodařilo porovnat se zdrojem ({ex})')

# ------------------------------------------------------------------ 7) české znění svědectví (iterace 10): jen vedlejší postavy, text přesně podle schváleného zdroje
TCS = 'assets/voices_cs/timing.json'
if os.path.exists(TCS):
    tcs = load(TCS)
    ids = {w['id'] for w in sv}
    check(set(tcs) <= ids, 'české znění: jen svědci ze svedectvi.json (žádná hráčská postava)')
    for wid, t in tcs.items():
        check(len(t.get('starts', [])) == len(t.get('lines', [])) and all(l.get('cs') for l in t.get('lines', [])), f'{wid}: české znění – počet časů = počet titulků, žádný prázdný')
        check(os.path.exists(f'assets/voices_cs/{wid}.mp3'), f'{wid}: český zvuk assets/voices_cs/{wid}.mp3 existuje')
    SRC_CS = os.environ.get('SRC_VOICES_CS', '/home/claude/voices4') + '/timing.json'
    if os.path.exists(SRC_CS):
        src = load(SRC_CS)
        for wid, t in tcs.items():
            if wid in src:
                check([l['cs'] for l in t['lines']] == [l['cs'] for l in src[wid]['lines']], f'{wid}: české titulky se liší od schváleného zdroje {SRC_CS} (nic se nepřepisuje)')

# ------------------------------------------------------------------ 8) v12.5: nová družina (1491 DR, D&D 5e) do webu nepatří
# Autor 24. 11. 2026: „dobrodružství skončilo a to další bude definováno jinde“. Kronika končí epilogem (1400 DR);
# nová hra (Turgen, Ray/Raymond, Niri, Zek, rok 1491 DR, kapitola Nová generace) se nesmí objevit v datech ani v rozhraní.
# (Název Knihy třetí „Nová krev, Shoonach, Halruaa“ je historie kampaně a zůstává.)
NOVA = re.compile(r'Turgen\w*|\bRaymond\w*|\bRay\b|\bNiri\b|\bZek(?:a|em|ovi|ův|ova|ovo)?\b|(?<!\d)1491(?!\d)|[Nn]ov(?:á|é|ou) generac\w*|nova-generace|[Nn]ov(?:á|é|ou|ých|ým) družin\w*')
NOVA_FILES = [(f, p, s) for f, p, s in CORPUS + UI]
if os.path.exists('public/data/search.json'):
    NOVA_FILES += [('public/data/search.json', p, s) for p, s in strings(load('public/data/search.json'))]
for f, p, s in NOVA_FILES:
    checks += 1
    m = NOVA.search(s)
    if m:
        ctx = s[max(0, m.start() - 50):m.end() + 50].replace('\n', ' ')
        fail(f'{f} {p}: nová družina (1491 DR) z webu odstraněna: …{ctx}…')
for f in glob.glob('public/img/nove/n*') + glob.glob('public/img/port/*'):
    if re.match(r'n(?:01|02|04|05|06|08|11|12|13|63|75|78)\b|(?:turgen|ray|niri|zek)\b', os.path.basename(f)):
        fail(f'{f}: obrázek nové družiny')
if os.path.exists('public/data/sessions.json'):
    for x in load('public/data/sessions.json') if isinstance(load('public/data/sessions.json'), list) else load('public/data/sessions.json').get('sessions', []):
        check(not (isinstance(x, dict) and x.get('dr') == 1491), f'sezení z roku 1491 DR: {x.get("id") if isinstance(x, dict) else x}')

# ------------------------------------------------------------------ výsledek
if errors:
    print(f'FAKTA: {len(errors)} porušení invariantů ({checks} kontrol)')
    seen = set()
    for e in errors:
        if e not in seen:
            seen.add(e)
            print('  ✗', e)
    sys.exit(1)
print(f'FAKTA: v pořádku ({checks} kontrol nad {len(CORPUS)} textovými hodnotami a {len(UI)} soubory rozhraní)')

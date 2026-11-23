#!/usr/bin/env python3
"""Jazyková a typografická kontrola textů psaných pro web (iterace 9). Nekontroluje citace hráčů (řádky `> …` v data/vypraveni/*.md),
mluvený anglický text svědků ani Poděkování (text beze změn). České titulky svědků: smí se měnit jen typografie.
`python3 scripts/jazyk.py` vypíše nálezy; `--strict` skončí chybou při nálezu (tvrdá pravidla); `--fix` opraví typografii v data/vypraveni/*.md."""
import glob, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
STRICT, FIX = '--strict' in sys.argv, '--fix' in sys.argv
NB = ' '
HARD, SOFT = [], []

def hard(f, p, why, ctx): HARD.append(f'{f} {p}: {why}: …{ctx}…')
def soft(f, p, why, ctx): SOFT.append(f'{f} {p}: {why}: …{ctx}…')

STOCK = [r'v srdci\b', r'tapisér', r'nezapomenutel', r'dechberoucí', r'epick', r'bohatá historie', r've víru', r'zrodila se legenda', r'navždy změnil', r'stín na duši',
         r'jako by se zastavil čas', r'ještě netušil', r'nic nebylo jako dřív', r'v neposlední řadě', r'za každou cenu', r'sled(?:ovat|uje) osud', r'hra osudu', r'osudový zvrat',
         r'neuvěřitelný', r'fascinující', r'úchvatn', r'naprosto', r'doslova', r'v podstatě', r'v rámci toho', r'je třeba podotknout', r'nutno dodat', r'jak se říká', r'srdce (?:mu|jí|jim) (?:usedlo|bušilo)']

def lint(f, p, t, check_style=True):
    c = lambda m: t[max(0, m.start() - 30):m.end() + 30].replace('\n', ' ')
    for m in re.finditer(r'(?<![\w„“])"(?=\S)|(?<=\S)"(?![\w])', t): hard(f, p, 'rovné uvozovky místo „ “', c(m))
    for m in re.finditer(r'(?<=\w) - (?=\w)|(?<=\w) -- (?=\w)', t): hard(f, p, 'spojovník místo pomlčky (–)', c(m))
    for m in re.finditer(r'\.\.\.(?!\.)', t): hard(f, p, 'tři tečky místo …', c(m))
    for m in re.finditer(r'  +', t): hard(f, p, 'dvojitá mezera', c(m))
    for m in re.finditer(r'\s[,.;:!?](?=\s|$)', t): hard(f, p, 'mezera před interpunkcí', c(m))
    for m in re.finditer(r'[,;:](?=[A-Za-zÁ-ž])', t):
        if not re.match(r'.*\d[,:]\d', t[max(0, m.start() - 1):m.end() + 2]): hard(f, p, 'chybí mezera po interpunkci', c(m))
    for m in re.finditer(r'\b([A-Za-zÁ-ž]{2,})\s+\1\b', t):
        if m.group(1).lower() not in ('se', 'ho', 'ha', 'la', 'wu', 'kung', 'je', 'to', 'na', 'že'): hard(f, p, 'zdvojené slovo', c(m))
    for m in re.finditer(r'(?<=[a-zěščřžýáíéúůď.!?…])\s[ksvzouaiKSVZOUAI]\s(?=\w)', t): soft(f, p, 'nezlomitelná mezera po jednopísmenné předložce', c(m))
    for m in re.finditer(r'\b\d+\s?(?:DR|let|dní|minut|MB)\b', t):
        if ' ' in m.group(0) and NB not in m.group(0): soft(f, p, 'číslo a jednotka patří k sobě (nezlomitelná mezera)', c(m))
    if check_style:
        for rx in STOCK:
            for m in re.finditer(rx, t, re.I): soft(f, p, 'klišé nebo vata', c(m))

def fix_md(txt):
    out = []
    for line in txt.split('\n'):
        if line.startswith('>') or line.startswith('#') or not line.strip():
            out.append(line); continue
        l = line.replace('...', '…')
        l = re.sub(r'(?<=\w) - (?=\w)', ' – ', l)
        l = re.sub(r'(?<![\w„“])"([^"\n]+)"', r'„\1“', l)
        out.append(l)
    return '\n'.join(out)

for f in sorted(glob.glob('data/vypraveni/*.md')):
    s = open(f, encoding='utf-8').read()
    if FIX:
        n = fix_md(s)
        if n != s: open(f, 'w', encoding='utf-8').write(n); s = n; print('upraveno', f)
    for i, line in enumerate(s.split('\n')):
        if line.startswith('>') or line.startswith('#') or not line.strip(): continue
        lint(f, f'řádek {i + 1}', re.sub(r'\[([^\]]+)\]\([a-z]:[^)]*\)', r'\1', re.sub(r'\{s-[^}]+\}', '', line)))
# data webu psaná pro web: vyprávění, popisky, perexy
def strings(o, path=''):
    if isinstance(o, dict):
        for k, v in o.items(): yield from strings(v, f'{path}/{k}')
    elif isinstance(o, list):
        for i, v in enumerate(o): yield from strings(v, f'{path}[{i}]')
    elif isinstance(o, str): yield path, o
for f in ('public/data/books.json', 'public/data/world.json', 'public/data/timeline.json', 'public/data/prophecy.json'):
    for p, s in strings(json.load(open(f, encoding='utf-8'))):
        if len(s) > 25 and ' ' in s and not re.search(r'/(id|key|img|file)$', p): lint(f, p, s)
sv = json.load(open('data/svedectvi.json', encoding='utf-8'))
for w in sv:
    for k in ('role', 'vazba', 'hlas_popis'): lint('data/svedectvi.json', f'{w["id"]}/{k}', w[k], True)
    for i, t in enumerate(w.get('titulky') or []): lint('data/svedectvi.json', f'{w["id"]}/titulky[{i}]', t, False)
# UI texty: statické řetězce v šablonách
for f in ['index.html'] + glob.glob('src/**/*.js', recursive=True):
    s = open(f, encoding='utf-8').read()
    s = re.sub(r'(?m)^\s*//.*$', '', s)
    for m in re.finditer(r'>([^<>{}`$]{12,}?)<', s):
        t = m.group(1)
        if re.search(r'[ěščřžýáíé]', t): lint(f, '', t.strip())

print(f'jazyk: {len(HARD)} tvrdých nálezů, {len(SOFT)} upozornění')
seen = set()
for kind, lst in (('✗', HARD), ('·', SOFT)):
    for x in lst:
        if x not in seen:
            seen.add(x)
            if kind == '✗' or '-v' in sys.argv or '--all' in sys.argv: print(' ', kind, x[:260])
if STRICT and HARD: sys.exit(1)

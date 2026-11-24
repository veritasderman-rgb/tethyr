#!/usr/bin/env python3
"""Iterace 10: kontrola živé adresy (nebo náhledu). LIVE_URL=https://tethyr-six.vercel.app PW_PROXY=http://127.0.0.1:<port> python3 scripts/live-check.py
Přímý vstup na všechny hlavní adresy, všech 35 kapitol a namátkou svědky, bitvy, hesla Lexikonu a verše (HTTP 200 a žádný chybový stav ani 404),
staré kotvy, hlavičky Cache-Control, /version.json, 404 mimo aplikaci, konzole bez chyb. Snímky do /home/claude/webshots/it10/live/."""
import os, sys, json, random, urllib.request
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
from nav8 import READY
URL = os.environ.get('LIVE_URL', 'https://tethyr-six.vercel.app').rstrip('/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it10/live'); os.makedirs(OUT, exist_ok=True)
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
errs, oks = [], []
def ok(c, msg, extra=''):
    (oks if c else errs).append(msg + ('' if c else f'  ← {extra}'))
    print(('OK   ' if c else 'FAIL ') + msg, '' if c else extra, flush=True)

books = json.load(open(f'{R}/public/data/books.json'))
wit = [w['id'] for w in json.load(open(f'{R}/public/data/svedectvi.json'))]
bat = [b['id'] for b in json.load(open(f'{R}/public/data/world.json'))['battles']]
lex = [e['id'] for e in json.load(open(f'{R}/public/data/lexikon.json'))['entries']]
pro = json.load(open(f'{R}/public/data/prophecy.json'))
random.seed(10)
main = ['/', '/pribeh', '/druzina', '/svedectvi', '/bitvy', '/mapa', '/mapa/3d', '/proroctvi', '/proroctvi/film', '/osa', '/lexikon', '/u-stolu', '/hymna', '/dokument', '/podekovani',
        '/mapa?misto=orofin', '/mapa?kniha=II', '/lexikon?q=%C5%A0ivan', '/druzina/ho', '/druzina/rauko']
chapters = [f"/pribeh/kniha-{i + 1}/{c['id'][3:]}" for i, b in enumerate(books) for c in b['chapters']] + [f'/pribeh/kniha-{i}' for i in range(1, 6)]
sample = [f'/svedectvi/{w}' for w in random.sample(wit, 8)] + [f"/bitvy/{b[2:]}" for b in random.sample(bat, 6)] + [f'/lexikon/{x}' for x in random.sample(lex, 10)] \
    + [f"/proroctvi/{random.randint(1, 3)}-{random.randint(0, 9)}" for _ in range(6)] + ['/svedectvi/elminster', '/bitvy/bitva-v-anaurochu', '/lexikon/o-arwin']
paths = main + chapters + sample
print(f'{len(paths)} adres, {URL}')

with sync_playwright() as p:
    b = launch(p, ['--autoplay-policy=no-user-gesture-required', '--mute-audio'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    cons = []
    pg.on('console', lambda m: m.type == 'error' and not noise(m) and cons.append((pg.url, m.text)))
    pg.on('pageerror', lambda e: cons.append((pg.url, str(e))))
    bad = []
    for i, path in enumerate(paths):
        resp = pg.goto(URL + path, wait_until='domcontentloaded')
        status = resp.status if resp else 0
        try:
            pg.wait_for_selector('#loading', state='detached', timeout=25000)
            if path not in ('/dokument', '/proroctvi/film'): pg.wait_for_function(READY, timeout=25000)
            st = pg.evaluate("(() => ({page: document.body.dataset.page, err: !!document.querySelector('main section:not([hidden]) .pg-err'), h1: document.querySelector('main > section:not([hidden]) h1')?.textContent || ''}))()")
        except Exception as e:
            st = {'page': '?', 'err': True, 'h1': str(e)[:80]}
        good = status == 200 and not st['err'] and st['page'] != 'nenalezeno'
        if not good: bad.append((path, status, st))
        if i < len(main) or path.endswith(('kniha-5', 'pyramida-casu')): pg.screenshot(path=f"{OUT}/{(path.strip('/') or 'uvod').replace('/', '_').replace('?', '_')[:60]}.png")
    ok(not bad, f'přímý vstup: {len(paths) - len(bad)}/{len(paths)} adres 200 bez chybového stavu a bez 404 (z toho {len(chapters)} kapitol a knih)', bad)
    for x in bad: print('   CHYBA', x)
    # staré kotvy
    for h, want in [('/#ch-anauroch', '/pribeh/kniha-4/anauroch'), ('/#svedectvi/elminster', '/svedectvi/elminster'), ('/#b-bitva-v-anaurochu', '/bitvy/bitva-v-anaurochu'), ('/#pv-3-6', '/proroctvi/3-6'), ('/#rejstrik', '/lexikon'), ('/index.html#mapa', '/mapa')]:
        pg.goto(URL + h, wait_until='domcontentloaded'); pg.wait_for_selector('#loading', state='detached', timeout=25000); pg.wait_for_timeout(800)
        here = pg.evaluate('location.pathname')
        ok(here.startswith(want.split('#')[0]) or (want == '/pribeh/kniha-4/anauroch' and '/anauroch' in here), f'stará kotva {h} → {here}', want)
    # 404 mimo aplikaci (Vercel 404.html s vlastními písmy)
    resp = pg.goto(URL + '/neexistuje/nic.txt'); pg.wait_for_timeout(800)
    fonts = pg.evaluate("document.fonts ? [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family) : []")
    ok(resp.status == 404 and any('Cinzel' in f for f in fonts), f'mimo aplikaci: HTTP 404 a stránka 404 s vlastními písmy', (resp.status, fonts))
    pg.screenshot(path=f'{OUT}/404.png')
    resp = pg.goto(URL + '/pribeh/kniha-9'); pg.wait_for_selector('#loading', state='detached', timeout=25000); pg.wait_for_timeout(800)
    ok(pg.evaluate("document.body.dataset.page") == 'nenalezeno', 'neznámá adresa aplikace: stránka „Tahle stránka v kronice není“')
    cons = [c for c in cons if '/neexistuje/' not in c[0]]  # záměrná 404
    ok(not cons, 'konzole bez chyb při procházení', cons[:6])
    ctx.close(); b.close()

# hlavičky a verze
def head(path):
    req = urllib.request.Request(URL + path, method='HEAD')
    with urllib.request.urlopen(req, timeout=30) as r: return r.status, dict(r.headers)
try:
    with urllib.request.urlopen(URL + '/', timeout=30) as r: html = r.read().decode()
    import re
    js = re.search(r'assets/index-[^"]+\.js', html).group(0)
    s1, h1 = head('/'); s2, h2 = head('/' + js); s3, h3 = head('/data/books.json'); s4, h4 = head('/version.json')
    ok('no-cache' in h1.get('Cache-Control', '') or 'must-revalidate' in h1.get('Cache-Control', ''), f"HTML: Cache-Control {h1.get('Cache-Control')}")
    ok('immutable' in h2.get('Cache-Control', ''), f"hashovaný chunk: Cache-Control {h2.get('Cache-Control')}")
    ok('no-cache' in h3.get('Cache-Control', ''), f"data/*.json: Cache-Control {h3.get('Cache-Control')}")
    with urllib.request.urlopen(URL + '/version.json', timeout=30) as r: v = json.loads(r.read())
    ok(bool(v.get('v')) and 'no-store' in h4.get('Cache-Control', '') + h4.get('cache-control', ''), f"/version.json {v} ({h4.get('Cache-Control')})")
except Exception as e:
    ok(False, 'hlavičky a /version.json', e)

print(f'\n{len(oks)} OK, {len(errs)} FAIL')
for e in errs: print('  FAIL', e)
sys.exit(1 if errs else 0)

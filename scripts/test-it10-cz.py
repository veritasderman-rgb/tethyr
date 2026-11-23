#!/usr/bin/env python3
"""Iterace 10: české znění svědectví s přepínačem EN | CZ. BROWSER=chromium|firefox|webkit, SHOT_URL (výchozí náhled :4173), PW_PROXY.
Statické kontroly (assets/voices_cs) + prohlížeč: výchozí EN, český zvuk se nestahuje předem, přepnutí během přehrávání,
titulky podle českého timingu, volba přežije jiného svědka i reload, Elminster v CZ bez lip-sync videa, jeden zvuk."""
import os, sys, json, pathlib
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise, BROWSER
from nav8 import open_, go
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = os.environ.get('SHOT_OUT', f'/home/claude/webshots/it10/{BROWSER}/cz'); os.makedirs(OUT, exist_ok=True)
R = pathlib.Path(__file__).resolve().parent.parent
errs, oks = [], []
def ok(c, msg, extra=''):
    (oks if c else errs).append(msg + ('' if c else f'  ← {extra}'))
    print(('OK   ' if c else 'FAIL ') + msg, '' if c else extra, flush=True)

# ---------------------------------------------------------------- statické kontroly
sv = json.load(open(R / 'data/svedectvi.json'))
tcs = json.load(open(R / 'assets/voices_cs/timing.json'))
ids = [w['id'] for w in sv]
ok(len(ids) == 33 and all(i in tcs for i in ids), 'pro všech 33 svědků je český timing', [i for i in ids if i not in tcs])
ok(all((R / f'assets/voices_cs/{i}.mp3').exists() for i in ids), 'pro všech 33 svědků je český zvuk', [i for i in ids if not (R / f'assets/voices_cs/{i}.mp3').exists()])
ok(all(len(tcs[i]['starts']) == len(tcs[i]['lines']) and all(l['cs'] for l in tcs[i]['lines']) for i in ids), 'počet českých titulků = počet řádků (časů) v timing.json')
src = '/home/claude/voices4/timing.json'
if os.path.exists(src):
    s4 = json.load(open(src))
    ok(all([l['cs'] for l in tcs[i]['lines']] == [l['cs'] for l in s4[i]['lines']] for i in ids), 'české titulky přesně podle schváleného zdroje (voices4/timing.json)')
sz = sum((R / f'assets/voices_cs/{i}.mp3').stat().st_size for i in ids)
print(f'      české znění: {sz / 1e6:.1f} MB')

ST = "({lang: window.__wit.lang, st: window.__wit.state, cur: window.__wit.cur, src: window.__voice.src, t: window.__voice.currentTime, paused: window.__voice.paused, full: window.__wit.fullVideo, sub: document.querySelector('#wStage .w-sub p')?.textContent || '', starts: window.__wit.starts, owner: window.__audio.owner(), pressed: [...document.querySelectorAll('[data-lang]')].filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.lang)})"
def cur_line(st, wid):
    i = -1
    for k, s in enumerate(st['starts']):
        if st['t'] >= s: i = k
    return tcs[wid]['lines'][i]['cs'] if i >= 0 else ''
norm = lambda x: (x or '').replace('\xa0', ' ').strip()

with sync_playwright() as p:
    b = launch(p, ['--autoplay-policy=no-user-gesture-required', '--mute-audio'])
    for name, opts in [('desktop', dict(viewport={'width': 1440, 'height': 900})), ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        T = f'[{BROWSER}/{name}] '
        ctx = b.new_context(**opts); pg = ctx.new_page()
        cons, reqs = [], []
        pg.on('console', lambda m: m.type == 'error' and not noise(m) and cons.append(m.text))
        pg.on('request', lambda r: reqs.append(r.url))
        click = (lambda sel: pg.tap(sel)) if name == 'mobile' else (lambda sel: pg.click(sel))
        open_(pg, URL, '/', 500)
        ok(not any('voices_cs' in u for u in reqs), T + 'první načtení webu nestahuje nic z českého znění')
        go(pg, '/svedectvi/alusair', 900)
        st = pg.evaluate(ST)
        ok(st['pressed'] == ['en'], T + 'výchozí znění je EN', st['pressed'])
        click('#wPlay'); pg.wait_for_timeout(3500); st = pg.evaluate(ST)
        ok(st['lang'] == 'en' and '/assets/voices/alusair.mp3' in st['src'] and not st['paused'] and st['t'] > 1, T + 'EN: anglický zvuk hraje (alusair)', st)
        ok(not any('voices_cs' in u for u in reqs), T + 'v EN se český zvuk ani timing nestahuje', [u for u in reqs if 'voices_cs' in u][:2])
        click('[data-lang="cs"]'); pg.wait_for_timeout(4000); st = pg.evaluate(ST)
        ok(st['lang'] == 'cs' and '/assets/voices_cs/alusair.mp3' in st['src'] and not st['paused'] and 1 < st['t'] < 6, T + 'přepnutí na CZ během přehrávání: český zvuk hraje od začátku', st)
        ok(st['owner'] == 'svedectvi' and pg.evaluate("[...document.querySelectorAll('audio, video')].filter(m => !m.paused && !m.muted).length") <= 1, T + 'jeden zvuk najednou', st['owner'])
        ok(len(st['starts']) == len(tcs['alusair']['starts']), T + 'časy vět z českého timingu', len(st['starts']))
        pg.wait_for_timeout(1200); st = pg.evaluate(ST)
        ok(norm(st['sub']) == norm(cur_line(st, 'alusair')), T + 'český titulek odpovídá času českého zvuku', (st['t'], st['sub'][:60], cur_line(st, 'alusair')[:60]))
        pg.screenshot(path=f'{OUT}/{name}-alusair-cz.png')
        # jiný svědek: volba platí
        click('[data-act="next"]'); pg.wait_for_timeout(3500); st = pg.evaluate(ST)
        ok(st['lang'] == 'cs' and '/assets/voices_cs/' in st['src'] and st['cur'] != 'alusair' and st['pressed'] == ['cs'], T + 'volba CZ přežije přechod na jiného svědka', st)
        # Elminster: v CZ smyčka místo lip-sync videa, v EN plné video
        go(pg, '/svedectvi/elminster', 900); click('#wPlay'); pg.wait_for_timeout(3500); st = pg.evaluate(ST)
        ok(st['lang'] == 'cs' and '/voices_cs/elminster.mp3' in st['src'] and not st['full'] and not st['paused'], T + 'Elminster v CZ: český zvuk a šestisekundová smyčka (ne anglický lip-sync)', st)
        pg.screenshot(path=f'{OUT}/{name}-elminster-cz.png')
        # reload: volba se pamatuje
        pg.reload(wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=30000); pg.wait_for_timeout(1200)
        ok(pg.evaluate(ST)['pressed'] == ['cs'], T + 'volba CZ se pamatuje i po novém načtení')
        click('[data-lang="en"]'); pg.wait_for_timeout(300); click('#wPlay'); pg.wait_for_timeout(3500); st = pg.evaluate(ST)
        ok(st['lang'] == 'en' and '/assets/voices/elminster.mp3' in st['src'] and st['full'] and not st['paused'], T + 'Elminster v EN: anglický zvuk a plné lip-sync video', st)
        pg.screenshot(path=f'{OUT}/{name}-elminster-en.png')
        ok(not cons, T + 'konzole bez chyb', cons[:4])
        ctx.close()
    b.close()

print(f'\n{len(oks)} OK, {len(errs)} FAIL')
for e in errs: print('  FAIL', e)
sys.exit(1 if errs else 0)

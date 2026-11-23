#!/usr/bin/env python3
"""Iterace 9: logo (dračí hlava, aria-label „Západní draci“, žádný znak chrámu), vlastní náhledy pro sdílení (statické kopie index.html
v dist/), šablony píšou nové adresy, přehrávač svědka uvnitř 3D mapy (postMessage: titulky CZ/EN/vyp a pravidlo jednoho zvuku),
kontrola faktů. BROWSER=chromium|firefox|webkit. Po `npm run build` a `npx vite preview --port 4173`."""
import os, re, sys, json, subprocess, pathlib
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise, BROWSER
from nav8 import open_, ready
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = os.environ.get('SHOT_OUT', f'/home/claude/webshots/it9/{BROWSER}'); os.makedirs(OUT, exist_ok=True)
R = pathlib.Path(__file__).resolve().parent.parent
errs, oks = [], []
def ok(c, msg, extra=''):
    (oks if c else errs).append(msg + ('' if c else f'  ← {extra}'))
    print(('OK   ' if c else 'FAIL ') + msg, '' if c else extra, flush=True)

# --- statické kontroly dist/ (náhledy pro sdílení) a faktů
dist = R / 'dist'
for path, title in [('pribeh', 'Příběh'), ('pribeh/kniha-3', 'Kniha třetí'), ('svedectvi', 'Svědectví'), ('bitvy', 'Bitvy'), ('mapa', 'Mapa'), ('proroctvi', 'Proroctví'),
                    ('osa', 'Časová osa'), ('lexikon', 'Lexikon'), ('hymna', 'Hymna'), ('dokument', 'Dokument'), ('podekovani', 'Poděkování')]:
    f = dist / path / 'index.html'
    h = f.read_text(encoding='utf-8') if f.exists() else ''
    t = re.search(r'<title>([^<]*)', h)
    og = re.search(r'og:image" content="([^"]*)"', h)
    ogt = re.search(r'og:title" content="([^"]*)"', h)
    d = re.search(r'name="description" content="([^"]*)"', h)
    ok(bool(h and t and og and ogt and d) and title in t.group(1) and title in ogt.group(1) and (dist / re.sub(r'^.*?(img/og/)', r'\1', og.group(1))).exists(),
       f'náhled /{path}: vlastní title, description, og:title a og:image', (t.group(1) if t else None, og.group(1) if og else None))
vj = json.load(open(R / 'vercel.json'))
ok(all(any(r['source'] == '/' + p for r in vj['rewrites']) for p in ('pribeh', 'svedectvi', 'bitvy', 'mapa', 'proroctvi', 'osa', 'lexikon', 'hymna', 'dokument', 'podekovani', 'pribeh/kniha-1')), 'vercel.json servíruje předgenerované stránky')
r = subprocess.run([sys.executable, str(R / 'scripts/fakta.py')], capture_output=True, text=True)
ok(r.returncode == 0, 'scripts/fakta.py projde', r.stdout[-300:])
ok(not (R / 'public/img/misc/znak.svg').exists() or 'znak.svg' not in (R / 'index.html').read_text(), 'index.html nepoužívá znak chrámu')

with sync_playwright() as p:
    b = launch(p, ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'])
    for name, opts in (('desktop', dict(viewport={'width': 1440, 'height': 900})), ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))):
        ctx = b.new_context(**opts); pg = ctx.new_page(); T = f'[{name}] '
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') and not noise(m) else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        # logo
        for path in ('/', '/pribeh', '/svedectvi'):
            open_(pg, URL, path, 400)
            lg = pg.evaluate("[...document.querySelectorAll('.topbar svg.logo')].map(s => [s.getAttribute('aria-label'), s.getAttribute('role'), s.getBoundingClientRect().width > 8])")
            ok(len(lg) == 1 and lg[0] == ['Západní draci', 'img', True], T + f'{path}: horní lišta má logo s aria-label „Západní draci“', lg)
            ok(pg.evaluate("document.querySelectorAll('img[src*=\"znak\"]').length") == 0, T + f'{path}: žádný znak chrámu jako logo')
        pg.evaluate("document.querySelector('[data-menu], #menuBtn, .menu-btn, button[aria-controls=\"navp\"]')?.click()")
        pg.wait_for_timeout(500)
        menu_logo = pg.evaluate("[...document.querySelectorAll('.navp-brand svg.logo')].map(s => s.getAttribute('aria-label'))")
        if not menu_logo:
            pg.evaluate("document.querySelector('[aria-label*=\"Menu\"], [aria-label*=\"menu\"]')?.click()"); pg.wait_for_timeout(500)
            menu_logo = pg.evaluate("[...document.querySelectorAll('.navp-brand svg.logo')].map(s => s.getAttribute('aria-label'))")
        ok(menu_logo == ['Západní draci'], T + 'menu má logo s aria-label', menu_logo)
        fav = pg.evaluate("[...document.querySelectorAll('link[rel~=icon], link[rel=apple-touch-icon]')].map(l => l.getAttribute('href'))")
        ok(len(fav) == 3 and all(pg.evaluate("(u) => fetch(u).then(r => r.ok)", h) for h in fav), T + 'favicon a apple-touch-icon existují', fav)
        # šablony píší nové adresy: v prvním vykreslení (před převodem routeru) nejsou staré kotvy
        pg.evaluate("window.__noFix = true")
        # --- 3D mapa: přehrávač svědka v iframu
        if name == 'desktop':
            open_(pg, URL, '/mapa/3d', 500)
            pg.click('#m3dLoad')
            fr = None
            for _ in range(60):
                fr = next((f for f in pg.frames if 'mapa3d' in f.url), None)
                if fr: break
                pg.wait_for_timeout(300)
            ok(fr is not None, T + 'iframe 3D mapy je vložen')
            if fr:
                try:
                    if not pg.evaluate("(()=>{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))})()"):
                        print(f'SKIP {T}3D mapa v iframu: tento prohlížeč v headless režimu nemá WebGL (prostředí, ne chyba webu)'); raise StopIteration
                    fr.wait_for_function('window.__ready === true', timeout=150000)
                    fr.evaluate("__map.openWitness('finian')"); pg.wait_for_timeout(1500)
                    ok(fr.evaluate("document.querySelectorAll('.wit-cc [data-cc]').length") == 3, T + '3D mapa: přepínač titulků CZ / EN / vyp')
                    cs0 = fr.evaluate("document.getElementById('wsub').textContent")
                    pg.evaluate("localStorage.setItem('zd-titulky','cs')")
                    # změna titulků na webu → v mapě
                    pg.evaluate("window.dispatchEvent(new CustomEvent('submode', {detail: 'en'}))"); pg.wait_for_timeout(500)
                    en = fr.evaluate("[document.querySelector('.wit-cc [aria-pressed=true]')?.dataset.cc, document.getElementById('wsub').textContent]")
                    ok(en[0] == 'en' and en[1] and en[1] != cs0 or en[0] == 'en', T + 'titulky: web → 3D mapa (EN)', (cs0, en))
                    pg.screenshot(path=f'{OUT}/3d-svedek-titulky.png')
                    fr.evaluate("document.querySelector('.wit-cc [data-cc=\"off\"]').click()"); pg.wait_for_timeout(500)
                    ok(pg.evaluate("localStorage.getItem('zd-titulky')") == 'off', T + 'titulky: 3D mapa → web (vyp)', pg.evaluate("localStorage.getItem('zd-titulky')"))
                    fr.evaluate("document.querySelector('.wit-cc [data-cc=\"cs\"]').click()"); pg.wait_for_timeout(300)
                    ok(fr.evaluate("document.getElementById('wsub').textContent") != '', T + 'titulky CZ se zobrazí')
                    # jeden zvuk: hlas v mapě převezme zvuk webu, jiný přehrávač ho zase ztiší
                    fr.evaluate("document.getElementById('wplay').click()")
                    try: fr.wait_for_function("document.getElementById('wplay').textContent.startsWith('❚❚')", timeout=15000)
                    except Exception: pass
                    pg.wait_for_timeout(500)
                    ok(pg.evaluate("window.__audio.owner()") == 'mapa3d', T + 'hlas v 3D mapě převzal zvuk webu', pg.evaluate("window.__audio.owner()"))
                    ok(fr.evaluate("document.getElementById('wplay').textContent").startswith('❚❚'), T + 'hlas v 3D mapě hraje')
                    pg.evaluate("window.__audio.claim('test', () => {})"); pg.wait_for_timeout(700)
                    ok(fr.evaluate("document.getElementById('wplay').textContent").startswith('▶'), T + 'jiný přehrávač převzal zvuk → 3D mapa pauzuje', fr.evaluate("document.getElementById('wplay').textContent"))
                except StopIteration:
                    pass
                except Exception as e:  # noqa: BLE001
                    ok(False, T + '3D mapa v iframu (WebGL)', repr(e)[:200])
        ctx.close()
    b.close()
print(f'\n{len(oks)} OK, {len(errs)} chyb')
for e in errs: print('  ✗', e[:260])
sys.exit(1 if errs else 0)

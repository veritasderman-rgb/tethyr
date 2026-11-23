#!/usr/bin/env python3
"""Iterace 5: 2D mapa tažení – přehrávání, kapitoly, karty, filtry, vrstvy, shluky a popisky, klávesnice (desktop + mobil)."""
import os
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it5'); os.makedirs(OUT, exist_ok=True)
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}),
         'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}
errs, ok = [], []
def check(c, msg):
    (ok if c else errs).append(msg)
with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    for name, opts in VIEWS.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] console {m.type}: {m.text}') if m.type in ('error', 'warning') and not noise(m) else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.goto(URL.rstrip('/') + '/mapa', wait_until='networkidle')  # od it8 samostatná stránka
        pg.wait_for_function('window.__map2d', timeout=15000); pg.locator('#leaf').scroll_into_view_if_needed(); pg.wait_for_function('!!window.__map2d.map', timeout=15000)
        pg.wait_for_timeout(1200)
        pg.locator('#mapUi').scroll_into_view_if_needed()
        n = pg.evaluate('__map2d.n'); check(n > 80, f'[{name}] zastávek {n}')
        lab = pg.evaluate('__map2d.labels()'); cl = pg.evaluate('__map2d.clusters()')
        check(lab > 5, f'[{name}] popisky {lab}, shluky {cl}')
        # překryv popisků
        ov = pg.evaluate("""() => { const r=[...document.querySelectorAll('.leaf .lab-r .pl-lab, .leaf .lab-l .pl-lab')].map(e=>e.getBoundingClientRect()); let n=0;
          for(let i=0;i<r.length;i++) for(let j=i+1;j<r.length;j++){ const a=r[i], b=r[j]; if(a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1) n++; } return n; }""")
        check(ov == 0, f'[{name}] překryvy popisků {ov}')
        pg.screenshot(path=f'{OUT}/{name}-mapa-celek.png')
        # kapitola Shou Lung: krokování po kapitolách
        pg.evaluate("__map2d.setEra('I')"); pg.wait_for_timeout(900)
        pg.evaluate("__map2d.stop()")
        pg.evaluate("() => { for(let i=0;i<40;i++) __map2d.chStep(-1); }")
        pg.evaluate("__map2d.chStep(1)"); pg.wait_for_timeout(1300)
        cap = pg.inner_text('#mpStep'); check('Shou Lung' in cap, f'[{name}] kapitola Shou Lung v titulku: {cap[:80]!r}')
        pg.screenshot(path=f'{OUT}/{name}-mapa-shou-lung.png')
        # přehrávání
        pg.evaluate("__map2d.setEra('all')"); pg.wait_for_timeout(500)
        pg.evaluate("__map2d.step(-1)")
        pg.evaluate("() => { const r=document.getElementById('mpRange'); r.value='0'; r.dispatchEvent(new Event('input')); }")
        pg.select_option('#mpSpeed', '4')
        pg.click('#mpPlay'); pg.wait_for_timeout(3500)
        p1 = pg.evaluate('__map2d.pos'); check(p1 > 2, f'[{name}] přehrávání posunulo polohu na {p1:.2f}')
        chap_on = pg.evaluate("document.getElementById('mpChap').classList.contains('on') || document.getElementById('mpChap').textContent.length>0")
        check(chap_on, f'[{name}] titulek kapitoly se ukázal')
        pg.screenshot(path=f'{OUT}/{name}-mapa-prehravani.png')
        pg.click('#mpPlay'); check(not pg.evaluate('__map2d.playing'), f'[{name}] pauza')
        # klávesnice
        pg.focus('#leaf'); pg.keyboard.press('.'); pg.wait_for_timeout(200)
        p2 = pg.evaluate('__map2d.pos'); check(p2 > p1, f'[{name}] klávesa . krok ({p1:.2f} → {p2:.2f})')
        pg.keyboard.press('3'); pg.wait_for_timeout(500)
        check(pg.get_attribute('.map-eras [data-era="III"]', 'aria-pressed') == 'true', f'[{name}] klávesa 3 = kniha III')
        pg.keyboard.press('0'); pg.wait_for_timeout(500)
        # karta místa
        pg.evaluate("window.__router.navigate('/mapa?misto=castle-tethyr')"); pg.wait_for_timeout(1500)
        txt = pg.text_content('#mpPanel')
        check('Castle Tethyr' in txt and 'V Příběhu' in txt and 'Svědci' in txt, f'[{name}] karta místa (příběh, svědci)')
        pg.screenshot(path=f'{OUT}/{name}-mapa-karta.png')
        links = pg.evaluate("[...document.querySelectorAll('#mpPanel a')].map(a=>a.getAttribute('href'))")
        check(any(h.startswith('/pribeh/kniha-') for h in links) and any(h.startswith('/svedectvi/') for h in links) and any('mapa3d' in h for h in links), f'[{name}] prokliky karty (nové adresy): {len(links)}')
        # bitva
        pg.evaluate("__map2d.setView('all')"); pg.wait_for_timeout(900)
        pg.locator('.bmk').first.click(force=True); pg.wait_for_timeout(500)
        check('Bitva' in pg.text_content('#mpPanel'), f'[{name}] karta bitvy')
        # sféry
        pg.click('[data-view="sfery"]'); pg.wait_for_timeout(1200)
        pg.locator('.sph').first.click(force=True); pg.wait_for_timeout(500)
        check('sféry' in pg.text_content('#mpPanel').lower(), f'[{name}] karta sféry')
        pg.screenshot(path=f'{OUT}/{name}-mapa-sfery.png')
        # vrstvy
        pg.click('[data-lay="battles"]'); pg.wait_for_timeout(300)
        check(pg.locator('.bmk').count() == 0, f'[{name}] vrstva bitev vypnuta')
        pg.click('[data-lay="battles"]')
        pg.click('[data-view="karatur"]'); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'{OUT}/{name}-mapa-karatur.png')
        ctx.close()
    b.close()
print('\n'.join('OK  ' + x for x in ok)); print('\n'.join('ERR ' + x for x in errs)); print(f'{len(ok)} ok, {len(errs)} chyb')

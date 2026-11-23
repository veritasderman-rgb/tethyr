#!/usr/bin/env python3
"""Iterace 5: 3D mapa – brána „Načíst 3D mapu“ na mobilu, přelet tažením s titulky kapitol, odkazy do Příběhu, média svědků z webu."""
import os
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/') + 'mapa3d/index.html'
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it5'); os.makedirs(OUT, exist_ok=True)
errs, ok = [], []
def check(c, msg): (ok if c else errs).append(msg)
ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio']
with sync_playwright() as p:
    b = launch(p, ARGS)
    # mobil: brána
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg = ctx.new_page()
    reqs = []; pg.on('request', lambda r: reqs.append(r.url))
    pg.on('console', lambda m: errs.append(f'[mobil] console {m.type}: {m.text}') if m.type == 'error' and not noise(m) else None)
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(1500)
    check(pg.locator('#ldGo').is_visible(), '[mobil] tlačítko Načíst 3D mapu')
    check(not any('height.bin' in u or 'three.module' in u or 'main.js' in u for u in reqs), '[mobil] před klepnutím se nic těžkého nestahuje')
    pg.screenshot(path=f'{OUT}/mobile-3d-brana.png')
    pg.click('#ldGo'); pg.wait_for_function('window.__ready === true', timeout=120000); pg.wait_for_timeout(3000)
    check(True, '[mobil] mapa se po klepnutí načetla')
    pg.screenshot(path=f'{OUT}/mobile-3d-mapa.png')
    pg.evaluate("__map.setSpeed(4); __map.toggleTour(true)"); pg.wait_for_timeout(6000)
    check(pg.evaluate("document.body.classList.contains('tour')"), '[mobil] přelet zapnut')
    pg.screenshot(path=f'{OUT}/mobile-3d-prelet.png')
    ctx.close()
    # desktop (lehká kvalita kvůli SwiftShaderu)
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    bad = []
    pg.on('console', lambda m: errs.append(f'[desktop] console {m.type}: {m.text}') if m.type == 'error' and not noise(m) else None)
    pg.on('pageerror', lambda e: errs.append(f'[desktop] pageerror {e}'))
    pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
    pg.goto(URL + '?q=low'); pg.wait_for_function('window.__ready === true', timeout=120000); pg.wait_for_timeout(2500)
    pg.screenshot(path=f'{OUT}/desktop-3d-celek.png')
    pg.evaluate("__map.setSpeed(4); __map.toggleTour(true)"); pg.wait_for_timeout(2500)
    t = pg.text_content('#chapT') or ''
    check('Tethyru' in t or 'Východ' in t, f'[desktop] titulek kapitoly při přeletu: {t[:60]!r}')
    pg.screenshot(path=f'{OUT}/desktop-3d-prelet.png')
    pg.wait_for_timeout(9000)
    pg.screenshot(path=f'{OUT}/desktop-3d-prelet2.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    check(not pg.evaluate("document.body.classList.contains('tour')"), '[desktop] Esc ukončí přelet')
    pg.evaluate("__map.goStop(8)"); pg.wait_for_timeout(2500)
    links = pg.evaluate("[...document.querySelectorAll('#infoBody a')].map(a=>a.getAttribute('href'))")
    check(any('#ch-shou-lung' in h for h in links), f'[desktop] deník: odkaz na kapitolu Shou Lung ({len(links)} odkazů)')
    pg.screenshot(path=f'{OUT}/desktop-3d-denik.png')
    pg.evaluate("__map.openPlace('castle-tethyr')"); pg.wait_for_timeout(2500)
    links = pg.evaluate("[...document.querySelectorAll('#infoBody a')].map(a=>a.getAttribute('href'))")
    check(sum('#ch-' in h for h in links) >= 3, f'[desktop] karta místa: kapitoly v Příběhu {sum("#ch-" in h for h in links)}')
    pg.screenshot(path=f'{OUT}/desktop-3d-karta.png')
    pg.evaluate("__map.openWitness('finian')"); pg.wait_for_timeout(2500)
    src = pg.evaluate("(document.getElementById('wv')||{}).currentSrc || (document.getElementById('wv')||{}).src || ''")
    st = pg.evaluate("(document.getElementById('wv')||{}).readyState||0")
    check('assets/video/finian.mp4' in src and st >= 1, f'[desktop] video svědka z webu ({src[-30:]}, readyState {st})')
    pg.screenshot(path=f'{OUT}/desktop-3d-svedek.png')
    pg.evaluate("__map.flyView('anauroch')"); pg.wait_for_timeout(5000)
    pg.screenshot(path=f'{OUT}/desktop-3d-anauroch.png')
    check(not bad, f'[desktop] HTTP chyby: {bad[:5]}')
    ctx.close(); b.close()
print('\n'.join('OK  ' + x for x in ok)); print('\n'.join('ERR ' + x for x in errs)); print(f'{len(ok)} ok, {len(errs)} chyb')

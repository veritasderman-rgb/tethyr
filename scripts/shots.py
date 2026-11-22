#!/usr/bin/env python3
"""Snímky obrazovky webu (desktop 1440×900 a mobil 390×844) do /home/claude/webshots/.
Předpoklad: běží `npx vite preview --port 4173` (nebo URL v proměnné SHOT_URL)."""
import os, sys, time, json
from playwright.sync_api import sync_playwright

URL = os.environ.get('SHOT_URL', 'http://localhost:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots')
os.makedirs(OUT, exist_ok=True)
SECTIONS = ['uvod', 'pribeh', 'kniha-II', 'ch-bitva-o-rudou-pevnost', 'mapa', 'svedectvi', 'druzina', 'bitvy', 'proroctvi', 'osa', 'rejstrik', 'stul']
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}
only = sys.argv[1:]
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for name, opts in VIEWS.items():
        ctx = b.new_context(**opts)
        pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errors.append(f'[{n}] console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errors.append(f'[{n}] pageerror: {e}'))
        pg.on('requestfailed', lambda r, n=name: errors.append(f'[{n}] requestfailed: {r.url}'))
        pg.on('response', lambda r, n=name: errors.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle')
        pg.wait_for_selector('#loading', state='detached', timeout=15000)
        for sec in SECTIONS:
            if only and sec not in only: continue
            pg.evaluate(f"document.getElementById('{sec}')?.scrollIntoView({{behavior:'instant', block:'start'}})")
            pg.wait_for_timeout(500)
            pg.evaluate("window.scrollBy(0, 1)")
            pg.wait_for_timeout(1400)
            pg.screenshot(path=f'{OUT}/{name}-{sec}.png')
        # svědectví v chodu
        if not only or 'play' in only:
            pg.evaluate("document.getElementById('wStage').scrollIntoView({behavior:'instant', block:'start'})")
            pg.wait_for_timeout(400)
            pg.click('#wStart [data-act="doc"]')
            pg.wait_for_timeout(5200)
            pg.screenshot(path=f'{OUT}/{name}-svedectvi-play.png')
            pg.evaluate("document.querySelector('.w-card[data-i=\"25\"]').click()")
            pg.wait_for_timeout(4500)
            pg.screenshot(path=f'{OUT}/{name}-svedectvi-play2.png')
        # detail postavy
        if not only or 'drawer' in only:
            pg.evaluate("document.querySelector('#druzina .pc[data-c=\"ho\"]').click()")
            pg.wait_for_timeout(1500)
            pg.screenshot(path=f'{OUT}/{name}-druzina-detail.png')
            pg.keyboard.press('Escape')
        # mapa: klik na místo
        if not only or 'mapclick' in only:
            pg.evaluate("document.getElementById('mapa').scrollIntoView({behavior:'instant'})")
            pg.wait_for_timeout(1500)
            pg.evaluate("document.querySelector('.place[title=\"Castle Tethyr\"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))")
            pg.wait_for_timeout(800)
            pg.screenshot(path=f'{OUT}/{name}-mapa-misto.png')
        ctx.close()
    b.close()
open(f'{OUT}/console.txt', 'w').write('\n'.join(errors))
print(len(errors), 'chyb/varování'); print('\n'.join(errors[:40]))

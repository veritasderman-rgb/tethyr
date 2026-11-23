#!/usr/bin/env python3
"""Test přehrávače svědectví s audiem i videem (a režimu dokument). Předpoklad: běží `npx vite preview --port 4173`."""
import os, sys
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise

URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it2')
os.makedirs(OUT, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = launch(p, ['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL + '#svedectvi/zako', wait_until='networkidle')
    pg.wait_for_selector('#loading', state='detached', timeout=15000)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{OUT}/t-deeplink-paused.png')
    pg.click('#wTap [data-act="play"]')
    pg.wait_for_timeout(9000)
    st = pg.evaluate("""() => { const v = document.querySelector('.w-video'); return {
      video: v && {t: v.currentTime, paused: v.paused, w: v.videoWidth, muted: v.muted, loop: v.loop},
      sub: document.querySelector('#wSub p')?.textContent, lower: document.querySelector('.w-name')?.textContent,
      hasVideoCls: !!document.querySelector('.has-video'), prog: document.querySelector('#wProg').style.transform } }""")
    print('zako', st)
    pg.screenshot(path=f'{OUT}/t-zako-play.png')
    # padlý svědek
    pg.evaluate("window.dispatchEvent(new CustomEvent('witness:open', {detail: {id: 'rivalen'}}))")
    pg.wait_for_timeout(6000)
    pg.screenshot(path=f'{OUT}/t-rivalen-play.png')
    # dokument
    pg.evaluate("document.querySelector('#wDoc').click()")
    for i, t in enumerate([2500, 6500, 7000, 7500]):
        pg.wait_for_timeout(t)
        pg.screenshot(path=f'{OUT}/t-doc-{i}.png')
        print('doc', i, pg.evaluate("[document.querySelector('#wInter').className, document.querySelector('.w-name')?.textContent, document.querySelector('#wCount').textContent]"))
    print('chyby:', errs)
    b.close()

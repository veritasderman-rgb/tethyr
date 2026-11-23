#!/usr/bin/env python3
"""Test kotev (#s-…, #b-…, #svedectvi/<id>, #mapa, #pribeh, #hymna, #podekovani) a přehrávače hymny. Předpoklad: běží preview na :4173."""
import os
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it2')
with sync_playwright() as p:
    b = launch(p, ['--autoplay-policy=no-user-gesture-required'])
    for h in ['s-2011-06-21', 's-2026-09-05-epilog', 'b-bitva-v-anaurochu', 'svedectvi/finian', 'svedectvi/khelben', 'mapa', 'pribeh', 'hymna', 'podekovani', 'mapa3d']:
        pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
        pg.goto(URL + '#' + h, wait_until='networkidle')
        pg.wait_for_selector('#loading', state='detached', timeout=15000)
        pg.wait_for_timeout(4500)
        sel = {'svedectvi/finian': '#wStage', 'svedectvi/khelben': '#wStage'}.get(h, '#' + h)
        top = pg.evaluate(f"document.querySelector('{sel}')?.getBoundingClientRect().top")
        extra = pg.evaluate("document.querySelector('.w-name')?.textContent") if h.startswith('svedectvi') else ''
        print(h, 'top=', round(top) if top is not None else None, extra)
        pg.screenshot(path=f"{OUT}/a-{h.replace('/', '_')}.png")
        pg.close()
    # hymna
    pg = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached')
    pg.evaluate("document.getElementById('hymna').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(800)
    pg.evaluate("window.scrollBy(0, 330)")
    pg.click('#hyPlay'); pg.wait_for_timeout(2500)
    print('hymna', pg.evaluate("({t: document.getElementById('hyAudio').currentTime, paused: document.getElementById('hyAudio').paused, btn: document.getElementById('hyPlay').textContent})"))
    pg.evaluate("document.querySelector('.hy-l[data-k=\"3-0\"]').click()"); pg.wait_for_timeout(3500)
    print('hymna', pg.evaluate("({t: document.getElementById('hyAudio').currentTime, on: document.querySelector('.hy-l.on')?.textContent, cur: document.getElementById('hyCur').textContent})"))
    pg.screenshot(path=f'{OUT}/t-hymna-play.png')
    pg.evaluate("document.getElementById('hyVol').value=0; document.getElementById('hyVol').dispatchEvent(new Event('input'))")
    print('vol', pg.evaluate("document.getElementById('hyAudio').volume"), 'chyby', errs)
    b.close()

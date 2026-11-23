#!/usr/bin/env python3
"""Iterace 6: snímky všech oddílů (desktop 1440x900, mobil 390x844); více výřezů u dlouhých oddílů."""
import os, sys
from playwright.sync_api import sync_playwright
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = sys.argv[1] if len(sys.argv) > 1 else '/home/claude/webshots/it6/pred'
os.makedirs(OUT, exist_ok=True)
SECS = {'uvod': 2, 'pribeh': 3, 'mapa': 1, 'svedectvi': 2, 'druzina': 3, 'bitvy': 3, 'proroctvi': 3, 'osa': 2, 'rejstrik': 1, 'stul': 2, 'hymna': 1, 'podekovani': 1}
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}),
         'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)}
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--mute-audio'])
    for name, opts in VIEWS.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        vh = opts['viewport']['height']
        for s, n in SECS.items():
            for _ in range(2):
                pg.evaluate(f"document.getElementById('{s}')?.scrollIntoView({{behavior:'instant', block:'start'}})"); pg.wait_for_timeout(900)
            for k in range(n):
                if k:
                    pg.evaluate(f"window.scrollBy(0, {int(vh*0.9) if s!='pribeh' else int(vh*1.8)})"); pg.wait_for_timeout(900)
                pg.screenshot(path=f'{OUT}/{name}-{s}-{k}.png')
        ctx.close()
    b.close()
print('chyby konzole:', errs or 'žádné')

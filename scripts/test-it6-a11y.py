#!/usr/bin/env python3
"""Iterace 6: axe-core (WCAG 2 A/AA) nad všemi vykreslenými oddíly, desktop i mobil. axe-core se bere z AXE_JS (výchozí /tmp/axe/node_modules/axe-core/axe.min.js)."""
import os, sys, json
from playwright.sync_api import sync_playwright
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
AXE = open(os.environ.get('AXE_JS', '/tmp/axe/node_modules/axe-core/axe.min.js')).read()
SECS = ['uvod', 'pribeh', 'mapa', 'svedectvi', 'druzina', 'bitvy', 'proroctvi', 'osa', 'lexikon', 'stul', 'hymna', 'podekovani']
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)}
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(args=['--mute-audio'])
    for name, opts in VIEWS.items():
        pg = b.new_context(**opts).new_page()
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        for s in SECS:
            pg.evaluate(f"document.getElementById('{s}').scrollIntoView({{behavior:'instant'}})"); pg.wait_for_timeout(700)
        pg.evaluate('window.scrollTo(0,0)'); pg.wait_for_timeout(500)
        pg.add_script_tag(content=AXE)
        # reveal vše (axe jinak počítá kontrast s průhlednými prvky)
        pg.add_style_tag(content='.rv{opacity:1!important;transform:none!important;transition:none!important}*{animation:none!important}')
        pg.wait_for_timeout(300)
        res = pg.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}, resultTypes:['violations']})).violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,ex:v.nodes.slice(0,4).map(n=>n.target.join(' ')+' :: '+(n.any[0]?.message||n.all[0]?.message||'').slice(0,110))}))")
        print(f'== {name}: {sum(r["n"] for r in res)} uzlů, {len(res)} pravidel')
        for r in res:
            print(f' - {r["id"]} ({r["impact"]}) x{r["n"]}: {r["help"]}')
            for e in r['ex']: print('     ', e)
        bad += sum(r['n'] for r in res)
    b.close()
print('CELKEM porušení:', bad)
sys.exit(1 if bad else 0)

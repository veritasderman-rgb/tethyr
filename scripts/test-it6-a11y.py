#!/usr/bin/env python3
"""Iterace 6/8: axe-core (WCAG 2 A/AA) nad každou stránkou webu (od it8 samostatné adresy), desktop i mobil. axe-core se bere z AXE_JS (výchozí /tmp/axe/node_modules/axe-core/axe.min.js)."""
import os, sys, json
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
AXE = open(os.environ.get('AXE_JS', '/tmp/axe/node_modules/axe-core/axe.min.js')).read()
SECS = ['/', '/pribeh', '/pribeh/kniha-2', '/pribeh/kniha-5/anauroch', '/druzina', '/svedectvi', '/svedectvi/elminster', '/bitvy', '/bitvy/bitva-o-rudou-pevnost', '/mapa', '/mapa/3d', '/proroctvi', '/osa', '/lexikon', '/lexikon/o-kung-lao', '/u-stolu', '/hymna', '/podekovani', '/neexistuje']
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)}
bad = 0
with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    for name, opts in VIEWS.items():
        pg = b.new_context(**opts).new_page()
        open_(pg, URL, '/')
        pg.add_script_tag(content=AXE)
        tot = 0
        for path in SECS:
            go(pg, path, 900)
            # reveal vše (axe jinak počítá kontrast s průhlednými prvky)
            pg.add_style_tag(content='.rv{opacity:1!important;transform:none!important;transition:none!important}*{animation:none!important}')
            pg.wait_for_timeout(250)
            res = pg.evaluate("async () => (await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}, resultTypes:['violations']})).violations.map(v=>({id:v.id,impact:v.impact,n:v.nodes.length,help:v.help,ex:v.nodes.slice(0,4).map(n=>n.target.join(' ')+' :: '+(n.any[0]?.message||n.all[0]?.message||'').slice(0,110))}))")
            n = sum(r['n'] for r in res); tot += n
            print(f'== {name} {path}: {n} uzlů, {len(res)} pravidel')
            for r in res:
                print(f' - {r["id"]} ({r["impact"]}) x{r["n"]}: {r["help"]}')
                for e in r['ex']: print('     ', e)
        res = [{'n': tot}]
        bad += sum(r['n'] for r in res)
    b.close()
print('CELKEM porušení:', bad)
sys.exit(1 if bad else 0)

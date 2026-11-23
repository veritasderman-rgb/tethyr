#!/usr/bin/env python3
"""Snímky 3D mapy pro kontrolu (Playwright + Chromium se SwiftShaderem, funguje i bez GPU).
Předpoklad: v kořeni složky mapa3d běží  python3 -m http.server 8765
Spouští se: python3 tools/shots.py [jméno ...]   → /home/claude/webshots/mapa3d/*.png + console.txt"""
import sys, os, time, json
from playwright.sync_api import sync_playwright
OUT='/home/claude/webshots/mapa3d'; os.makedirs(OUT, exist_ok=True)
URL=os.environ.get('URL','http://localhost:8765/index.html')
ARGS=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl']
log=[]
def wait_ready(pg, extra=2500):
    pg.wait_for_function('window.__ready===true', timeout=180000); pg.wait_for_timeout(extra)
def settle(pg, ms=3500): pg.wait_for_timeout(ms)
SHOTS={
 'celek': lambda pg: settle(pg, 4500),
 'tethyr': lambda pg: (pg.evaluate("__map.flyView('tethyr')"), settle(pg, 5000)),
 'karatur': lambda pg: (pg.evaluate("__map.flyView('karatur')"), settle(pg, 5000)),
 'anauroch': lambda pg: (pg.evaluate("__map.flyView('anauroch')"), settle(pg, 6000)),
 'sfery': lambda pg: (pg.evaluate("__map.flyView('spheres')"), settle(pg, 5000)),
 'karta': lambda pg: (pg.evaluate("__map.openPlace('castle-tethyr')"), settle(pg, 14000)),
 'bitva': lambda pg: (pg.evaluate("__map.openBattle('b-bitva-v-anaurochu')"), settle(pg, 6000)),
 'svedek': lambda pg: (pg.evaluate("__map.openWitness('finian')"), settle(pg, 4500)),
 'trasa': lambda pg: (pg.evaluate("__map.goStop(5,{fly:true})"), settle(pg,2500), pg.evaluate("__map.togglePlay(true)"), settle(pg, 4200)),
 'deník': lambda pg: (pg.evaluate("__map.goStop(96,{fly:true})"), settle(pg, 5000)),
 'mereni': lambda pg: (pg.evaluate("__map.toggleMeasure(); __map.pickMeasure('castle-tethyr'); __map.pickMeasure('hlubina'); __map.flyView('all')"), settle(pg, 4500)),
}
MOBILE={'mobil','mobil-karta','mobil-trasa'}
def run(names):
    with sync_playwright() as p:
        b=p.chromium.launch(args=ARGS)
        for n in names:
            mob = n.startswith('mobil')
            ctx=b.new_context(viewport={'width':390,'height':844} if mob else {'width':1440,'height':900}, device_scale_factor=2 if mob else 1, is_mobile=mob, has_touch=mob)
            pg=ctx.new_page()
            pg.on('console', lambda m, n=n: log.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error','warning') and 'GPU stall' not in m.text and 'GL Driver' not in m.text else None)
            pg.on('pageerror', lambda e, n=n: log.append(f'[{n}] PAGEERROR: {e}'))
            t0=time.time(); pg.goto(URL); wait_ready(pg)
            if n=='mobil': settle(pg,4500)
            elif n=='mobil-karta': pg.evaluate("__map.openPlace('chram-zapadniho-usvitu')"); settle(pg,5000)
            elif n=='mobil-trasa': pg.evaluate("__map.goStop(100,{fly:true})"); settle(pg,5000)
            else: SHOTS[n](pg)
            pg.screenshot(path=f'{OUT}/{n}.png')
            perf=pg.evaluate('window.__perf&&window.__perf()')
            print(n, f'{time.time()-t0:.1f}s', json.dumps(perf))
            ctx.close()
        b.close()
    open(f'{OUT}/console.txt','w').write('\n'.join(log)+'\n')
    print('\n'.join(log[:40]) or 'konzole bez chyb')
if __name__=='__main__':
    run(sys.argv[1:] or list(SHOTS)+sorted(MOBILE))

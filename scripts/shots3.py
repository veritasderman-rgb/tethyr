#!/usr/bin/env python3
"""Iterace 3: snímky a kontrola Příběhu (desktop 1440×900, mobil 390×844) do /home/claude/webshots/it3/.
Předpoklad: běží `npx vite preview --port 4173` (nebo URL v SHOT_URL). Vypíše chyby konzole a výsledky testů odkazů."""
import os, sys
from playwright.sync_api import sync_playwright

URL = os.environ.get('SHOT_URL', 'http://localhost:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it3')
os.makedirs(OUT, exist_ok=True)
SECTIONS = ['uvod', 'pribeh', 'kniha-I', 'ch-z-tethyru-na-vychod', 'ch-feng-asay-a-tempat-larang', 'ch-thultanthar-a-pyramida-casu',
            'mapa', 'svedectvi', 'druzina', 'bitvy', 'proroctvi', 'osa', 'rejstrik', 'stul', 'hymna', 'podekovani']
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}),
         'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}
errors, checks = [], []


def ok(name, cond, extra=''):
    checks.append(f"{'OK ' if cond else 'CHYBA'} {name} {extra}")


def go(pg, sec, block='start'):
    for _ in range(2):
        pg.evaluate(f"document.getElementById('{sec}')?.scrollIntoView({{behavior:'instant', block:'{block}'}})")
        pg.wait_for_timeout(1100)


with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    for name, opts in VIEWS.items():
        ctx = b.new_context(**opts)
        pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errors.append(f'[{n}] console.{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errors.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errors.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle')
        pg.wait_for_selector('#loading', state='detached', timeout=15000)
        data0 = pg.evaluate("performance.getEntriesByType('resource').filter(e=>e.name.includes('/data/')).map(e=>e.name.split('/').pop())")
        ok(f'[{name}] líné načítání dat', 'npcs.json' not in data0 and 'timeline.json' not in data0, str(data0))
        ok(f'[{name}] 36 kapitol s vyprávěním', pg.evaluate("document.querySelectorAll('.chap .chap-body .vp').length") > 150)
        ok(f'[{name}] bez vodorovného přetečení', pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        for sec in SECTIONS:
            go(pg, sec)
            pg.screenshot(path=f'{OUT}/{name}-{sec}.png')
        # čtení kapitoly: marginálie, citace, galerie, mapka
        go(pg, 'ch-draci-let-a-knihovna-arenkae')
        pg.mouse.wheel(0, 700); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}-cteni-kapitola.png')
        pg.evaluate("document.querySelector('#ch-draci-let-a-knihovna-arenkae .chap-x').scrollIntoView({block:'start'})"); pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{OUT}/{name}-kapitola-svedci-mapa.png')
        # klávesy → / ← (jen desktop)
        if name == 'desktop':
            go(pg, 'ch-feng-asay-a-tempat-larang')
            pg.mouse.click(5, 450)
            pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(1600)
            top = pg.evaluate("document.getElementById('ch-draci-let-a-knihovna-arenkae').getBoundingClientRect().top")
            ok('[desktop] klávesa → na další kapitolu', -5 < top < 140, f'top={top:.0f}')
            pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(1600)
            top = pg.evaluate("document.getElementById('ch-feng-asay-a-tempat-larang').getBoundingClientRect().top")
            ok('[desktop] klávesa ← zpět', -5 < top < 140, f'top={top:.0f}')
            pg.screenshot(path=f'{OUT}/{name}-obsah-postup.png')
        else:
            go(pg, 'ch-shoonach-finale')
            pg.click('#tocBtn'); pg.wait_for_timeout(700)
            pg.screenshot(path=f'{OUT}/{name}-obsah-list.png')
            ok('[mobile] obsah se vysune', pg.evaluate("document.getElementById('toc').classList.contains('open')"))
            pg.click('#toc [data-toc="ch-halruaa"]'); pg.wait_for_timeout(1800)
            top = pg.evaluate("document.getElementById('ch-halruaa').getBoundingClientRect().top")
            ok('[mobile] klik v obsahu skočí na kapitolu', -5 < top < 160, f'top={top:.0f}')
        # odkaz na svědectví → otevře přehrávač s hlasem/videem
        go(pg, 'ch-feng-asay-a-tempat-larang')
        pg.evaluate("document.querySelector('#ch-feng-asay-a-tempat-larang .lk-w[data-wit=\"kung-lao\"]').click()")
        pg.wait_for_timeout(3500)
        st = pg.evaluate("({hash: location.hash, video: !!document.querySelector('#svedectvi video'), audio: (()=>{const a=[...document.querySelectorAll('audio')].find(x=>!x.paused); return !!a})()})")
        ok(f'[{name}] odkaz na svědectví otevře Kung Laa', st['hash'] == '#svedectvi/kung-lao', str(st))
        pg.screenshot(path=f'{OUT}/{name}-odkaz-svedectvi.png')
        pg.evaluate("document.querySelector('[data-act=\"pause\"], [data-act=\"play\"]')?.click()")
        # odkaz na místo → 2D mapa s kartou místa
        go(pg, 'ch-z-tethyru-na-vychod')
        pg.evaluate("document.querySelector('#ch-z-tethyru-na-vychod .lk-m[data-place=\"ithmong\"]').click()")
        pg.wait_for_timeout(2500)
        ok(f'[{name}] odkaz na místo otevře kartu Ithmongu', 'Ithmong' in pg.evaluate("document.querySelector('#mpPanel h3')?.textContent || ''"))
        pg.screenshot(path=f'{OUT}/{name}-odkaz-mapa.png')
        # odkaz na verš proroctví
        go(pg, 'ch-thultanthar-a-pyramida-casu')
        pg.evaluate("document.querySelector('#ch-thultanthar-a-pyramida-casu .lk-p').click()")
        pg.wait_for_timeout(2500)
        ok(f'[{name}] odkaz na verš proroctví', pg.evaluate("!!document.querySelector('.pr-v.hit')"))
        pg.screenshot(path=f'{OUT}/{name}-odkaz-proroctvi.png')
        # odkaz na postavu → karta v šuplíku
        go(pg, 'ch-z-tethyru-na-vychod')
        pg.evaluate("document.querySelector('#ch-z-tethyru-na-vychod .lk-c[data-char=\"veritas\"]').click()")
        pg.wait_for_timeout(1500)
        ok(f'[{name}] odkaz na postavu otevře kartu', pg.evaluate("!document.getElementById('drawer').hidden"))
        pg.screenshot(path=f'{OUT}/{name}-odkaz-postava.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        # bitva
        go(pg, 'ch-pod-rudou-pevnosti')
        pg.evaluate("document.querySelector('#ch-pod-rudou-pevnosti .lk-b').click()")
        pg.wait_for_timeout(2500)
        top = pg.evaluate("document.getElementById('b-bitva-o-rudou-pevnost').getBoundingClientRect().top")
        ok(f'[{name}] odkaz na bitvu', -10 < top < 200, f'top={top:.0f}')
        # pokračovat ve čtení po načtení stránky znovu
        go(pg, 'ch-halruaa'); pg.mouse.wheel(0, 300); pg.wait_for_timeout(2600); pg.mouse.wheel(0, 50); pg.wait_for_timeout(500)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        ok(f'[{name}] „Pokračovat ve čtení“ v úvodu', 'Halruaa' in pg.evaluate("document.querySelector('.hero-cont')?.textContent || ''"))
        pg.screenshot(path=f'{OUT}/{name}-uvod-pokracovat.png')
        # hymna: videoklip jako hlavní přehrávač
        go(pg, 'hymna')
        hv = pg.evaluate("(() => { const v=document.querySelector('#hymna video#hyClip'); return v ? {poster: v.poster, ctl: v.controls} : null })()")
        ok(f'[{name}] hymna: videoklip s ovládáním', bool(hv and hv['ctl']), str(hv))
        pg.evaluate("const v=document.getElementById('hyClip'); v.muted=true; v.currentTime=70; v.play()"); pg.wait_for_timeout(2500)
        ok(f'[{name}] hymna: text se zvýrazňuje podle videa', pg.evaluate("!!document.querySelector('.hy-l.on')"))
        pg.screenshot(path=f'{OUT}/{name}-hymna-klip.png')
        pg.evaluate("document.getElementById('hyClip').pause()")
        # časová osa
        go(pg, 'osa')
        pg.screenshot(path=f'{OUT}/{name}-osa.png')
        ov = pg.evaluate("""(() => { const t=[...document.querySelectorAll('.tl-evt')].map(e=>e.getBBox()); let n=0;
          for (let i=0;i<t.length;i++) for (let j=i+1;j<t.length;j++){const a=t[i],b=t[j]; if(a.x<b.x+b.width&&b.x<a.x+a.width&&a.y<b.y+b.height&&b.y<a.y+a.height) n++;} return n; })()""")
        ok(f'[{name}] časová osa bez překryvů popisků', ov == 0, f'překryvů {ov}')
        # dokument: střih na mapu knihy I
        if name == 'desktop':
            go(pg, 'svedectvi')
            pg.click('#wStart [data-act="doc"]'); pg.wait_for_timeout(6200)
            pg.screenshot(path=f'{OUT}/{name}-dokument-mapa-I.png')
            ok('[desktop] dokument: mapa knihy I jen s úsekem kapitoly', pg.evaluate("document.querySelectorAll('#wInter .wi-pt').length") <= 8)
            pg.evaluate("document.querySelector('[data-act=\"stop\"], [data-act=\"doc\"]')"); pg.keyboard.press('Escape')
        ctx.close()
    b.close()
open(f'{OUT}/console.txt', 'w').write('\n'.join(errors))
open(f'{OUT}/checks.txt', 'w').write('\n'.join(checks))
print('\n'.join(checks)); print(len(errors), 'chyb/varování v konzoli'); print('\n'.join(errors[:40]))

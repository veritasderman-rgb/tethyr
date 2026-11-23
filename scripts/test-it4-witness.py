#!/usr/bin/env python3
"""Iterace 4: galerie svědectví (skupiny, jmenovky, padlí), přehrávač (hlasitost, přeskoky, automatické pokračování). Snímky do /home/claude/webshots/it4/."""
import os, sys
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/'); OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it4'); os.makedirs(OUT, exist_ok=True)
res, errs = [], []
def ok(n, c, x=''): res.append(f"{'OK   ' if c else 'CHYBA'} {n} {x}")
with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    for name, opts in {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        open_(pg, URL, '/svedectvi', 1500)
        tap = (lambda sel: pg.tap(sel)) if name == 'mobile' else (lambda sel: pg.click(sel))
        groups = pg.evaluate("[...document.querySelectorAll('.wg')].map(g => [g.dataset.g, g.querySelectorAll('.wc').length])")
        ok(f'[{name}] tři skupiny galerie', [g[0] for g in groups] == ['spojenci', 'nepratele', 'mocni'], str(groups))
        past = pg.evaluate("[...document.querySelectorAll('.wc.past')].map(c => c.querySelector('.wc-name').textContent + ' ' + c.querySelector('.wc-x').textContent.trim())")
        ok(f'[{name}] padlí mají křížek a letopočet', len(past) == 7 and all('138' in x or '137' in x for x in past), str(past))  # od it7 i Chuang-Li (zrádkyně, † Cham Fau)
        pg.evaluate("document.querySelector('#wGal').scrollIntoView({behavior:'instant'})"); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}-galerie-spojenci.png')
        pg.evaluate("document.querySelector('.wg[data-g=nepratele]').scrollIntoView({behavior:'instant', block:'start'})"); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{OUT}/{name}-galerie-nepratele.png')
        # přehrát padlého (Kung Lao)
        tap('.wc[data-id=kung-lao]'); pg.wait_for_timeout(6000)
        pg.screenshot(path=f'{OUT}/{name}-prehravac-padly.png')
        st = pg.evaluate("({a: !__voice.paused, t: __voice.currentTime, vid: !!document.querySelector('#svedectvi .w-video'), vt: document.querySelector('#svedectvi .w-video')?.currentTime, cls: document.getElementById('wStage').className, plate: document.querySelector('.w-dead')?.textContent})")
        ok(f'[{name}] přehrávač: hlas + video ve smyčce + tlumený stav', st['a'] and st['vid'] and (st['vt'] or 0) > 0.5 and 'past' in st['cls'], str(st))
        # střih = nepřátelé, přeskok
        tap('[data-f=nepratele]'); pg.wait_for_timeout(300)
        tap('[data-act=next]'); pg.wait_for_timeout(3500)
        cur = pg.evaluate("__wit.cur")
        ok(f'[{name}] další v střihu Nepřátelé', cur in ['thalaxia', 'yamun-ii', 'yamoh-hokhra', 'axel-adamantis', 'devrel', 'rivalen', 'sar-saratar', 'chuang-li'], cur)
        pg.screenshot(path=f'{OUT}/{name}-prehravac-nepritel.png')
        # skok +10 s
        t1 = pg.evaluate("__voice.currentTime"); tap('[data-act=fwd]'); pg.wait_for_timeout(400); t2 = pg.evaluate("__voice.currentTime")
        ok(f'[{name}] přeskok +10 s', t2 - t1 > 8, f'{t1:.1f} → {t2:.1f}')
        tap('[data-act=back]'); pg.wait_for_timeout(400); t3 = pg.evaluate("__voice.currentTime"); ok(f'[{name}] přeskok −10 s', t2 - t3 > 8, f'{t2:.1f} → {t3:.1f}')
        # hlasitost
        if name == 'desktop':
            pg.evaluate("(() => { const v = document.getElementById('wVol'); v.value = 30; v.dispatchEvent(new Event('input', {bubbles: true})) })()")
            ok('[desktop] posuvník hlasitosti', abs(pg.evaluate("__voice.volume") - 0.3) < 0.02)
            pg.evaluate("(() => { const v = document.getElementById('wVol'); v.value = 90; v.dispatchEvent(new Event('input', {bubbles: true})) })()")
        tap('#wMute'); ok(f'[{name}] ztlumení', pg.evaluate("__voice.muted")); tap('#wMute'); ok(f'[{name}] zrušení ztlumení', not pg.evaluate("__voice.muted"))
        # automatické pokračování: přeskočit na konec svědectví
        before = pg.evaluate("__wit.cur")
        pg.evaluate("(() => { const a = __voice; a.currentTime = a.duration - 0.6 })()")
        pg.wait_for_timeout(3000)
        nu = pg.evaluate("({hidden: document.getElementById('wNext').hidden, txt: document.querySelector('#wNext span').textContent})")
        ok(f'[{name}] po skončení nabídne dalšího svědka', not nu['hidden'], str(nu))
        pg.screenshot(path=f'{OUT}/{name}-dalsi-svedek.png')
        pg.wait_for_timeout(4200)
        after = pg.evaluate("__wit.cur"); st = pg.evaluate("!__voice.paused")
        ok(f'[{name}] automaticky pokračuje dalším ve střihu', after != before and st, f'{before} → {after}')
        ctx.close()
    b.close()
print('\n'.join(res)); print('chyby konzole:', errs or 'žádné')
sys.exit(1 if any(r.startswith('CHYBA') for r in res) else 0)

#!/usr/bin/env python3
"""Iterace 4 (od it8 na podstránkách): svědectví otevřené prokliknutím z kapitoly Příběhu musí hrát se zvukem po uživatelském kliknutí.
Bez příznaku autoplay (skutečná politika prohlížeče), skutečné kliknutí myší / dotyk. Předpoklad: běží `npx vite preview --port 4173`."""
import os, sys
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here

URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it4')
os.makedirs(OUT, exist_ok=True)
res, errs = [], []
def ok(n, c, x=''): res.append(f"{'OK   ' if c else 'CHYBA'} {n} {x}")

def audio_state(pg):
    return pg.evaluate("(() => { const a = window.__voice; return a ? {t: +a.currentTime.toFixed(2), paused: a.paused, muted: a.muted, vol: a.volume, src: (a.currentSrc||'').split('/').pop(), ended: a.ended, rs: a.readyState} : null })()")

with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])   # bez --autoplay-policy: platí běžná pravidla
    for name, opts in {'desktop': dict(viewport={'width': 1440, 'height': 900}),
                       'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        open_(pg, URL, '/'); go(pg, 'ch-feng-asay-a-tempat-larang', 1500)
        link = pg.locator('#ch-feng-asay-a-tempat-larang .lk-w[data-wit="kung-lao"]').first
        link.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        if name == 'mobile': link.tap()
        else: link.click()          # skutečné kliknutí = uživatelská aktivace
        pg.wait_for_timeout(4500)
        a1 = audio_state(pg)
        ok(f'[{name}] po kliknutí v Příběhu hraje hlas Kung Laa', a1 and not a1['paused'] and a1['t'] > 1.5 and a1['src'] == 'kung-lao.mp3' and not a1['muted'] and a1['vol'] > 0, str(a1))
        sub = pg.evaluate("document.querySelector('#svedectvi .w-sub p')?.textContent")
        ok(f'[{name}] titulky běží', bool(sub), repr((sub or '')[:50]))
        pg.screenshot(path=f'{OUT}/{name}-audio-z-pribehu.png')
        pg.wait_for_timeout(1500)
        a2 = audio_state(pg)
        ok(f'[{name}] čas zvuku roste', a2['t'] > a1['t'] + 0.8, f"{a1['t']} → {a2['t']}")
        # pauza a ztlumení
        pg.click('#wPlay') if name == 'desktop' else pg.tap('#wPlay')
        pg.wait_for_timeout(500); a3 = audio_state(pg); ok(f'[{name}] pauza zastaví zvuk', a3['paused'])
        pg.click('#wPlay') if name == 'desktop' else pg.tap('#wPlay')
        pg.wait_for_timeout(1500); a4 = audio_state(pg); ok(f'[{name}] znovu přehrát pokračuje', not a4['paused'] and a4['t'] > a3['t'])
        # další svědek tlačítkem
        pg.click('[data-act=next]') if name == 'desktop' else pg.tap('[data-act=next]')
        pg.wait_for_timeout(3500); a5 = audio_state(pg); ok(f'[{name}] další svědek hraje (jiný zdroj)', not a5['paused'] and a5['src'] != 'kung-lao.mp3' and a5['t'] > 1, str(a5))
        # odkaz z bitvy a z hash
        go(pg, 'b-bitva-o-rudou-pevnost', 1500)
        ok(f'[{name}] adresa hlášení', here(pg) == '/bitvy/bitva-o-rudou-pevnost', here(pg))
        bl = pg.locator('#bitvy .bt:not([hidden]) [data-wit]').first
        if bl.count():
            bl.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
            bl.tap() if name == 'mobile' else bl.click()
            pg.wait_for_timeout(4500); a6 = audio_state(pg)
            ok(f'[{name}] odkaz z Bitev hraje se zvukem', not a6['paused'] and a6['t'] > 1.5, str(a6))
            ok(f'[{name}] adresa svědka', here(pg).startswith('/svedectvi/'), here(pg))
        ctx.close()
    b.close()
print('\n'.join(res)); print('chyby konzole:', errs or 'žádné')
sys.exit(1 if any(r.startswith('CHYBA') for r in res) else 0)

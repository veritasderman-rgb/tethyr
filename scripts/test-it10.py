#!/usr/bin/env python3
"""Iterace 10: filmový režim proroctví (/proroctvi/film), nový klip hymny, logo, drobnosti z auditu.
BROWSER=chromium|firefox|webkit. Po `npm run build` a `npx vite preview --port 4173`. Snímky do /home/claude/webshots/it10/<prohlížeč>/."""
import os, sys, json, time
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise, BROWSER
from nav8 import open_, ready, go
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173').rstrip('/')
OUT = os.environ.get('SHOT_OUT', f'/home/claude/webshots/it10/{BROWSER}'); os.makedirs(OUT, exist_ok=True)
errs, oks = [], []
def ok(c, msg, extra=''):
    (oks if c else errs).append(msg + ('' if c else f'  ← {extra}'))
    print(('OK   ' if c else 'FAIL ') + msg, '' if c else extra, flush=True)
ST = "window.__pfilm && window.__pfilm.state()"
def st(pg): return pg.evaluate(ST)
def wait_aud(pg, ms=20000):
    pg.wait_for_function("window.__pfilm && window.__pfilm.state().type === 'aud' && !window.__pfilm.state().paused && window.__pfilm.state().t > 0.3", timeout=ms)

with sync_playwright() as p:
    b = launch(p, ['--autoplay-policy=no-user-gesture-required', '--mute-audio'])
    for name, opts in [('desktop', dict(viewport={'width': 1440, 'height': 900})),
                       ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        T = f'[{BROWSER}/{name}] '
        ctx = b.new_context(**opts); pg = ctx.new_page()
        cons = []
        pg.on('console', lambda m: m.type == 'error' and not noise(m) and cons.append(m.text))
        pg.on('pageerror', lambda e: cons.append(str(e)))
        reqs = []
        pg.on('request', lambda r: reqs.append(r.url))
        # ---------------------------------------------------------------- nic z filmu mimo film
        open_(pg, URL, '/', 600)
        ok(not any('pfilm' in u for u in reqs), T + 'úvod nenačítá nic z filmu proroctví', [u for u in reqs if 'pfilm' in u][:3])
        go(pg, '/proroctvi', 900)
        film_req = [u for u in reqs if ('pfilm' in u and (u.endswith('.js') or u.endswith('.css') or u.endswith('.mp4')))]
        ok(not film_req, T + 'stránka Proroctví nenačítá kód ani videa filmu (jen náhled tlačítka)', film_req[:3])
        btn = pg.evaluate("(() => { const a = document.querySelector('a.pr-film'); if (!a) return null; const r = a.getBoundingClientRect(); return {href: a.getAttribute('href'), w: r.width, h: r.height, txt: a.textContent}; })()")
        ok(btn and btn['href'] == '/proroctvi/film' and 'Promítnout proroctví' in btn['txt'] and btn['h'] >= 44, T + 'výrazné tlačítko „Promítnout proroctví“ vede na /proroctvi/film', btn)
        pg.screenshot(path=f'{OUT}/{name}-proroctvi-tlacitko.png')
        # ---------------------------------------------------------------- kliknutí = film hned hraje; hlas stránky se zastaví
        pg.click('#ppStart'); pg.wait_for_timeout(1500)
        page_playing = pg.evaluate("window.__prophecy.player.playing")
        pg.click('a.pr-film'); pg.wait_for_timeout(1500)
        s = st(pg)
        ok(pg.evaluate("location.pathname") == '/proroctvi/film' and s and s['started'] and s['playing'] and s['type'] == 'vid', T + 'klik na tlačítko: adresa /proroctvi/film, film hned běží (úvodní předěl)', s)
        ok(page_playing and not pg.evaluate("window.__prophecy.player.playing"), T + 'jeden zvuk: hlas stránky Proroctví se při startu filmu zastavil', page_playing)
        ok(s['title'] == 'Alaundovo proroctví', T + 'přes úvodní předěl hoří nadpis „Alaundovo proroctví“', s['title'])
        pg.screenshot(path=f'{OUT}/{name}-film-uvod.png')
        vid = pg.evaluate("(() => { const v = document.querySelector('.pf-vids video.on'); return v ? {k: v.dataset.k, t: v.currentTime, paused: v.paused, muted: v.muted} : null; })()")
        ok(vid and vid['k'] == 'uvod' and vid['muted'], T + 'předěl je ztlumené video bez textu (uvod)', vid)
        # předěl → kapitola I (video kap1, pak hlas)
        pg.wait_for_function("window.__pfilm.state().idx === 1", timeout=12000)
        pg.wait_for_timeout(700)
        s = st(pg)
        ok(s['title'] == 'Kapitola I', T + 'předěl kapitoly I: hořící nadpis „Kapitola I“', s)
        pg.screenshot(path=f'{OUT}/{name}-film-kap1.png')
        wait_aud(pg, 15000)
        s = st(pg)
        ok(s['ch'] == 0 and s['owner'] == 'pfilm' and 'kap1.mp3' in s['src'], T + 'po předělu hraje recitace kapitoly I přes sdílený zvuk (claim pfilm)', s)
        # verš uprostřed obrazu odpovídá času zvuku (několik vzorků)
        good = 0; samples = []
        for i in range(5):
            pg.wait_for_timeout(1300 if i else 2500)
            s = st(pg)
            samples.append((round(s['t'], 1), s['shown'], s['expected']))
            if s['shown'] == s['expected']: good += 1
        ok(good >= 4, T + 'zobrazený verš odpovídá času recitace (≥ 4 z 5 vzorků)', samples)
        box = pg.evaluate("(() => { const v = [...document.querySelectorAll('.pf-v:not(.out)')].pop(); if (!v) return null; const r = v.getBoundingClientRect(); return {cx: (r.left + r.right) / 2 / innerWidth, cy: (r.top + r.bottom) / 2 / innerHeight, fs: parseFloat(getComputedStyle(v).fontSize)}; })()")
        ok(box and abs(box['cx'] - 0.5) < 0.08 and 0.3 < box['cy'] < 0.62, T + 'verš stojí uprostřed obrazu (ne dole jako titulky)', box)
        terc = pg.evaluate("(() => { const v = [...document.querySelectorAll('.pf-v:not(.out)')].pop(); return v ? {terc: v.classList.contains('terc'), fs: parseFloat(getComputedStyle(v).fontSize)} : null; })()")
        ok(terc and terc['terc'], T + 'úvodní trojverší kapitoly je zvětšené a „hoří“ (třída terc)', terc)
        kw = pg.evaluate("(() => { const v = [...document.querySelectorAll('.pf-v:not(.out)')].pop(); return v ? {lt: [...v.querySelectorAll('.pf-w.lt')].map(x => x.textContent), dk: [...v.querySelectorAll('.pf-w.dk')].map(x => x.textContent)} : null; })()")
        ok(kw and any('bílá' in w for w in kw['lt']) and any('černou' in w or 'stínu' in w for w in kw['dk']), T + 'slova světla (bílá, světlo) stříbrná, slova tmy (černou, stínu) fialově černá', kw)
        fx = st(pg)
        if name == 'desktop':
            ok(fx['fx'], T + 'kapitola I: drak z jisker je na canvasu', fx)
            fps = pg.evaluate("new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); })")
            print(f'      fps (headless, drak): {fps:.0f}')
            ok(fps > 20, T + f'snímková frekvence během draka {fps:.0f} fps (headless bez GPU)', fps)
        pg.screenshot(path=f'{OUT}/{name}-film-drak.png')
        # klávesy: mezerník, →, ←, 2, 3
        pg.keyboard.press(' '); pg.wait_for_timeout(500); s = st(pg)
        ok(not s['playing'] and s['paused'], T + 'mezerník pozastaví film i zvuk', s)
        t1 = s['t']; pg.wait_for_timeout(800)
        ok(abs(st(pg)['t'] - t1) < 0.05, T + 'v pauze čas stojí')
        pg.keyboard.press(' '); pg.wait_for_timeout(600); s = st(pg)
        ok(s['playing'] and not s['paused'], T + 'mezerník znovu spustí', s)
        u0 = int(s['expected'].split(':')[1])
        pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(900); s = st(pg)
        ok(s['expected'] == f'0:{u0 + 1}' and s['shown'] == s['expected'], T + '→ přejde na další verš (zvuk i obraz)', (u0, s))
        pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(700)
        pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(900); s = st(pg)
        ok(s['expected'] == f'0:{u0 + 1}', T + '← vrátí o verš', s)
        pg.screenshot(path=f'{OUT}/{name}-film-vers.png')
        pg.keyboard.press('2'); pg.wait_for_timeout(1200); s = st(pg)
        ok(s['type'] == 'vid' and s['ch'] == 1 and s['title'] == 'Kapitola II', T + 'klávesa 2: předěl kapitoly II s nadpisem', s)
        pg.screenshot(path=f'{OUT}/{name}-film-kap2.png')
        wait_aud(pg, 15000); pg.wait_for_timeout(2500); s = st(pg)
        ok(s['ch'] == 1 and 'kap2.mp3' in s['src'] and s['shown'] == s['expected'], T + 'kapitola II: recitace a verš podle času', s)
        ok(s['eclipse'] or s['rm'], T + 'začátek kapitoly II: zatmění (Selûne × Shar)', s)
        pg.screenshot(path=f'{OUT}/{name}-film-zatmeni.png')
        pg.keyboard.press('3'); pg.wait_for_timeout(1200); s = st(pg)
        ok(s['type'] == 'vid' and s['ch'] == 2 and s['title'] == 'Kapitola III', T + 'klávesa 3: předěl kapitoly III', s)
        pg.screenshot(path=f'{OUT}/{name}-film-kap3.png')
        pg.wait_for_timeout(2600); s = st(pg)
        ok(s['title'] == '', T + 'nadpis kapitoly III jen v první půlce předělu', s)
        # časová lišta se značkami kapitol, ovládání
        tl = pg.evaluate("(() => { const t = document.getElementById('pfTl'); return {marks: t.querySelectorAll('b').length, role: t.getAttribute('role')}; })()")
        ok(tl['marks'] == 3 and tl['role'] == 'slider', T + 'časová lišta se třemi značkami kapitol', tl)
        pg.keyboard.press('c'); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.getElementById('pfilm').classList.contains('no-cc')"), T + 'C vypne verše')
        pg.keyboard.press('c'); pg.wait_for_timeout(300)
        ok(not pg.evaluate("document.getElementById('pfilm').classList.contains('no-cc')"), T + 'C verše znovu zapne')
        # konec: závěrečná karta, žádný mrtvý konec
        pg.evaluate("window.__pfilm.seek(window.__pfilm.total - 1.5)"); pg.wait_for_timeout(4000); s = st(pg)
        done = pg.evaluate("(() => { const d = document.querySelector('.pf-done'); return d && !d.hidden ? {q: d.querySelector('blockquote').textContent, links: [...d.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href')]), again: !!d.querySelector('[data-a=again]')} : null; })()")
        ok(s['finished'] and done and 'hledání najdeš smysl' in done['q'], T + 'konec filmu: závěrečná karta s poslední větou proroctví', (s, done))
        hrefs = [h for _, h in (done or {}).get('links', [])]
        ok(done and '/proroctvi' in hrefs and '/pribeh/kniha-5' in hrefs and '/bitvy/bitva-v-anaurochu' in hrefs and done['again'], T + 'závěrečná karta: Zpět na verše, Příběh – Poslední tažení, Bitva o Anauroch, Promítnout znovu', done)
        pg.screenshot(path=f'{OUT}/{name}-film-konec.png')
        pg.click('.pf-done a[href="/proroctvi"]'); pg.wait_for_timeout(1200)
        ok(pg.evaluate("location.pathname") == '/proroctvi' and pg.evaluate("document.getElementById('pfilm').hidden") and not pg.evaluate("window.__prophecy.player.playing"), T + '„Zpět na verše“: stránka Proroctví, film zavřený, hlas stránky se sám nespustil')
        # Esc zavře, přímý vstup = úvodní karta
        pg.goto(URL + '/proroctvi/film', wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=20000); pg.wait_for_timeout(1500)
        s = st(pg)
        start = pg.evaluate("(() => { const s = document.querySelector('.pf-start'); return s && !s.hidden && !!s.querySelector('.pf-go'); })()")
        ok(start and s and not s['started'] and not s['playing'], T + 'přímý vstup na /proroctvi/film: úvodní karta s tlačítkem Spustit, nic nehraje', s)
        pg.screenshot(path=f'{OUT}/{name}-film-start.png')
        pg.click('.pf-go'); pg.wait_for_timeout(1500); s = st(pg)
        ok(s['started'] and s['playing'], T + 'Spustit: film běží', s)
        # jeden zvuk: převezme-li zvuk jiný přehrávač, film se pozastaví
        pg.evaluate("window.__pfilm.seekUnit(0, 3)"); wait_aud(pg, 10000)
        pg.evaluate("window.__audio.claim('test', () => {})"); pg.wait_for_timeout(400); s = st(pg)
        ok(not s['playing'], T + 'jeden zvuk: když zvuk převezme jiný přehrávač, film se pozastaví', s)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        if not pg.evaluate("document.getElementById('pfilm').hidden"): pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
        ok(pg.evaluate("document.getElementById('pfilm').hidden") and pg.evaluate("location.pathname") == '/proroctvi', T + 'Esc zavře film a vrátí na /proroctvi', pg.evaluate("location.pathname"))
        ok(not cons, T + 'konzole bez chyb (film)', cons[:5])
        ctx.close()

    # ---------------------------------------------------------------- reduced motion
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce'); pg = ctx.new_page()
    T = f'[{BROWSER}/reduced] '
    open_(pg, URL, '/proroctvi/film', 800)
    pg.click('.pf-go'); pg.wait_for_timeout(1500); s = st(pg)
    ok(s['rm'] and s['sparks'] == 0 and not s['fx'], T + 'prefers-reduced-motion: bez jisker a částic', s)
    pg.evaluate("window.__pfilm.seekUnit(0, 0)"); wait_aud(pg, 10000); pg.wait_for_timeout(2500); s = st(pg)
    ok(not s['fx'] and s['shown'] == s['expected'], T + 'reduced motion: drak se nekreslí, verše jen prolínáním a podle času', s)
    pg.evaluate("window.__pfilm.seekUnit(1, 0)"); wait_aud(pg, 10000); pg.wait_for_timeout(800); s = st(pg)
    ok(not s['eclipse'], T + 'reduced motion: bez animace zatmění', s)
    anim = pg.evaluate("(() => { const i = document.querySelector('.pf-sl.on img'); return i ? i.getAnimations().length : -1; })()")
    ok(anim == 0, T + 'reduced motion: malby bez pohybu kamery', anim)
    pg.screenshot(path=f'{OUT}/reduced-film.png')
    ctx.close()

    # ---------------------------------------------------------------- hymna: nový klip a zvýrazněný řádek podle času
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    T = f'[{BROWSER}/hymna] '
    open_(pg, URL, '/hymna', 800)
    info = pg.evaluate("(() => { const v = document.getElementById('hyClip'); return v ? {src: v.currentSrc || v.querySelector('source').src, poster: v.poster} : null; })()")
    ok(info and 'rauko_klip.mp4' in info['src'], T + 'stránka Hymna má videoklip', info)
    intro = pg.evaluate("[...document.querySelectorAll('.hy-l')].slice(0, 3).map(p => p.textContent)")
    ok(not any('Dvacátý pátý rok' in x or 'Kruh se uzavírá' in x for x in pg.evaluate("[...document.querySelectorAll('.hy-l')].map(p => p.textContent)")), T + 'vypravěčské řádky intra, které ve skladbě nezazní, v textu nejsou', intro)
    pg.evaluate("(() => { const v = document.getElementById('hyClip'); v.muted = true; v.currentTime = 80; return v.play(); })()")
    pg.wait_for_timeout(2500)
    hv = pg.evaluate("(() => { const v = document.getElementById('hyClip'); const on = document.querySelector('.hy-l.on'); return {t: v.currentTime, paused: v.paused, dur: v.duration, on: on && on.textContent, ont: on && +on.dataset.t, next: on && on.nextElementSibling ? +on.nextElementSibling.dataset.t : null}; })()")
    ok(hv['t'] > 81 and not hv['paused'] and abs(hv['dur'] - 359.96) < 0.6, T + 'klip hraje (nová verze 359,96 s)', hv)
    ok(hv['on'] and 'Rudé pevnosti' in hv['on'] and hv['ont'] <= hv['t'] + 0.1 and (hv['next'] is None or hv['next'] > hv['t'] - 0.1), T + 'zvýrazněný řádek odpovídá času klipu (81,7 s: „u Rudé pevnosti…“)', hv)
    pg.screenshot(path=f'{OUT}/hymna.png')
    ctx.close()

    # ---------------------------------------------------------------- stará záložka po novém nasazení: chunk stránky 404 → jednou reload
    ctx = b.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page()
    T = f'[{BROWSER}/chunk-404] '
    cons = []; pg.on('console', lambda m: cons.append(m.type + ': ' + m.text))
    open_(pg, URL, '/', 600)
    ver = pg.evaluate("fetch('/version.json', {cache: 'no-store'}).then(r => r.json())")
    ok(bool(ver.get('v')), T + '/version.json existuje (verze buildu)', ver)
    pg.route(lambda u: '/assets/lexikon-' in u and u.endswith('.js'), lambda r: r.fulfill(status=404, body='not found'))
    loads = []; pg.on('load', lambda: loads.append(time.time()))
    pg.evaluate("window.__router.navigate('/lexikon')")
    pg.wait_for_timeout(4000)
    err = pg.evaluate("(() => { const e = document.querySelector('#lexikon .pg-err'); return e ? {h: e.querySelector('h1').textContent, reload: !!e.querySelector('[data-reload]'), retry: !!e.querySelector('[data-retry]')} : null; })()")
    mark = pg.evaluate("sessionStorage.getItem('zd-reload')")
    ok(len(loads) >= 1 and mark, T + 'chybějící chunk stránky: web se jednou sám načetl znovu (pojistka v sessionStorage)', (loads, mark))
    ok(err and err['reload'] and err['retry'] and pg.evaluate("location.pathname") == '/lexikon', T + 'druhé selhání: chybový stav s „Zkusit znovu“ a „Načíst stránku znovu“, bez smyčky', err)
    ok(any('Stránku se nepodařilo načíst' in c for c in cons), T + 'skutečná příčina zapsaná do konzole', [c for c in cons if 'error' in c][:3])
    pg.unroute('**/*') if False else None
    pg.unroute_all() if hasattr(pg, 'unroute_all') else None
    pg.click('#lexikon [data-reload]'); pg.wait_for_selector('#loading', state='detached', timeout=20000); ready(pg)
    ok(pg.evaluate("!!document.querySelector('#lexikon[data-ready]') && !document.querySelector('#lexikon .pg-err')"), T + '„Načíst stránku znovu“ po opravě serveru stránku načte')
    ctx.close()
    b.close()

print(f'\n{len(oks)} OK, {len(errs)} FAIL')
for e in errs: print('  FAIL', e)
sys.exit(1 if errs else 0)

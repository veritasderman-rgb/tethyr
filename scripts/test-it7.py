#!/usr/bin/env python3
"""Iterace 7: hlavní menu (panel), globální hledání, Lexikon, hover karty, předěly knih, hlasy svědků v textu,
„Co se změnilo“, upřesnění autora v datech. Snímky do /home/claude/webshots/it7/ (desktop 1440×900, mobil 390×844).
Spuštění po `npm run build` a `npx vite preview --port 4173`."""
import os, sys, json
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = '/home/claude/webshots/it7'
os.makedirs(OUT, exist_ok=True)
fails, errs = [], []
def ok(c, msg, extra=''):
    print(('OK   ' if c else 'FAIL ') + msg, extra if (extra and not c) or os.environ.get('V') else '')
    if not c: fails.append(msg)
def shot(pg, name):
    pg.screenshot(path=f'{OUT}/{name}.png')

with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    for name, opts in (('desktop', dict(viewport={'width': 1440, 'height': 900})), ('mobile', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True))):
        ctx = b.new_context(**opts); pg = ctx.new_page(); T = f'[{name}] '; M = name == 'mobile'
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') and not noise(m) else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        pg.wait_for_timeout(1500)
        # ------------------------------------------------------------ menu
        vis = pg.evaluate("() => ({top: getComputedStyle(document.getElementById('menuBtn')).display !== 'none', more: getComputedStyle(document.getElementById('moreBtn')).display !== 'none' && document.getElementById('moreBtn').offsetParent !== null})")
        ok(vis['top'] != M, T + ('hamburger v horní liště je skrytý (menu ve spodní liště)' if M else 'hamburger v horní liště na desktopu'), vis)
        opener = '#moreBtn' if M else '#menuBtn'
        pg.click(opener); pg.wait_for_timeout(500)
        st = pg.evaluate("""() => { const p = document.getElementById('navPanel'); const items = [...p.querySelectorAll('.navp-t')].map(t => t.firstChild.textContent.trim());
          return {open: !p.hidden, items, search: !!p.querySelector('#navQ'), cont: !!p.querySelector('.navp-cont'), focusIn: p.contains(document.activeElement), modal: p.getAttribute('aria-modal'), cur: p.querySelector('.navp-a.on')?.dataset.sec} }""")
        ok(st['open'] and st['modal'] == 'true', T + 'menu se otevře jako dialog', st)
        need = ['Úvod', 'Příběh', 'Družina', 'Svědectví', 'Bitvy', 'Mapa', 'Proroctví', 'Časová osa', 'Lexikon', 'Hymna', 'Dokument', 'Poděkování']
        ok(all(x in st['items'] for x in need), T + 'menu má všechny oddíly', st['items'])
        ok(st['search'] and st['cont'] and st['focusIn'], T + 'menu: hledání, Pokračovat/Začít číst, fokus uvnitř', st)
        ok(st['cur'] == 'uvod', T + 'aktuální oddíl zvýrazněný (Úvod)', st['cur'])
        pg.click('.navp-exp'); pg.wait_for_timeout(700)
        nb = pg.evaluate("document.querySelectorAll('#navBooks details').length + ':' + document.querySelectorAll('#navBooks a[data-ch]').length")
        ok(nb == '5:36', T + 'Příběh v menu: 5 knih, 36 kapitol', nb)
        pg.evaluate("document.querySelector('#navBooks details').open = true"); pg.wait_for_timeout(200)
        shot(pg, f'{name}-menu')
        # fokus-trap: Tab z posledního prvku se vrátí na první
        trap = pg.evaluate("""() => { const p = document.getElementById('navPanel'); const f = [...p.querySelectorAll('a[href], button, input, summary')].filter(e => e.offsetParent !== null); f[f.length-1].focus(); return f.length }""")
        pg.keyboard.press('Tab'); pg.wait_for_timeout(100)
        ok(pg.evaluate("document.getElementById('navPanel').contains(document.activeElement)"), T + 'fokus zůstává v menu (Tab)', trap)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('navPanel').hidden"), T + 'Esc menu zavře')
        pg.click(opener); pg.wait_for_timeout(400)
        if M: pg.mouse.click(195, 25)
        else: pg.mouse.click(200, 450)
        pg.wait_for_timeout(500)
        ok(pg.evaluate("document.getElementById('navPanel').hidden"), T + 'klik mimo menu zavře')
        # odkaz v menu vede na oddíl a zvýrazní ho
        pg.click(opener); pg.wait_for_timeout(400)
        pg.click('#navPanel [data-sec="bitvy"]'); pg.wait_for_timeout(4500)
        pg.click(opener); pg.wait_for_timeout(400)
        cur = pg.evaluate("document.querySelector('#navPanel .navp-a.on')?.dataset.sec")
        ok(cur == 'bitvy', T + 'po přechodu je v menu zvýrazněný oddíl Bitvy', cur)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        # ------------------------------------------------------------ hledání
        if M: pg.click('#bottomNav [data-search]')
        else: pg.keyboard.press('/')
        pg.wait_for_timeout(400)
        ok(pg.evaluate("!document.getElementById('searchBox').hidden && document.activeElement.id === 'srchQ'"), T + 'hledání se otevře (' + ('tlačítko' if M else 'klávesa /') + ')')
        pg.keyboard.type('Yamoh'); pg.wait_for_timeout(1500)
        r = pg.evaluate("[...document.querySelectorAll('.srch-g h3')].map(h => h.textContent)")
        ok(any('Osoby' in x for x in r) and any('Svědectví' in x for x in r) and any('textu' in x for x in r), T + 'hledání „Yamoh“: osoby, svědectví, text kapitol', r)
        shot(pg, f'{name}-hledani')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        if not M:
            pg.keyboard.press('Control+k'); pg.wait_for_timeout(300)
            ok(pg.evaluate("!document.getElementById('searchBox').hidden"), T + 'Ctrl+K otevře hledání')
            pg.keyboard.type('Pyramida času'); pg.wait_for_timeout(500)
        else:
            pg.click('#bottomNav [data-search]'); pg.wait_for_timeout(300); pg.keyboard.type('Pyramida času'); pg.wait_for_timeout(600)
        n = pg.evaluate("document.querySelectorAll('.srch-i').length")
        ok(n >= 3, T + 'hledání „Pyramida času“ má výsledky', n)
        pg.evaluate("document.getElementById('srchQ').value=''"); pg.keyboard.type('Elminster'); pg.wait_for_timeout(500)
        pg.evaluate("[...document.querySelectorAll('.srch-i')].find(a => a.getAttribute('href').startsWith('/lexikon/')).click()"); pg.wait_for_timeout(3000)
        lx = pg.evaluate("({h: location.pathname, det: document.getElementById('lxDetH')?.textContent, box: document.getElementById('searchBox').hidden})")
        ok(lx['box'] and lx['det'] and 'Elminster' in lx['det'] and lx['h'].startswith('/lexikon/'), T + 'výsledek osoby otevře heslo v Lexikonu (/lexikon/<heslo>)', lx)
        # ------------------------------------------------------------ lexikon
        go(pg, 'lexikon', 1200)
        L = pg.evaluate("""() => ({n: document.querySelectorAll('.lx-i').length, abc: document.querySelectorAll('.lx-abc button').length, count: document.getElementById('lxCount').textContent})""")
        ok(L['abc'] >= 30, T + 'lexikon: abecední rejstřík', L)
        pg.evaluate("window.__lexikon.open('o-kung-lao')"); pg.wait_for_timeout(800)
        kl = pg.evaluate("document.getElementById('lxDet').innerText")
        ok('padl' in kl and 'Feng Asay' in kl and 'Tempat Larangu' not in kl.split('Kapitoly')[0], T + 'Kung Lao: padl ve Feng Asay (upřesnění autora)', kl[:300])
        pg.evaluate("window.__lexikon.open('o-yamoh-hokhra')"); pg.wait_for_timeout(500)
        ym = pg.evaluate("document.getElementById('lxDet').innerText.toLowerCase() + document.getElementById('lxDet').innerHTML")
        ok('zmizel' in ym and 'anauroch' in ym and 'data-wit="yamoh-hokhra"' in ym, T + 'Yamoh: zmizel v bitvě o Anauroch, tlačítko svědectví', ym[:300])
        shot(pg, f'{name}-lexikon-heslo')
        if M: pg.evaluate("document.querySelector('.lx-x').click()"); pg.wait_for_timeout(400)
        pg.evaluate("document.querySelector('.lx-abc [data-l=\"\"]').click(); document.querySelector('[data-t=\"misto\"]').click()"); pg.wait_for_timeout(300)
        nm = pg.evaluate("document.querySelectorAll('.lx-i.t-misto').length === document.querySelectorAll('.lx-i').length && document.querySelectorAll('.lx-i').length > 50")
        ok(nm, T + 'filtr Místa')
        pg.evaluate("window.__lexikon.open('m-orofin')"); pg.wait_for_timeout(500)
        mo = pg.evaluate("document.getElementById('lxDet').innerHTML")
        ok('data-place="orofin"' in mo and 'mapa3d/index.html#p=orofin' in mo, T + 'místo: odkaz 2D i 3D mapa')
        pg.evaluate("document.getElementById('lxQ').value='seung'; document.getElementById('lxQ').dispatchEvent(new Event('input'))"); pg.wait_for_timeout(300)
        ok(pg.evaluate("[...document.querySelectorAll('.lx-i b')].some(b => b.textContent.includes('Seung Mina'))"), T + 'rychlé hledání v Lexikonu')
        if M: pg.evaluate("document.querySelector('.lx-x')?.click()"); pg.wait_for_timeout(300)
        go(pg, 'lexikon', 600); shot(pg, f'{name}-lexikon')
        # ------------------------------------------------------------ příběh: předěl knihy, kapitoly, hlasy, citace, změny
        # od it8: kniha = stránka s předělem, každá kapitola = vlastní stránka; součty přes všech 5 knih a 36 kapitol
        go(pg, 'kniha-I', 1500); shot(pg, f'{name}-kniha-predel')
        bk = {k: 0 for k in ('num', 'perex', 'who', 'map', 'chg', 'tr', 'vc', 'vq', 'x')}
        chs = pg.evaluate("[...document.querySelectorAll('#toc [data-toc]')].map(a => a.dataset.toc)")
        for key in ('I', 'II', 'III', 'IV', 'V'):
            go(pg, 'kniha-' + key, 300)
            r = pg.evaluate("({num: document.querySelectorAll('#stView .book-num').length, perex: document.querySelectorAll('#stView .book-perex').length, who: document.querySelectorAll('#stView .book-who').length, map: document.querySelectorAll('#stView .book-map svg').length})")
            for k, v in r.items(): bk[k] += v
        for cid in chs:
            go(pg, cid, 150)
            r = pg.evaluate("({chg: document.querySelectorAll('#stView .book-chg').length, tr: document.querySelectorAll('#stView .chap-tr').length, vc: document.querySelectorAll('#stView .chap-body .vc').length, vq: document.querySelectorAll('#stView .vq .vq-k').length, x: document.querySelectorAll('#stView .chap-body a.lk-x').length})")
            for k, v in r.items(): bk[k] += v
        ok(bk['num'] == 5 and bk['perex'] == 5 and bk['who'] == 5 and bk['map'] == 5, T + 'pět předělů knih (číslo, perex, kdo hrál, mini-mapa)', bk)
        ok(bk['chg'] == 5, T + 'na konci každé knihy „Co se změnilo“', bk)
        ok(bk['tr'] == 36, T + 'přechody kapitol (36)', bk)
        ok(bk['vc'] >= 15 and bk['vq'] >= 8, T + 'hlasy svědků v textu a citace z textů hráčů', bk)
        ok(bk['x'] > 300, T + 'odkazy na hesla (hover karty) v textu', bk)
        go(pg, 'ch-feng-asay-a-tempat-larang', 1400)
        pg.evaluate("document.querySelector('#ch-feng-asay-a-tempat-larang .vc')?.scrollIntoView({block:'center'})"); pg.wait_for_timeout(2200)
        shot(pg, f'{name}-hlas-svedka')
        vv = pg.evaluate("(() => { const v = document.querySelector('#ch-feng-asay-a-tempat-larang .vc video'); return v ? {src: !!v.getAttribute('src'), paused: v.paused} : null })()")
        if not M: ok(vv is None or (vv['src'] and not vv['paused']), T + 'živý portrét ve viditelné kartě hraje', vv)
        # hover karta
        sel = '#ch-feng-asay-a-tempat-larang .chap-body a.lk-x'
        pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center', behavior:'instant'}})"); pg.wait_for_timeout(900)
        if M: pg.tap(sel)
        else: pg.hover(sel)
        pg.wait_for_timeout(1200)
        hc = pg.evaluate("(() => { const c = document.getElementById('hoverCard'); return {vis: !c.hidden && c.classList.contains('on'), n: c.querySelector('.hc-n')?.textContent, link: c.querySelector('a[href^=\"/lexikon/\"]')?.getAttribute('href')} })()")
        ok(hc['vis'] and hc['n'] and hc['link'], T + 'hover karta u jména (portrét/věta/odkaz do Lexikonu)', hc)
        shot(pg, f'{name}-hover-karta')
        go(pg, 'ch-thultanthar-a-pyramida-casu', 1400)
        fin = pg.evaluate("document.getElementById('ch-thultanthar-a-pyramida-casu').innerText.replace(/\\u00a0/g, ' ')")
        ok('bitvy o Anauroch' in fin and 'Na vrcholu Pyramidy času svedl Rauko' in fin and 'Ho bojoval po jeho boku' in fin and 'Clariburnuse' in fin, T + 'finále: součást bitvy o Anauroch, Rauko × Rivalen, Ho s Arwin × Clariburnus (upřesnění 23. 11. 11:50)')
        go(pg, 'ch-nova-generace', 1200)  # „Co se změnilo“ je od it8 na konci poslední kapitoly knihy
        pg.evaluate("document.querySelector('#stView .book-chg').scrollIntoView({block:'center'})"); pg.wait_for_timeout(1200)
        shot(pg, f'{name}-co-se-zmenilo')
        # ------------------------------------------------------------ anglický dabing: 3 náhodní svědci, nový zvuk a české titulky podle času
        if not M:
            import random
            TIM = json.load(open('/home/claude/tethyr/assets/voices/timing.json'))
            SV = {w['id']: w for w in json.load(open('/home/claude/tethyr/data/svedectvi.json'))}
            random.seed(int(os.environ.get('SEED', '7')))
            for wid in random.sample(sorted(TIM), 3):
                pg.evaluate("document.querySelector('[data-cc=\"cs\"]')?.click()")
                pg.evaluate(f"location.hash = '#svedectvi/{wid}'"); pg.wait_for_timeout(2500)
                pg.evaluate("document.querySelector('#svedectvi [data-act=\"play\"]').click()"); pg.wait_for_timeout(1200)
                st0 = TIM[wid]['starts']; k = min(2, len(st0) - 1)
                pg.evaluate(f"window.__voice.currentTime = {st0[k] + 0.6}"); pg.wait_for_timeout(1300)
                a = pg.evaluate("({src: (window.__voice.currentSrc||'').split('/').pop(), t: window.__voice.currentTime, paused: window.__voice.paused, dur: window.__voice.duration, sub: document.querySelector('#svedectvi .w-sub p')?.textContent || ''})")
                exp_i = max(i for i, s in enumerate(st0) if s <= a['t'])
                ok(a['src'] == f'{wid}.mp3' and not a['paused'] and abs(a['dur'] - TIM[wid]['duration']) < 1.5, T + f'{wid}: hraje nový (anglický) zvuk', a)
                ok(a['sub'].replace('\xa0', ' ') == SV[wid]['titulky'][exp_i].replace('\xa0', ' '), T + f'{wid}: český titulek odpovídá času ({a["t"]:.1f} s → věta {exp_i})', (a['sub'][:60], SV[wid]['titulky'][exp_i][:60]))
            pg.evaluate("document.querySelector('[data-cc=\"en\"]').click()"); pg.wait_for_timeout(900)
            en = pg.evaluate("document.querySelector('#svedectvi .w-sub p')?.textContent || ''")
            ok(en in SV[wid]['text'], T + 'přepínač titulků EN ukáže anglický originál', en[:60])
            pg.evaluate("document.querySelector('[data-cc=\"off\"]').click()"); pg.wait_for_timeout(600)
            ok(pg.evaluate("document.querySelector('#svedectvi .w-sub p').textContent === ''"), T + 'titulky vypnuto')
            pg.evaluate("document.querySelector('[data-cc=\"cs\"]').click()"); pg.evaluate("document.querySelector('#svedectvi [data-act=\"play\"]').click()")
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"trans\"]').click()"); pg.wait_for_timeout(300)
            tr = pg.evaluate("({cs: document.querySelector('#wTrans > p:not(.w-tr-role)')?.textContent, en: !!document.querySelector('#wTrans details.w-tr-en')})")
            ok(tr['en'] and tr['cs'] in SV[wid]['titulky'], T + 'přepis česky, anglický originál k rozkliknutí', tr)
            shot(pg, f'{name}-svedectvi-titulky')
            # Elminster: video v celé délce se synchronizovanými ústy, čas videa řídí čas zvuku (ne smyčka)
            pg.evaluate("location.hash = '#svedectvi/elminster'"); pg.wait_for_timeout(2500)
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"play\"]').click()"); pg.wait_for_timeout(5000)
            el = pg.evaluate("(() => { const v = document.querySelector('#wStage .w-layer.on video.w-video'); return v ? {src: v.currentSrc.split('/').pop(), loop: v.loop, vt: v.currentTime, at: window.__voice.currentTime, paused: v.paused} : null })()")
            ok(el and el['src'] == 'elminster_plne.mp4' and not el['loop'] and abs(el['vt'] - el['at']) < 0.3 and not el['paused'], T + 'Elminster: plné video běží synchronně se zvukem (|Δ| < 0,3 s po 5 s)', el)
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"fwd\"]').click()"); pg.wait_for_timeout(1200)
            el2 = pg.evaluate("(() => { const v = document.querySelector('#wStage .w-layer.on video.w-video'); return {vt: v.currentTime, at: window.__voice.currentTime} })()")
            ok(abs(el2['vt'] - el2['at']) < 0.3, T + 'Elminster: po +10 s video dorovnané podle zvuku', el2)
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"play\"]').click()"); pg.wait_for_timeout(600)
            el3 = pg.evaluate("(() => { const v = document.querySelector('#wStage .w-layer.on video.w-video'); return {vp: v.paused, ap: window.__voice.paused} })()")
            ok(el3['vp'] and el3['ap'], T + 'Elminster: pauza zastaví video i zvuk', el3)
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"next\"]').click()"); pg.wait_for_timeout(2500)
            lp = pg.evaluate("(() => { const v = document.querySelector('#wStage .w-layer.on video.w-video'); return v ? {src: v.currentSrc.split('/').pop(), loop: v.loop} : null })()")
            ok(lp is None or (lp['loop'] and '_plne' not in lp['src']), T + 'ostatní svědci dál na krátké smyčce', lp)
            # totéž v režimu Dokument
            pg.evaluate("document.querySelector('#svedectvi [data-act=\"play\"]').click()")
            pg.click('.nav-film'); pg.wait_for_timeout(2500)
            si = pg.evaluate("__film.segs.findIndex(s => s.type === 'sv' && s.id === 'elminster')")
            pg.evaluate(f"__film.seekScene({si}, 0)"); pg.wait_for_timeout(6500)
            fe = pg.evaluate("(() => { const v = document.querySelector('#film .w-layer.on video.w-video'); return v ? {src: v.currentSrc.split('/').pop(), loop: v.loop, vt: v.currentTime, at: window.__voice.currentTime} : null })()")
            ok(fe and fe['src'] == 'elminster_plne.mp4' and not fe['loop'] and abs(fe['vt'] - fe['at']) < 0.3, T + 'Dokument: Elminster s plným videem v synchronu se zvukem', fe)
            pg.keyboard.press('Escape'); pg.wait_for_timeout(800)
        ctx.close()
    b.close()
bad = [e for e in errs if 'favicon' not in e]
ok(not bad, 'konzole bez chyb', bad[:8])
print(f'\n{len(fails)} chyb' if fails else '\nvše OK')
raise SystemExit(1 if fails else 0)

#!/usr/bin/env python3
"""Iterace 6: úvod (vstupy, nástup), jednotný systém, Družina, Bitvy, Proroctví, osa na mobilu, metadata, 404, tisk, reduced motion, klávesnice."""
import os, sys, json, urllib.request
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
fails = []
def ok(c, msg, extra=''):
    print(('OK   ' if c else 'FAIL ') + msg, extra if (extra and not c) or os.environ.get('V') else '')
    if not c: fails.append(msg)
def jclick(pg, sel):
    pg.evaluate('(s) => document.querySelector(s).click()', sel)
errs = []
with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    # ---------------------------------------------------------------- statické věci: metadata a 404
    html = urllib.request.urlopen(URL).read().decode()
    for k in ('og:title', 'og:description', 'og:image', 'twitter:card', 'apple-touch-icon', 'name="description"', 'lang="cs"'):
        ok(k in html, f'index.html obsahuje {k}')
    for path in ('img/misc/og.jpg', 'img/misc/apple-touch-icon.png', 'img/misc/favicon.svg', '404.html'):
        try: r = urllib.request.urlopen(URL + path); ok(r.status == 200, f'{path} existuje ({r.headers.get("content-length")} B)')
        except Exception as e: ok(False, f'{path} existuje', e)
    for name, opts in (('desktop', dict(viewport={'width': 1440, 'height': 900})), ('mobile', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True))):
        ctx = b.new_context(**opts); pg = ctx.new_page(); T = f'[{name}] '
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') and not noise(m) else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        pg.wait_for_timeout(5200)
        # ------------------------------------------------------------ úvod
        d = pg.evaluate("""() => ({doors: [...document.querySelectorAll('.doors .door')].map(d => d.textContent.trim().replace(/\\s+/g,' ')), letters: document.querySelectorAll('.hero-t i').length,
          h1: document.querySelector('h1').getAttribute('aria-label'), ticks: document.querySelectorAll('.hero-line i').length, stats: document.querySelectorAll('.hero-stats dt').length,
          canvas: !!document.querySelector('#uvod canvas.ash'), titleOp: getComputedStyle(document.querySelector('.hero-t i')).opacity,
          doorsOp: [...document.querySelectorAll('.doors .door')].map(d => +getComputedStyle(d).opacity),
          doorsVisible: [...document.querySelectorAll('.doors .door')].map(d => { const r = d.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 }),
          title: document.title})""")
        ok(len(d['doors']) == 5, T + 'úvod: pět vstupů', d['doors'])
        ok(all('Číst příběh' in d['doors'][0] and 'Pustit dokument' in d['doors'][1] and 'Mapa' in d['doors'][2] and 'Svědectví' in d['doors'][3] and 'Hymna' in d['doors'][4] for _ in [0]), T + 'úvod: Číst příběh / Dokument / Mapa / Svědectví / Hymna', d['doors'])
        ok(d['letters'] == 12 and d['h1'] == 'Západní draci', T + 'titul po písmenech s popiskem pro čtečky', d)
        ok(d['ticks'] == 24, T + 'léta 2003–2026 jako linka (24 značek)')
        ok(d['canvas'] and d['stats'] == 6, T + 'jiskry a prach (canvas), šest počítadel')
        ok(d['titleOp'] == '1' and all(o == 1 for o in d['doorsOp']), T + 'nástup doběhl (titul a vstupy viditelné)', d)
        ok(all(d['doorsVisible']), T + 'vstupy jsou v první obrazovce', d['doorsVisible'])
        pg.mouse.move(300, 200); pg.wait_for_timeout(400); pg.mouse.move(1100, 700); pg.wait_for_timeout(600)
        tr = pg.evaluate("getComputedStyle(document.querySelector('.hero-bg')).transform")
        ok(tr != 'none', T + 'malba má paralaxu (transform)', tr)
        pg.evaluate("window.scrollTo(0, 500)"); pg.wait_for_timeout(500)
        tr2 = pg.evaluate("getComputedStyle(document.querySelector('.hero-bg')).transform")
        ok(tr2 != tr, T + 'paralaxa reaguje na rolování')
        # ------------------------------------------------------------ jednotný systém
        # od it8: každá stránka má jeden nadpis h1 a pod obsahem jediný přechod „Dál“ (číslování oddílů I–XI zrušeno)
        hs = []
        for s in ('mapa', 'svedectvi', 'druzina', 'bitvy', 'proroctvi', 'osa', 'lexikon', 'stul', 'hymna', 'podekovani', 'pribeh'):
            go(pg, s, 400)
            hs.append(pg.evaluate("[document.querySelectorAll('main > section:not([hidden]) h1').length, document.querySelectorAll('#nextPage:not([hidden]) .nextp-a').length]"))
        ok(all(h == [1, 1] for h in hs), T + 'každá stránka: jeden h1 a jeden přechod Dál', hs)
        go(pg, 'mapa', 1200)
        ok('Mapa' in pg.title() and 'Západní draci' in pg.title(), T + 'titulek stránky podle oddílu', pg.title())
        go(pg, 'bitvy', 1200)
        ok(pg.title().startswith('Bitvy'), T + 'titulek stránky: Bitvy', pg.title())
        # ------------------------------------------------------------ družina
        go(pg, 'druzina')
        c = pg.evaluate("""() => { const cs = [...document.querySelectorAll('.pc')]; return {n: cs.length, ms: cs.filter(c => c.querySelectorAll('.pc-m').length).length, fate: cs.filter(c => c.querySelector('.pc-fate')).length,
           players: cs.map(c => c.querySelector('.pc-t em')?.textContent), txt: cs.map(c => c.textContent).join(' '), dm: document.querySelector('.dm')?.textContent.replace(/\\s+/g,' ')}}""")
        ok(c['n'] >= 12 and c['ms'] == c['n'], T + 'karty postav: milníky u všech', {k: c[k] for k in ('n', 'ms')})
        ok(c['fate'] >= c['n'] - 4, T + 'karty postav: osud', c['fate'])
        ok(all(x and x.startswith('Hraje ') for x in c['players']), T + 'karty: hráč křestním jménem', c['players'])
        ok('Zdeněk T.' in (c['dm'] or '') and 'Poděkování' in (c['dm'] or ''), T + 'Pán jeskyně Zdeněk T. s odkazem na poděkování', c['dm'])
        ok('Silverkin' not in c['txt'] and 'Wu Lej' not in c['txt'], T + 'zakázaná jména nejsou na kartách')
        jclick(pg, '.pc[data-c="rauko"]'); pg.wait_for_timeout(700)
        dr = pg.evaluate("({open: !document.querySelector('#drawer').hidden, role: document.querySelector('.dr-panel')?.getAttribute('role'), wit: !!document.querySelector('.dr-panel [data-wit]'), t: document.querySelector('.dr-panel h3')?.textContent})")
        ok(dr['open'] and dr['role'] == 'dialog' and not dr['wit'], T + 'detail postavy (dialog) bez svědectví', dr)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.querySelector('#drawer').hidden"), T + 'Esc zavře detail')
        if name == 'mobile':
            lay = pg.evaluate("(() => { const c = document.querySelector('.pc'); const r = c.getBoundingClientRect(); const i = c.querySelector('.pc-i').getBoundingClientRect(); return {w: r.width, h: r.height, iw: i.width} })()")
            ok(lay['h'] < 480, T + 'karta postavy na mobilu je kompaktní (vodorovná)', lay)
        # ------------------------------------------------------------ bitvy
        go(pg, 'bitvy')
        bt = pg.evaluate("""() => ({n: document.querySelectorAll('.bt.dp').length, paper: document.querySelectorAll('.dp-paper').length, forces: document.querySelectorAll('.dp-forces').length,
            res: document.querySelectorAll('.dp-res').length, mapBtn: [...document.querySelectorAll('.dp-links [data-place]')].map(a => a.closest('.bt').id), wit: document.querySelectorAll('.dp-links [data-wit]').length})""")
        ok(bt['n'] == 14 and bt['paper'] == 14 and bt['res'] == 14, T + 'bojová hlášení: 14 depeší s výsledkem', bt)
        ok(bt['forces'] >= 13, T + 'depeše mají strany a velitele', bt['forces'])
        ok(len(bt['mapBtn']) >= 8 and bt['wit'] >= 10, T + 'depeše mají proklik na mapu a svědky', {'map': len(bt['mapBtn']), 'wit': bt['wit']})
        bid = 'b-bitva-o-rudou-pevnost'
        go(pg, bid, 3000)
        inn = pg.evaluate(f"(() => {{ const a = document.getElementById('{bid}'); return {{in: a.classList.contains('in'), paperOp: +getComputedStyle(a.querySelector('.dp-paper')).opacity, resOp: +getComputedStyle(a.querySelector('.dp-res')).opacity}} }})()")
        ok(inn['in'] and inn['paperOp'] == 1 and inn['resOp'] == 1, T + 'animovaný nástup depeše doběhl', inn)
        jclick(pg, f'#{bid} .dp-links [data-place]'); pg.wait_for_timeout(3500)
        mp = pg.evaluate("({ui: (() => { const r = document.querySelector('#mapa .map-ui').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 })(), title: (document.querySelector('#mpPanel h3')||{}).textContent})")
        ok(mp['ui'] and mp['title'] and 'Pevnost' in mp['title'], T + 'Na mapě: ukáže mapu a kartu místa bitvy', mp)
        go(pg, bid, 600)
        pg.evaluate(f"document.querySelector('#{bid} .dp-links [data-wit]').scrollIntoView({{block:'center'}})"); pg.wait_for_timeout(300)
        jclick(pg, f'#{bid} .dp-links [data-wit]'); pg.wait_for_timeout(1500)
        ok(pg.evaluate("!!document.querySelector('#wStage')") and pg.evaluate("document.getElementById('svedectvi').getBoundingClientRect().top < innerHeight"), T + 'proklik na svědka otevře svědectví')
        # ------------------------------------------------------------ proroctví
        go(pg, 'proroctvi')
        pr = pg.evaluate("""() => ({ful: [...document.querySelectorAll('.pr-v.ful')].map(v => v.id), fulLinks: [...document.querySelectorAll('.pr-link a.ful')].map(a => a.getAttribute('href') + ' | ' + a.textContent.trim()),
            mention: [...document.querySelectorAll('.pr-link a:not(.ful)')].map(a => a.getAttribute('href')), lines: document.querySelectorAll('.pr-v .vl').length, prog: document.querySelectorAll('.pr-prog span').length})""")
        ok(pr['ful'] == ['pv-3-6', 'pv-3-7', 'pv-3-12'], T + 'proroctví: naplněné verše', pr['ful'])
        ok(all('bitva-v-anaurochu' in x for x in pr['fulLinks']) and len(pr['fulLinks']) == 3, T + 'naplněné verše odkazují na bitvu v Anaurochu, kde se souboje dohrály (upřesnění autora, it7)', pr['fulLinks'])
        ok(len(pr['mention']) >= 4, T + 'další verše odkazují na kapitoly, kde se o nich píše', pr['mention'])
        ok(pr['lines'] > 100 and pr['prog'] == 3, T + 'verše po řádcích, ukazatel kapitol I–III', pr)
        pg.evaluate("document.getElementById('pv-3-7').scrollIntoView({behavior:'instant',block:'center'})"); pg.wait_for_timeout(1800)
        lit = pg.evaluate("({lit: document.getElementById('pv-3-7').classList.contains('lit'), in: document.getElementById('pv-3-7').classList.contains('in'), op: +getComputedStyle(document.querySelector('#pv-3-7 .vl')).opacity})")
        ok(lit['lit'] and lit['in'] and lit['op'] == 1, T + 'čtený verš se rozsvítí a řádky se odhalí', lit)
        pg.evaluate("document.querySelector('#pv-3-7 .pr-link a.ful').scrollIntoView({behavior:'instant',block:'center'})"); pg.wait_for_timeout(300)
        jclick(pg, '#pv-3-7 .pr-link a.ful'); pg.wait_for_timeout(3500)
        yy = pg.evaluate("(() => { const e = document.getElementById('b-bitva-v-anaurochu'); const r = e.getBoundingClientRect(); return {top: r.top, h: innerHeight, hash: location.pathname, vis: !e.hidden} })()")
        ok(yy['vis'] and yy['top'] < yy['h'] and 'anauroch' in yy['hash'], T + 'klik na naplnění otevře hlášení bitvy v Anaurochu (vlastní adresa)', yy)
        # ------------------------------------------------------------ časová osa
        go(pg, 'osa', 1200)
        tl = pg.evaluate("""() => { const m = document.getElementById('tlMob'); const cs = [...m.querySelectorAll('.tl-y')]; const vis = getComputedStyle(m).display !== 'none';
            const small = [...m.querySelectorAll('button, a')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(e).visibility !== 'hidden'}).map(e => e.tagName + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height) + ' ' + e.textContent.slice(0, 20));
            return {vis, n: cs.length, snap: getComputedStyle(m.querySelector('.tl-mob-track')).scrollSnapType, svgVis: getComputedStyle(document.getElementById('tlScroll')).display, small, sw: document.documentElement.scrollWidth, vw: innerWidth}}""")
        ok(tl['n'] == 24, T + 'osa po letech: 24 karet (2003–2026)', tl['n'])
        if name == 'mobile':
            ok(tl['vis'] and tl['svgVis'] == 'none', T + 'na mobilu je vodorovná osa po letech místo SVG', tl)
            ok('x mandatory' in tl['snap'], T + 'přichytávání (scroll-snap)', tl['snap'])
            ok(not tl['small'], T + 'dotykové cíle osy ≥ 44 px', tl['small'][:6])
            ok(tl['sw'] <= tl['vw'] + 1, T + 'stránka nepřetéká', tl)
            jclick(pg, '.tl-mob-h button[data-y="2013"]'); pg.wait_for_timeout(1600)
            cur = pg.evaluate("document.querySelector('.tl-mob-h [aria-current=true]')?.dataset.y")
            ok(cur == '2013', T + 'skok na rok 2013 a ukazatel se přepne', cur)
            jclick(pg, '#tly-2013 .tl-pc button:not([disabled])'); pg.wait_for_timeout(800)
            ok(pg.evaluate("!document.querySelector('#drawer').hidden"), T + 'klepnutí na postavu na ose otevře její detail')
            pg.keyboard.press('Escape')
        else:
            ok(not tl['vis'] and tl['svgVis'] != 'none', T + 'na desktopu zůstává SVG osa', tl)
        # ------------------------------------------------------------ klávesnice a fokus
        pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(400)
        pg.keyboard.press('Tab'); pg.keyboard.press('Tab')
        foc = pg.evaluate("({tag: document.activeElement.tagName, txt: document.activeElement.textContent.trim().slice(0,30), ol: getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth})")
        ok('none' not in foc['ol'], T + 'fokus je viditelný (outline)', foc)
        ok(pg.evaluate("document.querySelector('.skip')") is not None, T + 'odkaz „Přeskočit na obsah“')
        ctx.close()
    # ---------------------------------------------------------------- reduced motion
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce'); pg = ctx.new_page()
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000); pg.wait_for_timeout(600)
    rm = pg.evaluate("""() => ({letters: [...document.querySelectorAll('.hero-t i')].every(i => getComputedStyle(i).opacity === '1'), doors: [...document.querySelectorAll('.door')].every(d => getComputedStyle(d).opacity === '1'),
        canvas: !!document.querySelector('#uvod canvas.ash'), stats: [...document.querySelectorAll('.hero-stats dt')].map(d => d.textContent).join(',')})""")
    ok(rm['letters'] and rm['doors'] and not rm['canvas'], 'reduced motion: obsah hned viditelný, bez částic', rm)
    ok(rm['stats'].startswith('198'), 'reduced motion: počítadla hned na konečných číslech', rm['stats'])
    go(pg, 'bitvy', 800); go(pg, 'proroctvi', 800)
    ok(pg.evaluate("[...document.querySelectorAll('.pr-v .vl')].slice(0,6).every(i => getComputedStyle(i).opacity === '1')"), 'reduced motion: verše bez čekání')
    ctx.close()
    # ---------------------------------------------------------------- tisk kapitoly
    ctx = b.new_context(viewport={'width': 1200, 'height': 900}); pg = ctx.new_page()
    pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000); pg.wait_for_timeout(500)
    go(pg, 'ch-anauroch', 1000)
    ok(pg.evaluate("!!document.querySelector('#ch-anauroch .chap-print')"), 'tisk: tlačítko „Vytisknout kapitolu“')
    pg.evaluate("window.print = () => {}")
    pg.click('#ch-anauroch .chap-print'); pg.wait_for_timeout(300)
    pg.emulate_media(media='print')
    pr = pg.evaluate("""() => { const vis = (e) => e && getComputedStyle(e).display !== 'none';
        return {attr: document.body.hasAttribute('data-print-ch'), target: vis(document.getElementById('ch-anauroch')), other: vis(document.getElementById('ch-halruaa')), topbar: vis(document.querySelector('.topbar')), map: vis(document.querySelector('#mapa')),
          bg: getComputedStyle(document.body).backgroundColor, btn: vis(document.querySelector('#ch-anauroch .chap-print')), body: vis(document.querySelector('#ch-anauroch .chap-body')), gal: vis(document.querySelector('#ch-anauroch .chap-gal'))} }""")
    ok(pr['attr'] and pr['target'] and pr['body'] and not pr['other'] and not pr['topbar'] and not pr['map'] and not pr['btn'] and not pr['gal'], 'tisk: vytiskne se jen zvolená kapitola', pr)
    ok(pr['bg'] in ('rgb(255, 255, 255)',), 'tisk: světlé pozadí', pr['bg'])
    pg.pdf(path='/tmp/kapitola.pdf'); ok(os.path.getsize('/tmp/kapitola.pdf') > 5000, 'tisk: PDF kapitoly vznikne', os.path.getsize('/tmp/kapitola.pdf'))
    ctx.close()
    b.close()
print('chyby konzole:', errs or 'žádné'); fails += [f'konzole: {e}' for e in errs]
print(f'\n{"CHYB " + str(len(fails)) if fails else "VŠE V POŘÁDKU"}')
sys.exit(1 if fails else 0)

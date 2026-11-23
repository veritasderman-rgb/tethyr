#!/usr/bin/env python3
"""Iterace 8: web rozdělený na podstránky (History API) a hlas proroctví.

Každá stránka: přímý vstup, reload, zpět, přechod „Dál“ (řetěz od Úvodu po Poděkování přes všech 5 knih a 36 kapitol),
drobečky a zvýraznění v menu, staré kotvy → nové adresy (i /index.html#… z 3D mapy), žádné staré #kotvy v odkazech,
klávesy ←/→ v kapitolách, „Pokračovat ve čtení“, 404. Proroctví: po kliknutí z menu hlas hraje a rozsvícený verš odpovídá
času, klik na verš skočí, odchod ztiší, přímý vstup ukáže tlačítko; jeden zvuk najednou (svědectví × proroctví × hymna).
Hráčské postavy bez svědectví. Desktop 1440×900 a mobil 390×844, snímky /home/claude/webshots/it8/, konzole bez chyb.
Spuštění po `npm run build` a `npx vite preview --port 4173`."""
import os, sys, json
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch, noise
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/').rstrip('/')
OUT = '/home/claude/webshots/it8'; os.makedirs(OUT, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
fails, errs = [], []
def ok(c, msg, extra=''):
    print(('OK   ' if c else 'FAIL ') + msg, extra if (extra and not c) or os.environ.get('V') else '', flush=True)
    if not c: fails.append(msg)

BOOKS = json.load(open(f'{ROOT}/public/data/books.json'))
CH = [(b['key'], c) for b in BOOKS for c in b['chapters']]
NUM = {'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5}
chp = lambda k, c: f"/pribeh/kniha-{NUM[k]}/{c['id'][3:]}"
PLAYERS = [c['id'] for c in json.load(open(f'{ROOT}/public/data/characters.json')) if c.get('kind') == 'hrac']
# stránka → (očekávaný kus titulku, další stránka v pořadí menu)
PAGES = [
    ('/', 'kronika Tethyrské', '/pribeh'), ('/pribeh', 'Příběh', '/pribeh/kniha-1'), ('/pribeh/kniha-2', 'Kniha druhá', chp('II', BOOKS[1]['chapters'][0])),
    (chp('II', BOOKS[1]['chapters'][2]), BOOKS[1]['chapters'][2]['title'], chp('II', BOOKS[1]['chapters'][3])),
    (chp('V', BOOKS[4]['chapters'][-1]), BOOKS[4]['chapters'][-1]['title'], '/druzina'),
    ('/druzina', 'Družina', '/svedectvi'), ('/svedectvi', 'Svědectví', '/bitvy'), ('/svedectvi/elminster', 'Elminster', '/bitvy'),
    ('/bitvy', 'Bitvy', '/mapa'), ('/bitvy/bitva-o-rudou-pevnost', 'Rud', None), ('/mapa', 'Mapa', '/proroctvi'), ('/mapa/3d', '3D mapa', '/proroctvi'),
    ('/proroctvi', 'Proroctví', '/osa'), ('/osa', 'Časová osa', '/lexikon'), ('/lexikon', 'Lexikon', '/u-stolu'), ('/lexikon/o-kung-lao', 'Kung Lao', '/u-stolu'),
    ('/u-stolu', 'U stolu', '/hymna'), ('/hymna', 'Hymna', '/dokument'), ('/podekovani', 'Poděkování', '/'), ('/tohle-neni', 'nenalezena', '/'),
]
SES = BOOKS[1]['chapters'][2]['sessions'][1]
LEGACY = [
    ('#uvod', '/'), ('#pribeh', '/pribeh'), ('#kniha-II', '/pribeh/kniha-2'), ('#ch-anauroch', '/pribeh/kniha-5/anauroch'),
    (f'#{SES}', chp('II', BOOKS[1]['chapters'][2]) + f'#{SES}'), ('#b-bitva-kosti', '/bitvy/bitva-kosti'), ('#pv-3-6', '/proroctvi/3-6'),
    ('#lx/o-kung-lao', '/lexikon/o-kung-lao'), ('#rejstrik', '/lexikon'), ('#svedectvi/elminster', '/svedectvi/elminster'), ('#svedectvi', '/svedectvi'),
    ('#mapa', '/mapa'), ('#mapa3d', '/mapa/3d'), ('#dokument', '/dokument'), ('#hymna', '/hymna'), ('#stul', '/u-stolu'), ('#osa', '/osa'),
    ('#druzina', '/druzina'), ('#bitvy', '/bitvy'), ('#proroctvi', '/proroctvi'), ('#lexikon', '/lexikon'), ('#podekovani', '/podekovani'),
]
def pstate(pg): return pg.evaluate("window.__prophecy.player ? window.__prophecy.player.state() : null")
def voice(pg): return pg.evaluate("({paused: __voice.paused, src: (__voice.currentSrc||'').split('/').pop(), t: __voice.currentTime, vol: __voice.volume})")

with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])   # běžná politika automatického přehrávání (bez výjimky)
    for name, opts in (('desktop', dict(viewport={'width': 1440, 'height': 900})), ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))):
        ctx = b.new_context(**opts); pg = ctx.new_page(); T = f'[{name}] '; M = name == 'mobile'
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') and not noise(m) else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 and '/tohle-neni' not in r.url else None)
        click = (lambda sel: pg.tap(sel)) if M else (lambda sel: pg.click(sel))
        def menu_go(sec):
            click('#moreBtn' if M else '#menuBtn'); pg.wait_for_timeout(450)
            click(f'#navPanel .navp-a[data-sec="{sec}"]'); ready(pg); pg.wait_for_timeout(500)
        # ------------------------------------------------------------ každá stránka: přímý vstup, titulek, h1, drobečky, Dál, reload
        for path, tit, nxt in PAGES:
            open_(pg, URL, path, 700)
            st = pg.evaluate("""() => ({page: document.body.dataset.page, h1: [...document.querySelectorAll('main > section:not([hidden]) h1')].filter(h => h.offsetParent !== null).length, title: document.title,
                next: document.querySelector('#nextPage:not([hidden]) .nextp-a')?.getAttribute('href'), crumbs: document.querySelector('#crumbs:not([hidden])')?.innerText.replace(/\\n/g, ' ') || '',
                vis: [...document.querySelectorAll('main > section')].filter(s => !s.hidden).length, sw: document.documentElement.scrollWidth, vw: innerWidth,
                old: [...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h !== '#obsah' && h !== '#nextPage' && h !== '#')})""")
            ok(st['vis'] == 1 and st['h1'] == 1, T + f'{path}: jediná viditelná stránka s jedním h1', st)
            ok(tit in st['title'], T + f'{path}: titulek „{st["title"]}“', tit)
            if nxt: ok(st['next'] == nxt, T + f'{path}: Dál → {nxt}', st['next'])
            else: ok(bool(st['next']), T + f'{path}: má přechod Dál', st['next'])
            if path.count('/') >= 2 and path != '/tohle-neni': ok(len(st['crumbs']) > 3, T + f'{path}: drobečková navigace', st['crumbs'])
            ok(not st['old'], T + f'{path}: žádné staré #kotvy v odkazech', st['old'][:5])
            ok(st['sw'] <= st['vw'] + 1, T + f'{path}: stránka nepřetéká', (st['sw'], st['vw']))
            if path in ('/', '/pribeh', '/pribeh/kniha-2', PAGES[3][0], '/bitvy', '/bitvy/bitva-o-rudou-pevnost', '/mapa/3d', '/proroctvi', '/tohle-neni'):
                pg.screenshot(path=f'{OUT}/{name}{path.replace("/", "_") or "_uvod"}.png')
            pg.reload(wait_until='networkidle'); ready(pg); pg.wait_for_timeout(400)
            ok(here(pg).split('#')[0] == path and pg.evaluate("document.body.dataset.page") == st['page'], T + f'{path}: reload zůstane na stránce', here(pg))
        # konec stránky: pod „Dál“ už jen patička
        open_(pg, URL, '/druzina')
        sib = pg.evaluate("(() => { const n = document.getElementById('nextPage'); let e = n.nextElementSibling; const out = []; while (e) { if (getComputedStyle(e).display !== 'none' && !e.hidden && e.offsetHeight) out.push(e.tagName + '.' + e.className); e = e.nextElementSibling; } return out })()")
        ok(all(x.startswith('FOOTER') or 'bottomnav' in x for x in sib), T + 'pod přechodem Dál je jen patička', sib)
        pg.evaluate("document.getElementById('nextPage').scrollIntoView({block:'center'})"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'{OUT}/{name}-dal.png')
        # ------------------------------------------------------------ řetěz „Dál“ (kliknutím) a zpět
        start = '/' if not M else '/hymna'
        open_(pg, URL, start, 500)
        chain = [here(pg)]
        for i in range(60):
            nx = pg.evaluate("document.querySelector('#nextPage .nextp-a')?.getAttribute('href')")
            if not nx or nx == '/' and len(chain) > 2: break
            pg.evaluate("document.getElementById('nextPage').scrollIntoView({block:'center'})")
            click('#nextPage .nextp-a')
            if nx == '/dokument':
                pg.wait_for_function("window.__film && !document.getElementById('film').hidden", timeout=15000); pg.wait_for_timeout(800)
                chain.append(here(pg)); pg.keyboard.press('Escape'); pg.wait_for_timeout(700)
                if here(pg) == '/dokument': pg.keyboard.press('Escape'); pg.wait_for_timeout(700)   # v celé obrazovce první Esc zachytí prohlížeč (Firefox, Safari)
                ok(here(pg) == '/hymna', T + 'Dál: Dokument otevře film, Esc vrátí zpět na Hymnu', here(pg))
                go(pg, '/podekovani', 300); chain.append(here(pg)); continue
            ready(pg); pg.wait_for_timeout(250)
            chain.append(here(pg))
        exp = (['/', '/pribeh'] + [f'/pribeh/kniha-{NUM[k]}' if j == 0 else None for k in NUM for j in [0]] ) if not M else None
        if not M:
            want = ['/', '/pribeh']
            for bk in BOOKS:
                want.append(f"/pribeh/kniha-{NUM[bk['key']]}")
                want += [chp(bk['key'], c) for c in bk['chapters']]
            want += ['/druzina', '/svedectvi', '/bitvy', '/mapa', '/proroctvi', '/osa', '/lexikon', '/u-stolu', '/hymna', '/dokument', '/podekovani']
            ok(chain == want, T + f'řetěz Dál: {len(chain)} stránek od Úvodu přes 5 knih a 36 kapitol po Poděkování', [x for x in chain if x not in want][:5] + [x for x in want if x not in chain][:5])
            # zpět v historii: z Poděkování o tři kroky (Dokument nebyl v historii, film se zavřel přes „zpět“)
            pg.go_back(); ready(pg); pg.wait_for_timeout(400)
            ok(here(pg) in ('/hymna', '/u-stolu'), T + 'zpět z Poděkování', here(pg))
            pg.go_back(); ready(pg); pg.go_back(); ready(pg); pg.wait_for_timeout(400)
            h = here(pg); ok(h in ('/lexikon', '/osa', '/u-stolu'), T + 'zpět o další kroky', h)
            pg.go_forward(); ready(pg); pg.wait_for_timeout(400)
            ok(here(pg) != h, T + 'vpřed', here(pg))
        else:
            ok(chain[:4] == ['/hymna', '/dokument', '/podekovani', '/'] or chain[:3] == ['/hymna', '/dokument', '/podekovani'], T + 'řetěz Dál od Hymny', chain)
        # ------------------------------------------------------------ staré kotvy → nové adresy (přímý vstup se starou kotvou)
        bad = []
        for h, want in LEGACY:
            pg.goto(URL + '/' + h, wait_until='networkidle'); pg.wait_for_timeout(500)
            if want != '/dokument': ready(pg)
            got = here(pg)
            if got != want: bad.append((h, got, want))
            if want == '/dokument': pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        ok(not bad, T + f'{len(LEGACY)} starých kotev přesměrováno na nové adresy', bad)
        pg.goto(URL + '/index.html#ch-shou-lung-a-velke-tazeni', wait_until='networkidle'); ready(pg)
        ok(here(pg) == '/pribeh/kniha-1/shou-lung-a-velke-tazeni', T + 'odkaz z 3D mapy (index.html#ch-…) vede na kapitolu', here(pg))
        pg.goto(URL + '/#svedectvi/khelben', wait_until='networkidle'); ready(pg); pg.wait_for_timeout(1200)
        ok(here(pg) in ('/svedectvi/khelben', '/svedectvi/khelbenova-dcera') and pg.evaluate("__wit.cur") == 'khelbenova-dcera', T + 'stará kotva svědka s aliasem', (here(pg), pg.evaluate("__wit.cur")))
        # sezení v kapitole: rozbalené a na obrazovce
        pg.goto(URL + '/' + f'#{SES}', wait_until='networkidle'); ready(pg); pg.wait_for_timeout(2500)
        se = pg.evaluate(f"(() => {{ const e = document.getElementById('{SES}'); const r = e.getBoundingClientRect(); return {{open: e.closest('details').open, top: Math.round(r.top), h: innerHeight}} }})()")
        ok(se['open'] and 0 <= se['top'] < se['h'], T + 'kotva sezení: kronika sezení rozbalená, sezení na obrazovce', se)
        # ------------------------------------------------------------ menu: zvýraznění podle adresy, drobečky
        open_(pg, URL, '/lexikon/o-kung-lao', 800)
        click('#moreBtn' if M else '#menuBtn'); pg.wait_for_timeout(450)
        cur = pg.evaluate("document.querySelector('#navPanel .navp-a.on')?.dataset.sec")
        ok(cur == 'lexikon', T + 'menu: aktuální stránka zvýrazněná podle adresy', cur)
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        go(pg, chp('III', BOOKS[2]['chapters'][1]), 600)
        click('#moreBtn' if M else '#menuBtn'); pg.wait_for_timeout(450)
        st = pg.evaluate("({sec: document.querySelector('#navPanel .navp-a.on')?.dataset.sec})")
        pg.click('.navp-exp'); pg.wait_for_timeout(600)
        st['ch'] = pg.evaluate("document.querySelector('#navBooks a[aria-current]')?.dataset.ch")
        ok(st['sec'] == 'pribeh' and st['ch'] == BOOKS[2]['chapters'][1]['id'], T + 'menu: Příběh a aktuální kapitola zvýrazněné', st)
        pg.screenshot(path=f'{OUT}/{name}-menu-kapitola.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        cr = pg.evaluate("[...document.querySelectorAll('#crumbs li')].map(l => l.textContent)")
        ok(len(cr) == 3 and cr[0] == 'Příběh' and cr[1] == 'Kniha III' and cr[2].startswith('Kapitola 15'), T + 'drobečky Příběh › Kniha III › Kapitola', cr)
        # fokus na h1 po přechodu
        click('#crumbs a[href="/pribeh/kniha-3"]'); ready(pg); pg.wait_for_timeout(500)
        ok(pg.evaluate("document.activeElement?.tagName") == 'H1' and pg.evaluate("scrollY") < 5, T + 'po přechodu: nahoře a fokus na h1', pg.evaluate("[document.activeElement?.tagName, scrollY]"))
        # ------------------------------------------------------------ kapitoly: klávesy ←/→, Pokračovat ve čtení
        if not M:
            go(pg, chp('III', BOOKS[2]['chapters'][1]), 500)
            pg.mouse.click(5, 450); pg.keyboard.press('ArrowRight'); ready(pg); pg.wait_for_timeout(500)
            ok(here(pg) == chp('III', BOOKS[2]['chapters'][2]), T + 'šipka → další kapitola', here(pg))
            pg.keyboard.press('ArrowLeft'); ready(pg); pg.wait_for_timeout(500)
            ok(here(pg) == chp('III', BOOKS[2]['chapters'][1]), T + 'šipka ← předchozí kapitola', here(pg))
        target = chp('IV', BOOKS[3]['chapters'][2])
        go(pg, target, 500)
        pg.evaluate("window.scrollTo(0, document.querySelector('.chap-body').offsetTop + 900)"); pg.wait_for_timeout(1600)
        y0 = pg.evaluate("scrollY")
        go(pg, '/pribeh', 500)
        click('.st-cont [data-cont]'); ready(pg); pg.wait_for_timeout(2500)
        y1 = pg.evaluate("scrollY")
        ok(here(pg) == target and abs(y1 - y0) < 80, T + 'Pokračovat ve čtení: kapitola i místo v ní', (here(pg), y0, y1))
        # ------------------------------------------------------------ proroctví
        open_(pg, URL, '/osa', 600)
        menu_go('proroctvi'); pg.wait_for_timeout(3500)
        s1 = pstate(pg); v1 = voice(pg)
        ok(s1 and s1['playing'] and not v1['paused'] and v1['src'] == 'kap1.mp3' and v1['t'] > 1, T + 'proroctví: po kliknutí z menu hlas hned hraje', (s1, v1))
        ok(s1 and s1['now'] == s1['expected'] and s1['now'], T + 'proroctví: rozsvícený verš odpovídá času', s1)
        pg.wait_for_timeout(13000)
        s2 = pstate(pg)
        ok(s2['now'] == s2['expected'] and s2['now'].startswith('pv-1-'), T + 'proroctví: po 13 s rozsvícený verš stále odpovídá času', s2)
        vis = pg.evaluate(f"(() => {{ const r = document.getElementById('{s2['now']}').getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight }})()")
        ok(vis, T + 'proroctví: stránka doroluje k verši, který zní')
        pg.screenshot(path=f'{OUT}/{name}-proroctvi-hraje.png')
        pg.evaluate("document.getElementById('pv-2-4').scrollIntoView({block:'center'})"); pg.wait_for_timeout(400)
        click('#pv-2-4 > p'); pg.wait_for_timeout(1800)
        s3 = pstate(pg); v3 = voice(pg)
        ok(s3['ch'] == 1 and s3['now'] == 'pv-2-4' and v3['src'] == 'kap2.mp3' and not v3['paused'], T + 'proroctví: klik na verš = skok hlasu', (s3, v3))
        click('#ppPlay'); pg.wait_for_timeout(400); ok(voice(pg)['paused'], T + 'proroctví: pauza v přichyceném ovládání')
        click('#ppPlay'); pg.wait_for_timeout(800); ok(not voice(pg)['paused'], T + 'proroctví: znovu přehrát')
        click('#ppMute'); ok(pg.evaluate("__voice.muted"), T + 'proroctví: ztlumení'); click('#ppMute')
        click('[data-pch="2"]'); pg.wait_for_timeout(1500)
        s4 = pstate(pg); ok(s4['ch'] == 2 and voice(pg)['src'] == 'kap3.mp3' and s4['now'] == 'pt-3', T + 'proroctví: tlačítko kapitoly III', s4)
        # konec kapitoly I → plynule II
        click('[data-pch="0"]'); pg.wait_for_timeout(1200)
        pg.evaluate("__voice.currentTime = __voice.duration - 1.2"); pg.wait_for_timeout(3500)
        v5 = voice(pg); ok(v5['src'] == 'kap2.mp3' and not v5['paused'], T + 'proroctví: po kapitole I plynule pokračuje II', v5)
        if not M:
            pg.mouse.wheel(0, 1600); pg.wait_for_timeout(1200)
            ok(pg.evaluate("!document.getElementById('ppFollow').hidden"), T + 'proroctví: rolování pozastaví automatické dorolování (tlačítko K verši)')
        # odchod ze stránky: hlas ztichne
        menu_go('hymna'); pg.wait_for_timeout(1500)
        v6 = voice(pg); ok(v6['paused'] and abs(v6['vol'] - 0.9) < 0.05, T + 'proroctví: při odchodu hlas ztichne (fade) a hlasitost se vrátí', v6)
        pg.go_back(); ready(pg); pg.wait_for_timeout(2500)
        s7 = pstate(pg); ok(here(pg) == '/proroctvi' and s7['playing'], T + 'proroctví: zpět = hlas pokračuje', (here(pg), s7))
        # jeden zvuk najednou: hymna × proroctví × svědectví
        go(pg, '/hymna', 800)
        ok(voice(pg)['paused'], T + 'na Hymně proroctví nehraje')
        pg.evaluate("document.getElementById('hyClip') ? document.getElementById('hyClip').play() : document.getElementById('hyAudio').play()"); pg.wait_for_timeout(1500)
        go(pg, '/svedectvi', 800)
        click('.wc[data-id="isis"]'); pg.wait_for_timeout(3000)
        hy = pg.evaluate("[...document.querySelectorAll('#hyClip, #hyAudio')].every(m => m.paused)")
        ok(hy and not voice(pg)['paused'] and voice(pg)['src'] == 'isis.mp3', T + 'jeden zvuk: odchod z Hymny a svědectví nehrají přes sebe', (hy, voice(pg)))
        menu_go('proroctvi'); pg.wait_for_timeout(2500)
        ok(voice(pg)['src'].startswith('kap') and not voice(pg)['paused'] and pg.evaluate("__wit.state") != 'play', T + 'jeden zvuk: proroctví převezme hlas od svědectví', (voice(pg), pg.evaluate("__wit.state")))
        # přímý vstup na adresu verše: tlačítko, verš na obrazovce, po klepnutí hraje od něj
        ctx2 = b.new_context(**opts); pg2 = ctx2.new_page()
        pg2.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        open_(pg2, URL, '/proroctvi/2-5', 1800)
        s8 = pg2.evaluate("window.__prophecy.player.state()")
        cta = pg2.evaluate("(() => { const b = document.getElementById('ppStart'); return !!b && b.offsetParent !== null })()")
        vv = pg2.evaluate("(() => { const r = document.getElementById('pv-2-5').getBoundingClientRect(); return r.top > -10 && r.top < innerHeight })()")
        ok(not s8['playing'] and cta and vv, T + 'přímý vstup /proroctvi/2-5: nehraje samo, výrazné tlačítko, verš na obrazovce', (s8, cta, vv))
        pg2.evaluate("document.getElementById('ppStart').scrollIntoView({block:'center'})")
        (pg2.tap if M else pg2.click)('#ppStart'); pg2.wait_for_timeout(2200)
        s9 = pg2.evaluate("window.__prophecy.player.state()")
        ok(s9['playing'] and s9['now'] == 'pv-2-5' and s9['now'] == s9['expected'], T + 'po klepnutí na „Vyslechnout proroctví“ hraje od verše', s9)
        pg2.screenshot(path=f'{OUT}/{name}-proroctvi-primo.png')
        ctx2.close()
        # ------------------------------------------------------------ hráčské postavy bez svědectví
        open_(pg, URL, '/svedectvi/rauko', 1500)
        gal = pg.evaluate("[...document.querySelectorAll('.wc')].map(c => c.dataset.id)")
        ok(not (set(gal) & set(PLAYERS)) and pg.evaluate("__wit.cur") not in PLAYERS, T + 'hráčské postavy nemají svědectví (galerie ani adresa)', set(gal) & set(PLAYERS))
        ctx.close()
    b.close()
bad = [e for e in errs if 'favicon' not in e]
ok(not bad, 'konzole bez chyb a bez HTTP chyb', bad[:8])
print(f'\n{len(fails)} chyb' if fails else '\nvše OK')
raise SystemExit(1 if fails else 0)

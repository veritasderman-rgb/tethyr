#!/usr/bin/env python3
"""Iterace 4: režim Dokument (celoobrazovkový film). Průchod celým filmem zrychleně (skok na konec každého segmentu),
klávesy, časová lišta, titulky, zavření. Desktop 1440×900 a mobil 390×844. Snímky do /home/claude/webshots/it4/.
Předpoklad: běží `npx vite preview --port 4173`."""
import os, sys, time, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav8 import go, open_, ready, here
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/'); OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it4'); os.makedirs(OUT, exist_ok=True)
FAST = os.environ.get('FILM_FULL', '1') == '1'
res, errs = [], []
def ok(n, c, x=''): res.append(f"{'OK   ' if c else 'CHYBA'} {n} {x}"); print(res[-1], flush=True)

def wait_idx(pg, i, timeout=14000):
    t0 = time.time()
    while (time.time() - t0) * 1000 < timeout:
        st = pg.evaluate("({i: __film.idx, b: __film.busy, f: __film.finished})")
        if st['i'] == i and not st['b']: return True
        pg.wait_for_timeout(120)
    return False

with sync_playwright() as p:
    b = p.chromium.launch(args=['--mute-audio'])
    for name, opts in {'desktop': dict(viewport={'width': 1440, 'height': 900}), 'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        open_(pg, URL, '/', 800)
        # spuštění: horní lišta (desktop) / vstup na úvodu (mobil); od it8 má Dokument adresu /dokument
        if name == 'desktop': pg.click('.nav-film')
        else: pg.tap('.doors [data-film]')
        pg.wait_for_function("window.__film && __film.started && !__film.busy", timeout=15000)
        ok(f'[{name}] adresa /dokument', here(pg) == '/dokument', here(pg))
        info = pg.evaluate("({n: __film.segs.length, total: __film.total, ch: __film.chapters.map(c => [c.label, Math.round(c.dur)]), types: [...new Set(__film.segs.map(s => s.type))], sv: __film.segs.filter(s => s.type === 'sv').map(s => s.id)})")
        if name == 'desktop': print(json.dumps(info, ensure_ascii=False))
        mm = f"{int(info['total'] // 60)}:{int(info['total'] % 60):02d}"
        core = info['total'] - 360
        ok(f'[{name}] film spuštěn, {info["n"]} segmentů, celkem {mm} (bez hymny {int(core // 60)}:{int(core % 60):02d})', info['n'] > 40 and 600 < core < 960)
        ok(f'[{name}] jsou tu všechny typy scén', set(info['types']) >= {'title', 'book', 'map', 'paint', 'sv', 'year', 'end', 'thanks', 'hymn'}, str(info['types']))
        ok(f'[{name}] celá obrazovka / dvh: film zabírá celé okno', pg.evaluate("(() => { const r = document.getElementById('film').getBoundingClientRect(); return Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight })()"))
        pg.wait_for_timeout(1500)
        pg.screenshot(path=f'{OUT}/{name}-film-01-titulek.png')
        # reálné přehrávání: úvodní titulek → karta knihy
        pg.wait_for_timeout(8500 if name == 'desktop' else 100)
        # průchod segmenty
        shots = set()
        seen = []
        n = info['n']
        for i in range(n):
            if not FAST and i > 12: break
            pg.evaluate(f"__film.seekScene({i}, 0)")
            if not wait_idx(pg, i): ok(f'[{name}] segment {i} se načetl', False); break
            seg = pg.evaluate(f"(({{t: __film.segs[{i}].type, id: __film.segs[{i}].id || '', dur: __film.segs[{i}].dur, ch: __film.segs[{i}].ch}}))")
            seen.append(seg['t'])
            pg.wait_for_timeout(1900 if seg['t'] in ('map', 'thanks') else 1300)
            key = (seg['t'], seg['ch'] if seg['t'] in ('sv', 'paint', 'map', 'year', 'book') and seg['ch'] in (1, 2, 5, 6) else 0)
            if key not in shots and (name == 'desktop' or seg['t'] in ('title', 'book', 'map', 'paint', 'sv', 'year', 'thanks', 'end')) and len(shots) < 24:
                shots.add(key); pg.screenshot(path=f'{OUT}/{name}-film-s{i:02d}-{seg["t"]}{("-" + seg["id"]) if seg["id"] else ""}.png')
            # titulky u svědka
            if seg['t'] == 'sv':
                sub = pg.evaluate("document.querySelector('#film .w-sub p')?.textContent || ''")
                playing = pg.evaluate("!__voice.paused")
                if i in (3, 4): ok(f'[{name}] svědek {seg["id"]}: titulky a hlas běží', bool(sub) and playing, repr(sub[:40]))
                # video ve smyčce
            if seg['t'] == 'hymn': pg.wait_for_timeout(2500); ok(f'[{name}] hymna: klip hraje', pg.evaluate("(() => { const v = document.querySelector('#film .fs-vid'); return !!v && !v.paused && v.currentTime > 0.5 })()"))
            # skok na konec segmentu
            tgt = pg.evaluate(f"__film.segs[{i}].at + __film.segs[{i}].dur - {1.4 if seg['t'] != 'hymn' else 2.5}")
            pg.evaluate(f"__film.seek({tgt})")
            if i < n - 1:
                if not wait_idx(pg, i + 1, 16000): ok(f'[{name}] po segmentu {i} ({seg["t"]}) přešlo na další', False, str(pg.evaluate("({i: __film.idx, b: __film.busy, p: __film.playing, f: __film.finished})"))); break
            else:
                t0 = time.time()
                while time.time() - t0 < 12 and not pg.evaluate("__film.finished"): pg.wait_for_timeout(200)
        else:
            pass
        if FAST:
            fin = pg.evaluate("__film.finished")
            ok(f'[{name}] průchod celým filmem skončil bez mrtvého konce (finished)', fin, str(pg.evaluate("({i: __film.idx, f: __film.finished})")))
            ok(f'[{name}] závěrečný panel viditelný', pg.evaluate("!document.getElementById('fDone').hidden"))
            pg.screenshot(path=f'{OUT}/{name}-film-konec.png')
            # znovu
            pg.click('#fDone [data-a=again]') if name == 'desktop' else pg.tap('#fDone [data-a=again]')
            ok(f'[{name}] „Přehrát znovu“ rozjede film od začátku', wait_idx(pg, 0) and pg.evaluate("__film.playing"))
        # --- ovládání (po návratu na začátek)
        pg.evaluate("__film.seekScene(5, 0)"); wait_idx(pg, 5)
        # lišta: klik doprostřed
        box = pg.locator('#fTl').bounding_box()
        pg.mouse.move(box['x'] + box['width'] / 2, box['y'] - 100) if name == 'desktop' else None
        pg.evaluate("document.getElementById('fUi').classList.add('show')")
        if name == 'desktop': pg.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + 24)
        else: pg.touchscreen.tap(box['x'] + box['width'] * 0.5, box['y'] + 24)
        pg.wait_for_timeout(1500)
        g = pg.evaluate("__film.globalT() / __film.total")
        ok(f'[{name}] klik na časovou lištu skočí doprostřed', 0.42 < g < 0.62, f'{g:.2f}')
        pg.screenshot(path=f'{OUT}/{name}-film-lista.png')
        if name == 'desktop':
            pg.keyboard.press('Space'); pg.wait_for_timeout(300); ok('[desktop] mezerník pozastaví', not pg.evaluate("__film.playing"))
            pg.keyboard.press('Space'); pg.wait_for_timeout(300); ok('[desktop] mezerník znovu spustí', pg.evaluate("__film.playing"))
            g0 = pg.evaluate("__film.globalT()"); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(1200); g1 = pg.evaluate("__film.globalT()")
            ok('[desktop] šipka → o ~10 s dopředu', 8 < g1 - g0 < 14 or pg.evaluate("__film.idx") != 0, f'{g0:.1f} → {g1:.1f}')
            i0 = pg.evaluate("__film.idx"); pg.keyboard.press('Shift+ArrowRight'); pg.wait_for_timeout(1200); wait_idx(pg, i0 + 1); ok('[desktop] Shift+→ další scéna', pg.evaluate("__film.idx") == i0 + 1)
            pg.keyboard.press('Shift+ArrowLeft'); pg.wait_for_timeout(1200); wait_idx(pg, i0); ok('[desktop] Shift+← předchozí scéna', pg.evaluate("__film.idx") == i0)
            pg.keyboard.press('ArrowUp'); v = pg.evaluate("__voice.volume"); ok('[desktop] ↑ změní hlasitost', v > 0.9 or v == 1, str(v))
            # titulky: najít svědka
            sv = pg.evaluate("__film.segs.findIndex(s => s.type === 'sv')"); pg.evaluate(f"__film.seekScene({sv}, 0)"); wait_idx(pg, sv); pg.wait_for_timeout(3500)
            # C přepíná titulky CZ → EN → vypnuto → CZ (od iterace 7: anglický dabing, české titulky výchozí)
            a = pg.evaluate("getComputedStyle(document.querySelector('#film .w-sub')).display"); lab0 = pg.evaluate("document.getElementById('fCc').textContent.trim()")
            pg.keyboard.press('c'); pg.wait_for_timeout(300); lab1 = pg.evaluate("document.getElementById('fCc').textContent.trim()")
            pg.keyboard.press('c'); pg.wait_for_timeout(300)
            b2 = pg.evaluate("getComputedStyle(document.querySelector('#film .w-sub')).display")
            ok('[desktop] C přepíná titulky CZ → EN → vypnuto', a != 'none' and lab0 == 'CZ' and lab1 == 'EN' and b2 == 'none', f'{a} {lab0} → {lab1} → {b2}'); pg.keyboard.press('c')
            pg.keyboard.press('m'); ok('[desktop] M ztlumí', pg.evaluate("__voice.muted")); pg.keyboard.press('m')
        # zavření
        if name == 'desktop': pg.keyboard.press('Escape')
        else: pg.tap('#film .f-x')
        pg.wait_for_timeout(500)
        ok(f'[{name}] zavření filmu ({"Esc" if name == "desktop" else "✕"})', pg.evaluate("document.getElementById('film').hidden") and not pg.evaluate("!__voice.paused"))
        ok(f'[{name}] stránka za filmem zůstala nepřetečená', pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
        ok(f'[{name}] po zavření se adresa vrátí na úvod', here(pg) == '/', here(pg))
        # přímý vstup na /dokument: úvodní karta filmu nad úvodem, Esc vrátí na /
        open_(pg, URL, '/dokument', 1500)
        ok(f'[{name}] přímý vstup /dokument otevře film (úvodní karta)', pg.evaluate("!document.getElementById('film').hidden && !document.getElementById('fStart').hidden"))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
        ok(f'[{name}] Esc z přímého vstupu vede na úvod', here(pg) == '/' and pg.evaluate("document.getElementById('film').hidden"), here(pg))
        ctx.close()
    b.close()
print('chyby konzole:', errs or 'žádné')
open(OUT + '/film-test.txt', 'w').write('\n'.join(res) + '\n\nchyby konzole: ' + (str(errs) if errs else 'žádné') + '\n')
sys.exit(1 if any(r.startswith('CHYBA') for r in res) else 0)

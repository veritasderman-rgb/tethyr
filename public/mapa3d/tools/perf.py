#!/usr/bin/env python3
"""Měření 3D mapy v headless Chromiu: doba načtení, přenesená data, draw calls a trojúhelníky v typických pohledech.
Spuštění (náhled webu běží): python3 tools/perf.py [URL]   (výchozí http://127.0.0.1:4173/mapa3d/index.html)"""
import sys, json, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/mapa3d/index.html'
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'])
    for name, opts, q in [('desktop', dict(viewport={'width': 1440, 'height': 900}), '?q=high'),
                          ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True), '?load=1')]:
        ctx = b.new_context(**opts); pg = ctx.new_page()
        errs = []; bytes_ = [0]
        pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
        def onresp(r):
            try: bytes_[0] += int(r.headers.get('content-length') or len(r.body()))
            except Exception: pass
        pg.on('response', onresp)
        t0 = time.time(); pg.goto(URL + q); pg.wait_for_function('window.__ready === true', timeout=120000); tl = time.time() - t0
        pg.wait_for_timeout(4000)
        f0 = pg.evaluate('__perf().frame'); pg.wait_for_timeout(5000); fps = (pg.evaluate('__perf().frame') - f0) / 5
        out = {'fps_swiftshader': round(fps, 1), 'load_s': round(tl, 1), 'MB_at_ready': round(bytes_[0] / 1e6, 2)}
        for v in ['all', 'tethyr', 'anauroch', 'karatur', 'spheres']:
            pg.evaluate(f"__map.flyView('{v}')"); pg.wait_for_timeout(500)
            pg.wait_for_function('!__perf().anim', timeout=60000)
            f0 = pg.evaluate('__perf().frame'); pg.wait_for_function(f'__perf().frame > {f0} + 20', timeout=60000)
            out[v] = pg.evaluate('__perf()')
        out['MB_after_views'] = round(bytes_[0] / 1e6, 2)
        out['errors'] = errs[:10]
        res[name] = out
        ctx.close()
    b.close()
print(json.dumps(res, indent=1, ensure_ascii=False))

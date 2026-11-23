#!/usr/bin/env python3
"""Ikony a náhledový obrázek pro sdílení (OG 1200x630) z malby D_01 a písma Cinzel/Cardo z node_modules. Lokálně, bez placených služeb."""
import os, pathlib, re
from playwright.sync_api import sync_playwright
R = pathlib.Path(__file__).resolve().parent.parent
M = R / 'public/img/misc'
# Logo = src/assets/draci.svg (jediný zdroj: dračí hlava). Favicon: tmavý čtverec se zlatou hlavou bez rámečku (čitelné v 16 px).
DR = (R / 'src/assets/draci.svg').read_text(encoding='utf-8')
INNER = re.search(r'<svg[^>]*>(.*)</svg>', DR, re.S).group(1)
(M / 'favicon.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Západní draci</title><rect width="64" height="64" rx="12" fill="#12100d"/><g transform="translate(4.6 5.5) scale(.9)" fill="#c9a54a">{INNER}</g></svg>', encoding='utf-8')
font = lambda f: (R / 'node_modules/@fontsource' / f).as_uri()
html = f'''<!doctype html><meta charset=utf-8><style>
@font-face{{font-family:Cin;src:url({font('cinzel/files/cinzel-latin-400-normal.woff2')})}}
@font-face{{font-family:Car;src:url({font('cardo/files/cardo-latin-400-italic.woff2')});font-style:italic}}
@font-face{{font-family:Fira;src:url({font('fira-sans/files/fira-sans-latin-500-normal.woff2')})}}
html,body{{margin:0;width:1200px;height:630px;background:#12100d;overflow:hidden}}
.bg{{position:absolute;inset:0;background:url({(R/'public/img/ilu/D_01-1360.webp').as_uri()}) 50% 24%/cover}}
.sh{{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,16,13,.86) 0,rgba(18,16,13,.5) 45%,rgba(18,16,13,.05) 75%),linear-gradient(180deg,transparent 55%,rgba(18,16,13,.9))}}
.t{{position:absolute;left:70px;bottom:64px;color:#eadfc6}}
.k{{font:500 19px Fira;letter-spacing:.34em;text-transform:uppercase;color:#c9a54a;margin-bottom:18px}}
h1{{font:400 118px/.92 Cin;letter-spacing:.04em;text-transform:uppercase;margin:0;text-shadow:0 4px 40px #000}}
h1 span{{display:block}} h1 span+span{{color:#d9cba9}}
.y{{font:italic 30px Car;margin-top:22px;color:#eadfc6}} .y b{{font-style:normal;font-weight:400;color:#c9a54a}}
.l{{position:absolute;left:70px;top:58px;width:120px;height:1px;background:#c9a54a}}
.lg{{position:absolute;left:70px;top:70px;width:74px;height:74px;color:#c9a54a;filter:drop-shadow(0 2px 12px #000)}}
</style><div class=bg></div><div class=sh></div><div class=l></div><svg class=lg viewBox="0 0 64 64" fill="currentColor">{INNER}</svg><div class=t><div class=k>Kronika Tethyrské královské družiny</div><h1><span>Západní</span><span>draci</span></h1><div class=y>ve hře <b>1372–1385</b> · u stolu <b>2003–2026</b></div></div>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    open('/tmp/og.html', 'w').write(html); pg.goto('file:///tmp/og.html'); pg.wait_for_timeout(1000)
    pg.screenshot(path='/tmp/og.png')
    for size, name in ((32, 'favicon-32.png'), (180, 'apple-touch-icon.png')):
        q = b.new_page(viewport={'width': size, 'height': size})
        open('/tmp/ic.html', 'w').write(f'<body style="margin:0"><img src="{(M/"favicon.svg").as_uri()}" width={size} height={size}>')
        q.goto('file:///tmp/ic.html'); q.wait_for_timeout(300); q.screenshot(path=str(M / name), omit_background=True); q.close()
    b.close()
os.system(f'convert /tmp/og.png -quality 82 -strip "{M}/og.jpg"')
print('ok', os.path.getsize(M / 'og.jpg') // 1024, 'kB')

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
@font-face{{font-family:Cin;src:url({font('cinzel/files/cinzel-latin-ext-400-normal.woff2')});unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}}
@font-face{{font-family:Car;src:url({font('cardo/files/cardo-latin-400-italic.woff2')});font-style:italic}}
@font-face{{font-family:Car;src:url({font('cardo/files/cardo-latin-ext-400-italic.woff2')});font-style:italic;unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}}
@font-face{{font-family:Fira;src:url({font('fira-sans/files/fira-sans-latin-500-normal.woff2')})}}
@font-face{{font-family:Fira;src:url({font('fira-sans/files/fira-sans-latin-ext-500-normal.woff2')});unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF}}
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

# ---- vlastní náhledy pro sdílení (1200×630) pro hlavní adresy: malba kapitoly + nápis stránky (kulatý název v dolní části)
import json
sys_path = str(R / 'src/lib/pages.js')
OG = R / 'public/img/og'; OG.mkdir(exist_ok=True)
PAGES = json.loads(os.popen(f'node -e "import(\'{sys_path}\').then(m=>console.log(JSON.stringify(m.PAGES)))"').read())
BOOKS = json.load(open(R / 'public/data/books.json', encoding='utf-8'))
PAINT = {'uvod': 'D_01', 'pribeh': 'D_02', 'druzina': 'D_03', 'svedectvi': 'D_04', 'bitvy': 'D_05', 'mapa': 'D_06', 'proroctvi': 'D_02', 'osa': 'D_03',
         'lexikon': 'D_04', 'stul': 'D_05', 'hymna': 'D_06', 'dokument': 'D_01', 'podekovani': 'D_02'}
SLUGS = {'stul': 'u-stolu'}
cards = [(SLUGS.get(p['id'], p['id']), 'Kronika Tethyrské královské družiny', p['label'], p['sub'], PAINT[p['id']]) for p in PAGES if p['id'] != 'uvod']
cards += [(f'kniha-{i + 1}', f'Příběh · {b["kap"]}', b['title'], f've hře {b["dr"]} · u stolu {b["real"]}', b['img'][0] if isinstance(b['img'], list) else b['img']) for i, b in enumerate(BOOKS)]
style = html.split('</style>')[0].split('<style>')[1]
def card(kick, title, sub, paint):
    return f'''<!doctype html><meta charset=utf-8><style>{style}
h1{{font-size:{'92px' if len(title) < 14 else '70px' if len(title) < 26 else '54px'};line-height:1}}
.y{{font-size:28px}}</style><div class=bg style="background-image:url({(R/'public/img/ilu'/(paint + '-1360.webp')).as_uri()})"></div><div class=sh></div><div class=l></div>
<svg class=lg viewBox="0 0 64 64" fill="currentColor">{INNER}</svg><div class=t><div class=k>{kick}</div><h1>{title}</h1><div class=y>{sub}</div></div>'''
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1200, 'height': 630})
    for slug, kick, title, sub, paint in cards:
        paint = paint.split('/')[-1]
        open('/tmp/ogc.html', 'w').write(card(kick, title, sub, paint)); pg.goto('file:///tmp/ogc.html'); pg.wait_for_timeout(350)
        pg.screenshot(path='/tmp/ogc.png'); os.system(f'convert /tmp/ogc.png -quality 68 -strip "{OG}/{slug}.jpg"')
    b.close()
print('náhledy:', len(cards), sum(x.stat().st_size for x in OG.glob('*.jpg')) // 1024, 'kB')
print('ok', os.path.getsize(M / 'og.jpg') // 1024, 'kB')

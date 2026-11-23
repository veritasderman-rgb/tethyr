#!/usr/bin/env python3
"""Iterace 4: snímky všech oddílů (desktop 1440×900 a mobil 390×844) do /home/claude/webshots/it4/ + audit přetečení a dotykových cílů."""
import os, json
from playwright.sync_api import sync_playwright
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
OUT = os.environ.get('SHOT_OUT', '/home/claude/webshots/it4'); os.makedirs(OUT, exist_ok=True)
SECS = ['uvod', 'pribeh', 'mapa', 'svedectvi', 'druzina', 'bitvy', 'proroctvi', 'osa', 'lexikon', 'stul', 'hymna', 'podekovani']
VIEWS = {'desktop': dict(viewport={'width': 1440, 'height': 900}),
         'mobile': dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)}
errs = []
AUDIT = """() => {
  const out = {over: [], small: []};
  const vw = innerWidth;
  document.querySelectorAll('body *').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed') return;
    if (e.closest('.film, .lightbox, .drawer, .leaflet-container, #mainNav:not(.open), svg, canvas, .tl-scroll, .pl-scroll, .bt-units, .booknav, .hero-bg, .fs, [hidden]')) return;
    if (r.right > vw + 2 && r.left < vw && !e.closest('[style*="overflow"]')) { let p = e.parentElement, clipped = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } p = p.parentElement; } if (!clipped) out.over.push(e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '') + ' ' + Math.round(r.right)); }
  });
  document.querySelectorAll('a[href], button, input, select, summary, [role=button], [role=slider]').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;   // jen to, co je právě vidět
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return;
    if (e.closest('.leaflet-container, [hidden], .film') || (e.closest('#mainNav') && !e.closest('#mainNav.open'))) return;
    if (e.matches('a') && e.closest('p, li, .chap-v, .vq, figcaption, .w-info, .w-trans, .lede, dd, td') && cs.display === 'inline') return; // vložené odkazy v textu
    if (r.top > innerHeight * 3 && false) return;
    if (r.width < 44 || r.height < 44) out.small.push((e.id ? '#' + e.id : e.tagName + '.' + String(e.className).split(' ')[0]) + ' ' + Math.round(r.width) + '×' + Math.round(r.height) + ' ' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24));
  });
  out.sw = document.documentElement.scrollWidth; out.vw = vw;
  return out;
}"""
with sync_playwright() as p:
    b = p.chromium.launch(args=['--mute-audio'])
    for name, opts in VIEWS.items():
        ctx = b.new_context(**opts); pg = ctx.new_page()
        pg.on('console', lambda m, n=name: errs.append(f'[{n}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, n=name: errs.append(f'[{n}] pageerror: {e}'))
        pg.on('response', lambda r, n=name: errs.append(f'[{n}] HTTP {r.status}: {r.url}') if r.status >= 400 else None)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_selector('#loading', state='detached', timeout=15000)
        for s in SECS:
            for _ in range(2):
                pg.evaluate(f"document.getElementById('{s}')?.scrollIntoView({{behavior:'instant', block:'start'}})"); pg.wait_for_timeout(1000)
            pg.screenshot(path=f'{OUT}/{name}-{s}.png')
            a = pg.evaluate(AUDIT)
            print(f'[{name}] {s}: scrollWidth {a["sw"]}/{a["vw"]}  přetékají {len(a["over"])}' + (f'  malé cíle {len(a["small"])}' if name == 'mobile' else ''))
            for o in a['over'][:6]: print('     přetéká', o)
            if name == 'mobile':
                for o in a['small'][:16]: print('     malé', o)
        ctx.close()
    b.close()
print('chyby konzole:', errs or 'žádné')

#!/usr/bin/env python3
"""Váha prvního načtení úvodní stránky (bez scrollování) a velikost repa. Náhled musí běžet (npx vite preview --port 4173)."""
import os, subprocess, json
from collections import defaultdict
from playwright.sync_api import sync_playwright
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from browsers import launch
URL = os.environ.get('SHOT_URL', 'http://127.0.0.1:4173/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = {}
with sync_playwright() as p:
    b = launch(p, ['--mute-audio'])
    for name, opts in [('desktop', dict(viewport={'width': 1440, 'height': 900})),
                       ('mobile', dict(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True))]:
        ctx = b.new_context(**opts); pg = ctx.new_page()
        cdp = ctx.new_cdp_session(pg); cdp.send('Network.enable')
        tot = defaultdict(int); urls = {}
        def fin(e):
            urls.setdefault(e['requestId'], None)
            tot[e['requestId']] = e.get('encodedDataLength', 0)
        reqs = {}
        cdp.on('Network.requestWillBeSent', lambda e: reqs.__setitem__(e['requestId'], e['request']['url']))
        cdp.on('Network.loadingFinished', fin)
        pg.goto(URL, wait_until='networkidle'); pg.wait_for_timeout(4000)
        by = defaultdict(int)
        for rid, n in tot.items():
            u = reqs.get(rid, '?'); ext = u.split('?')[0].rsplit('.', 1)[-1][:5]; by[ext] += n
        big = sorted(((n, reqs.get(r, '?').replace(URL, '')) for r, n in tot.items()), reverse=True)[:8]
        res[name] = {'MB': round(sum(tot.values()) / 1e6, 2), 'requests': len(tot), 'by_type_kB': {k: round(v / 1e3) for k, v in sorted(by.items(), key=lambda x: -x[1])}, 'largest': [(round(n / 1e3), u) for n, u in big]}
        ctx.close()
    b.close()
tree = subprocess.run(['du', '-sb', '--exclude=node_modules', '--exclude=dist', '--exclude=.git', ROOT], capture_output=True, text=True).stdout.split()[0]
dist = subprocess.run(['du', '-sb', ROOT + '/dist'], capture_output=True, text=True).stdout.split()[0]
res['repo_worktree_MB'] = round(int(tree) / 1e6, 1); res['dist_MB'] = round(int(dist) / 1e6, 1)
print(json.dumps(res, indent=1, ensure_ascii=False))

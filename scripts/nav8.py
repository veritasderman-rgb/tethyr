"""Pomůcky pro testy od iterace 8 (web rozdělený na podstránky, History API).

go(pg, 'bitvy') / go(pg, 'ch-anauroch') / go(pg, 'kniha-II') / go(pg, 'b-bitva-kosti') přejde na stránku podle
staré kotvy (překlad dělá router webu: window.__router.legacy) nebo podle cesty ('/mapa/3d'); open_(pg, url, path)
otevře adresu přímo. ready(pg) počká, až je aktuální stránka vykreslená."""
READY = "(() => { const p = document.body.dataset.page; if (!p) return false; if (p === 'nenalezeno') return true; const s = document.getElementById(p); return !!s && s.hasAttribute('data-ready') && !s.hidden; })()"

def ready(pg, timeout=int(__import__('os').environ.get('READY_MS', '20000'))):
    pg.wait_for_function(READY, timeout=timeout)

def open_(pg, url, path='/', ms=600):
    pg.goto(url.rstrip('/') + path, wait_until='networkidle')
    pg.wait_for_selector('#loading', state='detached', timeout=20000)
    ready(pg); pg.wait_for_timeout(ms)

def path_of(pg, sec):
    if sec.startswith('/'): return sec
    return pg.evaluate("(s) => window.__router.legacy('#' + s) || '/' + s", sec)

def go(pg, sec, ms=900):
    pg.evaluate("(p) => window.__router.navigate(p)", path_of(pg, sec))
    ready(pg); pg.wait_for_timeout(ms)

def here(pg):
    return pg.evaluate("location.pathname + location.search + location.hash")

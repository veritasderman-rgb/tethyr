"""Společný start prohlížeče pro testy: BROWSER=chromium|firefox|webkit (výchozí chromium).
Mobilní kontext (is_mobile=True) se nahradí emulací zařízení: webkit = iPhone 13, chromium = Pixel 7
(DEVICE=default zachová původní 390×844); ve Firefoxu se is_mobile (nepodporováno) vypustí."""
import os
BROWSER = os.environ.get('BROWSER', 'chromium')
DEVICE = os.environ.get('DEVICE', 'default')

class _B:
    def __init__(self, p, b): self._p, self._b = p, b
    def __getattr__(self, k): return getattr(self._b, k)
    def new_context(self, **o):
        if o.get('is_mobile'):
            if BROWSER == 'firefox':
                o.pop('is_mobile')
            elif DEVICE != 'default':
                name = 'iPhone 13' if BROWSER == 'webkit' else 'Pixel 7'
                o = {**self._p.devices[name], **{k: v for k, v in o.items() if k not in ('viewport', 'device_scale_factor', 'is_mobile', 'has_touch')}}
        return self._b.new_context(**o)
    def new_page(self, **o): return self.new_context(**o).new_page()

def launch(p, args=None):
    kw = {}
    if BROWSER == 'chromium' and args: kw['args'] = args
    if BROWSER == 'firefox': kw['firefox_user_prefs'] = {'media.autoplay.default': 5}  # běžná politika: blokovat
    return _B(p, getattr(p, BROWSER).launch(**kw))

def noise(m):
    """Známé neškodné zprávy: Firefox opravuje bbox glyfů v písmu Cardo (OTS), headless prohlížeč nemá zvukové zařízení."""
    t = m.text or ''
    return 'downloadable font: glyf' in t or 'could not be decoded' in t or 'OnMediaSinkAudioErr' in t or 'NS_ERROR_DOM_MEDIA' in t or 'GPU stall due to ReadPixels' in t or 'GL Driver Message' in t

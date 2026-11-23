// Hover karty ve vyprávění (iterace 7): u prvního výskytu jména osoby nebo místa v odstavci (odkazy x:, a také
// ručně psané odkazy na svědky, postavy a místa) se po najetí nebo fokusu ukáže karta: portrét, jedna věta, odkaz do Lexikonu.
// Na dotykovém displeji první klepnutí na jméno (x:) kartu otevře, odkaz v kartě vede do Lexikonu.
import { need, D } from './data.js';
import { $, esc } from './util.js';
import { small } from './img.js';
import { emit } from './sections.js';

const SEL = '.chap-body a.lk-x, .chap-body a.lk-w, .chap-body a.lk-c, .chap-body a.lk-m';
let card, cur = null, hideT = 0, showT = 0, lastPointer = 'mouse', wasOpen = false;

function entryFor(a) {
  const L = D.lexikon; if (!L) return null;
  if (!L._by) L._by = Object.fromEntries(L.entries.map((e) => [e.id, e]));
  let id = a.dataset.lx;
  if (!id && a.dataset.wit) id = L.byWit[a.dataset.wit];
  if (!id && a.dataset.char) id = L.byChar[a.dataset.char];
  if (!id && a.dataset.place) id = 'm-' + a.dataset.place;
  if (!id && a.classList.contains('lk-m')) { const m = (a.getAttribute('href') || '').match(/#p=([\w-]+)/); if (m) id = 'm-' + m[1]; }
  return L._by[id] || null;
}

const TYPE = { osoba: 'Osoba', misto: 'Místo', frakce: 'Frakce', pojem: 'Pojem' };
function stavLabel(e) {
  if (e.stav === 'padl') return `<span class="hc-st past">† padl${e.stx ? ` · ${esc(e.stx.replace(/^(†\s*)?padl[aio]?\s*/i, ''))}` : ''}</span>`;
  if (e.stav === 'zmizel') return `<span class="hc-st past">zmizel${e.stx ? ` · ${esc(e.stx.replace(/^zmizel[aio]?\s*/i, ''))}` : ''}</span>`;
  if (e.stav === 'žije') return '<span class="hc-st">žije</span>';
  return '';
}

function html(e) {
  const pic = e.img ? `<img src="${small(e.img)}" alt="" loading="lazy" decoding="async">` : `<span class="hc-ico" aria-hidden="true">${e.t === 'misto' ? '⌖' : '✦'}</span>`;
  const meta = [TYPE[e.t], e.t === 'misto' ? [e.kind, e.reg].filter(Boolean).join(', ') : (e.vaz && e.pc ? e.vaz : e.grp)].filter(Boolean).map(esc).join(' · ');
  return `<div class="hc-pic${e.img ? '' : ' none'}">${pic}</div><div class="hc-b">
    <p class="hc-k">${meta}</p><p class="hc-n">${esc(e.n)}</p>${stavLabel(e)}
    <p class="hc-s">${esc(e.s || '')}</p>
    <p class="hc-a"><a href="#lx/${esc(e.id)}">V Lexikonu ▸</a>${e.wit ? `<button type="button" data-wit="${esc(e.wit)}">▶ Svědectví</button>` : ''}${e.m2 ? `<button type="button" data-place="${esc(e.m2)}">Na mapě</button>` : ''}</p></div>`;
}

function place(a) {
  const r = a.getBoundingClientRect();
  const w = Math.min(340, window.innerWidth - 24);
  card.style.width = w + 'px';
  const ch = card.offsetHeight || 170;
  let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
  let y = r.bottom + 10;
  const below = y + ch < window.innerHeight - (document.getElementById('bottomNav')?.offsetHeight || 0) - 8;
  if (!below) y = r.top - ch - 10;
  const bottom = window.innerHeight - (document.getElementById('bottomNav')?.offsetHeight || 0) - 8;
  y = Math.max(8, Math.min(y, bottom - ch));
  card.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  card.classList.toggle('up', !below);
}

async function show(a) {
  clearTimeout(hideT);
  if (!D.lexikon) { try { await need('lexikon'); } catch { return; } }
  const e = entryFor(a);
  if (!e) return;
  cur = a;
  card.innerHTML = html(e);
  card.hidden = false;
  a.setAttribute('aria-describedby', 'hoverCard');
  place(a);
  card.querySelector('img')?.addEventListener('load', () => { if (cur === a) place(a); }, { once: true });
  requestAnimationFrame(() => card.classList.add('on'));
}
function hide(now) {
  clearTimeout(showT);
  clearTimeout(hideT);
  const go = () => { card.classList.remove('on'); card.hidden = true; cur?.removeAttribute('aria-describedby'); cur = null; };
  if (now) go(); else hideT = setTimeout(go, 260);
}

export function initHoverCards() {
  card = $('#hoverCard');
  document.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType || 'mouse'; const t = e.target.closest?.(SEL); wasOpen = !!t && t === cur && !card.hidden; if (cur && !e.target.closest('#hoverCard') && !e.target.closest(SEL)) hide(true); }, true);
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const a = e.target.closest?.(SEL);
    if (a) { clearTimeout(hideT); if (a !== cur) { clearTimeout(showT); showT = setTimeout(() => show(a), 140); } return; }
    if (e.target.closest?.('#hoverCard')) { clearTimeout(hideT); return; }
    if (cur) hide();
  });
  document.addEventListener('focusin', (e) => {
    const a = e.target.closest?.(SEL);
    if (a) show(a); else if (cur && !e.target.closest('#hoverCard')) hide();
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest(SEL);
    // dotyk: první klepnutí na jméno (x:) otevře kartu, ne Lexikon
    if (a && a.classList.contains('lk-x') && lastPointer === 'touch' && !wasOpen) { e.preventDefault(); e.stopPropagation(); show(a); return; }
    const lx = e.target.closest('#hoverCard a[href^="#lx/"]');
    if (lx) { e.preventDefault(); const h = lx.getAttribute('href'); if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = h; }
    const w = e.target.closest('#hoverCard [data-wit]');
    if (w) { e.preventDefault(); emit('witness:open', { id: w.dataset.wit }); }
    const p = e.target.closest('#hoverCard [data-place]');
    if (p) { e.preventDefault(); emit('map:place', { id: p.dataset.place }); }
    if (e.target.closest('#hoverCard a, #hoverCard button')) setTimeout(() => hide(true), 10);
  }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cur) hide(true); });
  // při posunu stránky kartu držet u jména; zavřít, až jméno zmizí z obrazovky
  window.addEventListener('scroll', () => {
    if (!cur) return;
    const r = cur.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) hide(true); else place(cur);
  }, { passive: true });
}

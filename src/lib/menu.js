// Hlavní menu (iterace 7): vysouvací panel na všech šířkách. Oddíly, Příběh po knihách s rozbalitelnými kapitolami,
// pole hledání, „Pokračovat ve čtení“, zvýraznění aktuálního oddílu. Esc / klik mimo zavře, fokus zůstává v panelu.
// Na mobilu ho otevírá tlačítko „Menu“ ve spodní liště (horní hamburger je tam skrytý), takže navigace je jen jedna.
import { need, D } from './data.js';
import { $, $$, esc } from './util.js';
import { openSearch } from './search.js';
import { PAGES, chPath, bookPath } from './router.js';

const KEY_POS = 'zd-cteni';
const ITEMS = PAGES.map((p) => [p.id, p.label, p.sub, p.path]);
let panel, inner, opener = null, current = 'uvod', booksDone = false;

const readPos = () => { try { return JSON.parse(localStorage.getItem(KEY_POS) || 'null'); } catch { return null; } };

function render() {
  const pos = readPos();
  inner.innerHTML = `<div class="navp-h"><a class="navp-brand" href="/"><img src="img/misc/znak.svg" alt="" width="30" height="15"><span>Západní draci</span></a>
      <button class="navp-x" type="button" data-close aria-label="Zavřít menu">×</button></div>
    <label class="navp-q"><span class="sr">Hledat v kronice</span><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
      <input type="search" id="navQ" placeholder="Hledat postavu, místo, verš…" autocomplete="off" enterkeyhint="search"><kbd>/</kbd></label>
    ${pos?.ch && D.chById?.[pos.ch] ? `<a class="navp-cont" href="${chPath(pos.ch)}" data-cont><span>Pokračovat ve čtení</span><b>kapitola ${pos.n}: ${esc(pos.title)}</b></a>` : `<a class="navp-cont" href="${D.books ? chPath(D.books[0].chapters[0].id) : '/pribeh'}"><span>Začít číst</span><b>Kniha první · kapitola 1</b></a>`}
    <ol class="navp-l">${ITEMS.map(([id, label, sub, href], i) => {
      const inner2 = `<span class="navp-n">${String(i).padStart(2, '0')}</span><span class="navp-t">${label}<small>${sub}</small></span>`;
      let row = id === 'dokument'
        ? `<a class="navp-a" href="/dokument" data-sec="dokument">${inner2}<i aria-hidden="true">▶</i></a>`
        : `<a class="navp-a" href="${href}" data-sec="${id}">${inner2}</a>`;
      if (id === 'pribeh') row += `<button class="navp-exp" type="button" aria-expanded="false" aria-controls="navBooks" aria-label="Knihy a kapitoly"><span aria-hidden="true">▾</span></button><div class="navp-books" id="navBooks" hidden></div>`;
      if (id === 'mapa') row += `<a class="navp-sub" href="/mapa/3d" data-sub="m3d">3D mapa Faerûnu</a>`;
      return `<li class="navp-i${id === 'pribeh' ? ' has-sub' : ''}">${row}</li>`;
    }).join('')}</ol>
    <p class="navp-f">Klávesy: <kbd>/</kbd> nebo <kbd>Ctrl</kbd>+<kbd>K</kbd> hledání · <kbd>Esc</kbd> zavřít · <kbd>←</kbd> <kbd>→</kbd> předchozí a další kapitola</p>`;
  mark();
}

function renderBooks() {
  const box = $('#navBooks', inner);
  if (!box) return;
  const chNow = window.__chId;
  let n = 0;
  box.innerHTML = D.books.map((b) => `<details class="navp-b"${b.chapters.some((c) => c.id === chNow) ? ' open' : ''}><summary><b>${b.key}</b> ${esc(b.title)}<span>${esc(b.real)}</span></summary>
    <ol><li><a href="${bookPath(b.key)}" class="navp-bk">Úvod knihy ${b.key}</a></li>${b.chapters.map((c) => { n++; return `<li><a href="${chPath(c.id)}" data-ch="${c.id}"${c.id === chNow ? ' aria-current="location"' : ''}><span>${n}</span>${esc(c.title)}</a></li>`; }).join('')}</ol></details>`).join('');
  booksDone = true;
}

function mark() {
  if (!inner) return;
  $$('[data-sec]', inner).forEach((a) => {
    const on = a.dataset.sec === current;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  const chNow = window.__chId;
  $$('[data-ch]', inner).forEach((a) => { if (a.dataset.ch === chNow) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
}

/** Stránka, na které čtenář je (podle adresy, viz router.js). */
export function setCurrent(id) { current = id; mark(); }
window.addEventListener('route', (e) => { const r = e.detail; window.__chId = r.page === 'pribeh' ? r.ch || '' : ''; setCurrent(r.page === 'm3d' ? 'mapa' : r.page); });

const focusables = () => $$('a[href], button:not([disabled]), input, summary, [tabindex]:not([tabindex="-1"])', panel).filter((e) => e.offsetParent !== null || e === document.activeElement);

export function openMenu(from) {
  if (!panel.hidden) return;
  opener = from || document.activeElement;
  render();
  panel.hidden = false;
  document.body.classList.add('nav-open');
  requestAnimationFrame(() => panel.classList.add('open'));
  $$('#menuBtn, #moreBtn').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  setTimeout(() => (window.matchMedia('(hover: hover)').matches ? $('#navQ', inner) : $('.navp-x', inner))?.focus({ preventScroll: true }), 30);
  booksDone = false;
}

export function closeMenu(restore = true) {
  if (panel.hidden) return;
  panel.classList.remove('open');
  document.body.classList.remove('nav-open');
  $$('#menuBtn, #moreBtn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  setTimeout(() => { panel.hidden = true; }, 260);
  if (restore && opener && document.contains(opener)) opener.focus({ preventScroll: true });
}

export function initMenu() {
  panel = $('#navPanel');
  inner = $('.navp-p', panel);
  const toggle = (b) => (panel.hidden ? openMenu(b) : closeMenu());
  $$('#menuBtn, #moreBtn').forEach((b) => b.addEventListener('click', () => toggle(b)));
  document.addEventListener('click', (e) => { if (e.target.closest('[data-search]')) openSearch(''); });
  $('#searchBtn')?.addEventListener('click', () => openSearch(''));
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeMenu(); return; }
    const exp = e.target.closest('.navp-exp');
    if (exp) {
      const box = $('#navBooks', inner); const open = box.hidden;
      box.hidden = !open; exp.setAttribute('aria-expanded', open);
      if (open && !booksDone) { box.innerHTML = '<p class="navp-load">Načítám kapitoly…</p>'; need('books').then(renderBooks); }
      return;
    }
    if (e.target.closest('a[href], [data-film]')) closeMenu(false);
    // po přechodu na jinou stránku fokus nevracet na tlačítko menu (router zaostří nadpis stránky)
  });
  panel.addEventListener('input', (e) => {
    if (e.target.id !== 'navQ') return;
    const q = e.target.value; closeMenu(false); openSearch(q);
  });
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key === 'Enter' && e.target.id === 'navQ') { const q = e.target.value; closeMenu(false); openSearch(q); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

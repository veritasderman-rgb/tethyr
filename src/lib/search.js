// Globální hledání (iterace 7): klávesa / nebo Ctrl+K, pole v menu a v horní liště.
// Fulltext přes odstavce kapitol, sezení, osoby, místa, frakce, pojmy, bitvy, verše proroctví a svědectví.
// Index (public/data/search.json) staví scripts/build-lexikon.py a web ho stahuje až při prvním otevření.
import { $, $$, esc, norm } from './util.js';

const KIND = {
  kap: ['Kapitoly', 9], os: ['Osoby', 8], mi: ['Místa', 7], bit: ['Bitvy', 6], sv: ['Svědectví', 6], fr: ['Frakce a organizace', 5],
  po: ['Pojmy a předměty', 4], ver: ['Verše proroctví', 4], ses: ['Sezení', 3], odst: ['V textu kapitol', 2],
};
const ORDER = ['kap', 'os', 'mi', 'bit', 'sv', 'fr', 'po', 'ver', 'ses', 'odst'];
let box, idx = null, loading = null, opener = null, active = -1, flat = [], lastQ = '';

function load() {
  return (loading ||= fetch('data/search.json').then((r) => { if (!r.ok) throw new Error('search.json ' + r.status); return r.json(); }).then((j) => {
    idx = j.items.map(([k, t, s, x, h]) => ({ k, t, s, x, h, nt: norm(t), nx: norm(`${s} ${x}`) }));
  }).catch((e) => { loading = null; throw e; }));
}

function snippet(it, toks) {
  const src = it.x || '';
  if (!src) return '';
  const n = norm(src);
  let at = -1;
  for (const w of toks) { const i = n.indexOf(w); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return esc(src.slice(0, 140)) + (src.length > 140 ? '…' : '');
  const a = Math.max(0, at - 60), b = Math.min(src.length, at + 120);
  return (a > 0 ? '…' : '') + hi(src.slice(a, b), toks) + (b < src.length ? '…' : '');
}
function hi(s, toks) {
  const n = norm(s);
  const marks = [];
  for (const w of toks) { let i = n.indexOf(w); while (i >= 0 && w) { marks.push([i, i + w.length]); i = n.indexOf(w, i + w.length); } }
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', p = 0;
  for (const [a, b] of marks) { if (a < p) continue; out += esc(s.slice(p, a)) + '<mark>' + esc(s.slice(a, b)) + '</mark>'; p = b; }
  return out + esc(s.slice(p));
}

function run(q) {
  lastQ = q;
  const list = $('.srch-res', box), info = $('.srch-info', box);
  const toks = norm(q).trim().split(/\s+/).filter((w) => w.length > 0);
  if (!toks.length) { list.innerHTML = ''; info.textContent = 'Napište jméno, místo, verš nebo slovo z příběhu.'; flat = []; active = -1; return; }
  if (!idx) { info.textContent = 'Načítám rejstřík kroniky…'; load().then(() => { if (lastQ === q) run(q); }).catch(() => { info.textContent = 'Rejstřík se nepodařilo načíst.'; }); return; }
  const res = [];
  for (const it of idx) {
    let sc = 0, okAll = true;
    for (const w of toks) {
      const inT = it.nt.indexOf(w);
      if (inT === 0) sc += 60; else if (inT > 0) sc += (it.nt[inT - 1] === ' ' ? 35 : 15);
      else if (it.nx.includes(w)) sc += 3;
      else { okAll = false; break; }
    }
    if (!okAll) continue;
    if (it.nt === toks.join(' ')) sc += 80;
    sc += KIND[it.k][1];
    res.push([sc, it]);
  }
  res.sort((a, b) => b[0] - a[0]);
  const groups = {};
  for (const [, it] of res) (groups[it.k] ||= []).push(it);
  // odstavce téže kapitoly sloučit (jen první výskyt)
  if (groups.odst) { const seen = new Set(); groups.odst = groups.odst.filter((it) => !seen.has(it.h) && seen.add(it.h)); }
  const ks = ORDER.filter((k) => groups[k]?.length);
  info.textContent = res.length ? `${res.length} ${res.length === 1 ? 'výsledek' : res.length < 5 ? 'výsledky' : 'výsledků'}` : 'Nic nenalezeno. Zkuste jiný tvar slova nebo kratší dotaz.';
  flat = [];
  list.innerHTML = ks.map((k) => {
    const g = groups[k];
    const show = g.slice(0, k === 'odst' ? 8 : 6);
    return `<li class="srch-g"><h3>${KIND[k][0]} <span>${g.length}</span></h3><ul>${show.map((it) => {
      const i = flat.push(it) - 1;
      return `<li><a href="${esc(it.h)}" class="srch-i k-${k}" data-i="${i}" id="srch-${i}" role="option"><b>${hi(it.t, toks)}</b><span class="srch-s">${esc(it.s)}</span>${k === 'odst' || k === 'ses' || k === 'sv' || k === 'ver' ? `<span class="srch-x">${snippet(it, toks)}</span>` : ''}</a></li>`;
    }).join('')}${g.length > show.length ? `<li class="srch-more">a dalších ${g.length - show.length} · upřesněte dotaz</li>` : ''}</ul></li>`;
  }).join('');
  setActive(flat.length ? 0 : -1);
}

function setActive(i) {
  active = i;
  $$('.srch-i', box).forEach((a) => a.classList.toggle('on', +a.dataset.i === i));
  const inp = $('.srch-q input', box);
  if (i >= 0) { inp.setAttribute('aria-activedescendant', `srch-${i}`); $(`#srch-${i}`, box)?.scrollIntoView({ block: 'nearest' }); } else inp.removeAttribute('aria-activedescendant');
}

function go(it) {
  closeSearch(false);
  const h = it.h;
  if (location.hash === h) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = h;
}

export function openSearch(q = '') {
  if (!box) return;
  opener = document.activeElement;
  if (box.hidden) {
    box.hidden = false;
    document.body.classList.add('srch-open');
    requestAnimationFrame(() => box.classList.add('open'));
  }
  const inp = $('.srch-q input', box);
  inp.value = q; inp.focus();
  try { inp.setSelectionRange(q.length, q.length); } catch { /* typ search */ }
  load().catch(() => {});
  run(q);
}

export function closeSearch(restore = true) {
  if (!box || box.hidden) return;
  box.classList.remove('open');
  document.body.classList.remove('srch-open');
  setTimeout(() => { box.hidden = true; }, 200);
  if (restore && opener && document.contains(opener)) opener.focus({ preventScroll: true });
}

export function initSearch() {
  box = $('#searchBox');
  box.innerHTML = `<div class="srch-bg" data-close></div>
    <div class="srch-p">
      <div class="srch-q"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>
        <label class="sr" for="srchQ">Hledat v kronice</label>
        <input id="srchQ" type="search" placeholder="Hledat v celé kronice…" autocomplete="off" spellcheck="false" enterkeyhint="search" role="combobox" aria-expanded="true" aria-controls="srchRes" aria-autocomplete="list">
        <button type="button" class="srch-x" data-close aria-label="Zavřít hledání">Esc</button></div>
      <p class="srch-info" aria-live="polite"></p>
      <ul class="srch-res" id="srchRes" role="listbox" aria-label="Výsledky hledání"></ul>
      <p class="srch-f"><kbd>↑</kbd> <kbd>↓</kbd> výběr · <kbd>Enter</kbd> otevřít · <kbd>Esc</kbd> zavřít</p>
    </div>`;
  let t = 0;
  $('.srch-q input', box).addEventListener('input', (e) => { clearTimeout(t); const v = e.target.value; t = setTimeout(() => run(v), 90); });
  box.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { closeSearch(); return; }
    const a = e.target.closest('.srch-i');
    if (a) { e.preventDefault(); go(flat[+a.dataset.i]); }
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeSearch(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); if (flat.length) setActive((active + 1) % flat.length); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); if (flat.length) setActive((active - 1 + flat.length) % flat.length); return; }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (flat[active]) go(flat[active]); return; }
    if (e.key === 'Tab') {
      const f = $$('input, button, a.srch-i', box);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });
  document.addEventListener('keydown', (e) => {
    const typing = e.target.closest?.('input, textarea, select, [contenteditable]');
    if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); box.hidden ? openSearch('') : closeSearch(); return; }
    if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && box.hidden && !document.querySelector('.film.on, .film:not([hidden])')) { e.preventDefault(); openSearch(''); }
  });
  window.__search = { open: openSearch, close: closeSearch, run: (q) => { openSearch(q); return load().then(() => { run(q); return flat.map((x) => [x.k, x.t, x.h]); }); } };
}

// Směrování (iterace 8): každá položka menu je samostatná stránka se skutečnou adresou (History API).
// Vercel přepisuje cesty stránek na index.html (vercel.json), <base href="/"> drží relativní cesty k datům a obrázkům.
//   /                         Úvod
//   /pribeh                   rozcestník pěti knih
//   /pribeh/kniha-2           kniha (předěl, obsah, co se změnilo)
//   /pribeh/kniha-2/<kapitola>[#s-…]   kapitola (jedna stránka, předchozí/další), #s-… = sezení v kronice kapitoly
//   /druzina[/<postava>]  /svedectvi[/<svědek>]  /bitvy[/<bitva>]  /mapa[?misto=…|?kniha=II]  /mapa/3d
//   /proroctvi[/<kapitola-verš>]  /osa  /lexikon[/<heslo>|?q=…]  /u-stolu  /hymna  /dokument  /podekovani
// Staré kotvy jednostránkové verze (#pribeh, #ch-…, #s-…, #kniha-…, #b-…, #pv-…, #lx/…, #rejstrik, #svedectvi/<id>, #mapa,
// #mapa3d, #dokument, #hymna…) se přesměrují na nové adresy, a to i v odkazech uvnitř stránky (fixLinks).
import { D } from './data.js';
import { ensure, moduleOf } from './sections.js';
import { $, $$, esc } from './util.js';

import { SITE, ROM, ROM_NAME, PAGES, EXTRA } from './pages.js';
export { SITE, PAGES };
export const pageById = (id) => PAGES.find((p) => p.id === id) || EXTRA[id] || null;
const SLUG = { 'u-stolu': 'stul' };
const APP = new Set(['pribeh', 'druzina', 'svedectvi', 'bitvy', 'mapa', 'proroctvi', 'osa', 'lexikon', 'u-stolu', 'hymna', 'dokument', 'podekovani']);

// ------------------------------------------------------------------ adresy
const bookNo = (key) => ROM.indexOf(key) + 1;
export const bookPath = (key) => `/pribeh/kniha-${bookNo(key)}`;
export function chPath(id) {
  const c = D.chById?.[id];
  return c ? `${bookPath(c.book)}/${id.replace(/^ch-/, '')}` : '/pribeh';
}
let sesCh = null;
export function chOfSession(sid) {
  if (!sesCh && D.books) { sesCh = {}; for (const b of D.books) for (const c of b.chapters) for (const s of c.sessions) sesCh[s] ||= c.id; }
  return sesCh?.[sid] || null;
}
export function sesPath(sid) { const ch = chOfSession(sid); return ch ? `${chPath(ch)}#${sid}` : '/pribeh'; }
export const witPath = (id) => `/svedectvi/${id}`;
export const battlePath = (id) => `/bitvy/${String(id).replace(/^b-/, '')}`;
export const versePath = (id) => `/proroctvi/${String(id).replace(/^pv-/, '')}`;
export const lexPath = (id) => `/lexikon/${id}`;
export const charPath = (id) => `/druzina/${id}`;
export const placePath = (id) => `/mapa?misto=${encodeURIComponent(id)}`;

/** Stará kotva (#…) → nová adresa, nebo null, když kotvu neznáme. */
/** Adresa pro odkaz v šabloně: stará kotva (#s-…, #lx/…, #mapa …) se hned přeloží na novou cestu; neznámé zůstane (router ho přeloží při kliknutí). */
export const H = (h) => legacy(h) || h;
export function legacy(h) {
  if (h == null) return null;
  h = String(h).replace(/^#/, '');
  try { h = decodeURIComponent(h); } catch { /* nevadí */ }
  if (!h) return null;
  if (h.startsWith('/')) return h; // případné #/cesta
  const [s, sub] = h.split('/');
  if (s === 'uvod') return '/';
  if (/^kniha-[IV]+$/.test(s)) return bookPath(s.slice(6));
  if (/^ch-/.test(s)) return chPath(s);
  if (/^s-/.test(s)) return sesPath(s);
  if (/^b-/.test(s)) return battlePath(s);
  if (/^pv-/.test(s)) return versePath(s);
  if (s === 'lx') return sub ? lexPath(sub) : '/lexikon';
  if (s === 'rejstrik') return '/lexikon';
  if (s === 'svedectvi') return sub ? witPath(sub) : '/svedectvi';
  if (s === 'mapa3d') return '/mapa/3d';
  if (s === 'stul') return '/u-stolu';
  if (s === 'druzina' && sub) return charPath(sub);
  const pg = PAGES.find((p) => p.id === s);
  return pg ? pg.path : null;
}

/** Rozebere adresu na stránku a parametry. */
export function parse(loc = location) {
  const path = decodeURI(loc.pathname).replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  const query = Object.fromEntries(new URLSearchParams(loc.search));
  let hash = (loc.hash || '').slice(1);
  try { hash = decodeURIComponent(hash); } catch { /* nevadí */ }
  const seg = path.split('/').filter(Boolean);
  const r = { page: 'uvod', sub: null, book: null, ch: null, query, hash, path };
  if (!seg.length) return r;
  const [a, b, c, d] = seg;
  if (!APP.has(a) || d) return { ...r, page: 'nenalezeno' };
  r.page = SLUG[a] || a;
  if (a === 'pribeh') {
    if (!b) return r;
    const m = /^kniha-([1-5])$/.exec(b);
    if (!m) return { ...r, page: 'nenalezeno' };
    r.book = ROM[+m[1] - 1];
    if (c) r.ch = 'ch-' + c;
    return r;
  }
  if (c) return { ...r, page: 'nenalezeno' };
  if (a === 'mapa' && b === '3d') return { ...r, page: 'm3d' };
  if (a === 'bitvy' && b) r.sub = 'b-' + b;
  else if (a === 'proroctvi' && b) r.sub = 'pv-' + b;
  else if (b && ['svedectvi', 'druzina', 'lexikon'].includes(a)) r.sub = b;
  else if (b) return { ...r, page: 'nenalezeno' };
  return r;
}
/** Je to adresa aplikace (a ne soubor jako /mapa3d/…, /img/…, /hymna/rauko_klip.mp4)? */
function isApp(pathname) {
  const seg = pathname.replace(/\/index\.html$/, '/').split('/').filter(Boolean);
  if (!seg.length) return true;
  if (!APP.has(seg[0])) return false;
  return !(seg[0] === 'hymna' && seg[1]);
}

// ------------------------------------------------------------------ odkazy v obsahu: staré kotvy → nové adresy
function fixLinks(root) {
  if (!root.querySelectorAll) return;
  const list = root.matches?.('a[href^="#"]') ? [root] : [];
  for (const a of [...list, ...root.querySelectorAll('a[href^="#"]')]) {
    const p = legacy(a.getAttribute('href'));
    if (p) a.setAttribute('href', p);
  }
}

// ------------------------------------------------------------------ navigace
let cur = null, seq = 0, first = true;
const hooks = { film: null };
/** Přejde na adresu. gesture = přechod vyvolal klik (zvuk smí hned hrát). */
export function navigate(to, { replace = false, gesture = false, state = {} } = {}) {
  if (to.startsWith('#')) to = legacy(to) || location.pathname;
  const u = new URL(to, location.origin);
  const url = u.pathname + u.search + u.hash;
  try { history.replaceState({ ...(history.state || {}), y: Math.round(window.scrollY) }, ''); } catch { /* nic */ }
  const same = url === location.pathname + location.search + location.hash;
  if (replace || same) history.replaceState({ ...state, app: history.state?.app || 0 }, '', url);
  else history.pushState({ ...state, app: 1 }, '', url);
  return apply({ gesture, pop: false, state });
}
/** Zpětná kompatibilita: dřívější události mezi oddíly → navigace s parametrem. */
export function emit(name, d = {}) {
  const map = {
    'witness:open': () => witPath(d.id),
    'map:place': () => placePath(d.id),
    'map:era': () => `/mapa?kniha=${encodeURIComponent(d.era)}`,
    'prophecy:verse': () => versePath(d.id),
    'party:open': () => charPath(d.id),
    'lexikon:open': () => lexPath(d.id),
    'registry:search': () => `/lexikon?q=${encodeURIComponent(d.q)}`,
  };
  const f = map[name];
  if (f) return navigate(f(), { gesture: true, state: { autoplay: d.autoplay !== false } });
  window.dispatchEvent(new CustomEvent(name, { detail: d }));
  return Promise.resolve();
}

function sectionEl(id) { return document.getElementById(id); }
function loadingState(el) {
  if (el && !el.hasAttribute('data-ready') && !el.querySelector('.pg-load')) {
    el.innerHTML = `<div class="pg-load wrap" role="status"><span class="pg-sk h"></span><span class="pg-sk"></span><span class="pg-sk"></span><span class="pg-sk s"></span><p>Načítám stránku…</p></div>`;
  }
}
function errorState(el, r) {
  el.innerHTML = `<div class="pg-err wrap" role="alert"><h1 tabindex="-1">Stránku se nepodařilo načíst</h1><p>Zkontrolujte připojení a zkuste to znovu.</p><p><button class="btn red" type="button" data-retry>Zkusit znovu</button> <a class="btn" href="/">Na úvod</a></p></div>`;
  el.querySelector('[data-retry]').addEventListener('click', () => { el.innerHTML = ''; show(r, { gesture: true }); });
}

async function apply(ctx = {}) {
  let r = parse(location);
  // stará kotva na úvodní adrese (sdílený odkaz, 3D mapa, záložka) → nová adresa
  if (r.page === 'uvod' && r.hash) {
    const p = legacy(r.hash);
    if (p && p !== '/') { history.replaceState(history.state, '', p); r = parse(location); }
    else if (p === '/') history.replaceState(history.state, '', '/');
  }
  if (r.page === 'dokument') {
    if (!cur) await show({ ...parse({ pathname: '/', search: '', hash: '' }) }, { ...ctx, quiet: true });
    document.title = `Dokument · ${SITE}`;
    setMeta(pageById('dokument'), '/dokument');
    return hooks.film?.open({ autostart: !!ctx.gesture && !ctx.pop });
  }
  hooks.film?.close();
  return show(r, ctx);
}

async function show(r, ctx = {}) {
  const my = ++seq;
  const prev = cur;
  const el = sectionEl(r.page);
  if (prev?.page !== r.page) {
    if (prev) {
      try { moduleOf(prev.page)?.leave?.(r); } catch (e) { console.error(e); }
      const pe = sectionEl(prev.page); if (pe) pe.hidden = true;
    }
    $$('main > section').forEach((s) => { if (s !== el) s.hidden = true; });
    if (el) el.hidden = false;
    document.body.dataset.page = r.page;
    window.dispatchEvent(new CustomEvent('page:change', { detail: { from: prev?.page || null, to: r.page } }));
  }
  cur = r;
  markNav(r);
  if (!ctx.pop && !r.hash) window.scrollTo({ top: 0, behavior: 'instant' });
  let mod = null;
  if (r.page === 'nenalezeno') renderNotFound(el);
  else {
    loadingState(el);
    try { mod = await ensure(r.page); } catch { if (my === seq) errorState(el, r); return; }
  }
  if (my !== seq) return;
  try { await mod?.enter?.(r, ctx); } catch (e) { console.error('enter', r.page, e); }
  if (my !== seq) return;
  const m = metaOf(r);
  renderCrumbs(m.crumbs);
  renderNext(m.next, r);
  document.title = m.title;
  setMeta(m.page, location.pathname, m.desc);
  if (ctx.pop && history.state?.y != null) {
    const y = history.state.y;
    [0, 300, 900].forEach((ms) => setTimeout(() => { if (my === seq) window.scrollTo({ top: y, behavior: 'instant' }); }, ms));
  }
  if (!first && !ctx.quiet && !r.hash && !r.sub && !(r.page === 'pribeh' && r.ch && (ctx.state?.resume || ctx.state?.para))) {
    const h = el?.querySelector('h1');
    if (h) { if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  }
  first = false;
  window.dispatchEvent(new CustomEvent('page:shown', { detail: r }));
}

// ------------------------------------------------------------------ titulek, popis, drobečky, „Dál“
function setMeta(page, path, desc) {
  const d = desc || page?.desc || PAGES[0].desc;
  const set = (sel, attr, v) => { const n = document.head.querySelector(sel); if (n) n.setAttribute(attr, v); };
  set('meta[name="description"]', 'content', d);
  set('meta[property="og:description"]', 'content', d);
  set('meta[property="og:title"]', 'content', document.title);
  let c = document.head.querySelector('link[rel="canonical"]');
  if (!c) { c = document.createElement('link'); c.rel = 'canonical'; document.head.appendChild(c); }
  c.href = location.origin + path;
}

/** Popis aktuální stránky: drobečky, titulek a další stránka. Stránka může doplnit vlastní (modul.meta). */
function metaOf(r) {
  const page = pageById(r.page) || EXTRA.nenalezeno;
  const own = moduleOf(r.page)?.meta?.(r);
  if (own) return { page, crumbs: own.crumbs || [], title: own.title || `${page.label} · ${SITE}`, next: own.next || nextAfter(r.page), desc: own.desc };
  const crumbs = [];
  let leaf = null;
  if (r.page === 'm3d') { crumbs.push(['Mapa', '/mapa'], ['3D mapa', null]); leaf = '3D mapa'; }
  else if (r.sub) {
    if (r.page === 'svedectvi') leaf = D.witById?.[r.sub]?.jmeno;
    else if (r.page === 'druzina') leaf = D.charById?.[r.sub]?.name;
    else if (r.page === 'bitvy') leaf = D.battleById?.[r.sub]?.name;
    else if (r.page === 'lexikon') leaf = D.lexikon?._by?.[r.sub]?.n;
    else if (r.page === 'proroctvi') { const [k, v] = r.sub.slice(3).split('-'); leaf = `Kapitola ${ROM[k - 1] || k}, ${+v + 1}. verš`; }
    if (leaf) crumbs.push([page.label, page.path], [leaf, null]);
  }
  if (r.page === 'm3d') leaf = null;
  const title = r.page === 'm3d' ? `3D mapa · Mapa · ${SITE}` : r.page === 'uvod' ? `${SITE} – kronika Tethyrské královské družiny` : leaf ? `${leaf} · ${page.label} · ${SITE}` : `${page.label} · ${SITE}`;
  return { page, crumbs, title, next: nextAfter(r.page === 'm3d' ? 'mapa' : r.page) };
}
export function nextAfter(id) {
  if (id === 'nenalezeno') return { href: '/', label: 'Úvod', sub: 'Začít od začátku' };
  const i = PAGES.findIndex((p) => p.id === id);
  if (i === PAGES.length - 1) return { href: '/', label: 'Úvod', sub: 'Kronika znovu od začátku', k: 'Znovu' };
  const n = PAGES[i + 1];
  return n ? { href: n.path, label: n.label, sub: n.sub } : null;
}
function renderCrumbs(list) {
  const nav = $('#crumbs');
  if (!nav) return;
  if (!list?.length) { nav.hidden = true; nav.innerHTML = ''; return; }
  nav.hidden = false;
  nav.innerHTML = `<ol>${list.map(([t, h], i) => `<li>${h && i < list.length - 1 ? `<a href="${esc(h)}">${esc(t)}</a>` : `<span aria-current="page">${esc(t)}</span>`}</li>`).join('')}</ol>`;
}
function renderNext(n, r) {
  const box = $('#nextPage');
  if (!box) return;
  if (!n || r.page === 'uvod' && false) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<a class="nextp-a" href="${esc(n.href)}"${n.href === '/dokument' ? ' data-film-link' : ''}><span class="nextp-k">${esc(n.k || 'Dál')}</span><b>${esc(n.label)}</b>${n.sub ? `<small>${esc(n.sub)}</small>` : ''}<i aria-hidden="true">→</i></a>`;
}
function renderNotFound(el) {
  el.innerHTML = `<header class="sec-head"><p class="kicker">Chyba 404</p><h1 tabindex="-1">Tahle stránka v kronice není</h1>
    <p class="lead">Adresa možná pochází ze starší verze webu, nebo se v ní něco přepsalo. Zkuste hledání nebo některou ze stránek níže.</p></header>
    <div class="wrap nf-l">${PAGES.filter((p) => p.id !== 'dokument').map((p) => `<a class="chip" href="${p.path}">${esc(p.label)}</a>`).join(' ')}</div>`;
}

function markNav(r) {
  const top = r.page === 'm3d' ? 'mapa' : r.page;
  $$('#bottomNav a, .foot nav a').forEach((a) => {
    const on = a.dataset.sec === top;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  window.dispatchEvent(new CustomEvent('route', { detail: r }));
}
export const current = () => cur;
/** Stránka si sama přepsala adresu (replaceState: otevřený svědek, heslo, postava): obnovit drobečky a titulek. */
export function syncMeta() {
  const r = parse(location);
  if (!cur || r.page !== cur.page) return;
  cur = r;
  const m = metaOf(r);
  renderCrumbs(m.crumbs); document.title = m.title; setMeta(m.page, location.pathname, m.desc);
}

// ------------------------------------------------------------------ start
export function startRouter({ film } = {}) {
  hooks.film = film;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  fixLinks(document.body);
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fixLinks(n); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const fb = e.target.closest('[data-film]');
    if (fb) { e.preventDefault(); navigate('/dokument', { gesture: true }); return; }
    const a = e.target.closest('a[href]');
    if (!a || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    let href = a.getAttribute('href');
    if (href.startsWith('#')) {
      const p = legacy(href);
      if (!p) { // kotva uvnitř stránky (např. „Přeskočit na obsah“): <base href="/"> by jinak vedl na úvod
        e.preventDefault();
        const t = document.getElementById(href.slice(1));
        if (t) { t.scrollIntoView({ block: 'start' }); t.focus?.({ preventScroll: true }); }
        return;
      }
      href = p;
    }
    const u = new URL(href, document.baseURI);
    if (u.origin !== location.origin || !isApp(u.pathname)) return;
    e.preventDefault();
    navigate(u.pathname + u.search + u.hash, { gesture: true, state: a.hasAttribute('data-cont') ? { resume: true } : {} });
  });
  window.addEventListener('popstate', (e) => apply({ pop: true, state: e.state || {} }));
  // starý způsob: změna kotvy (např. ruční přepsání adresy v prohlížeči)
  window.addEventListener('hashchange', () => {
    const p = legacy(location.hash);
    if (p) navigate(p, { replace: true });
  });
  window.__router = { navigate, parse, legacy, get current() { return cur; } };
  return apply({ pop: false, state: history.state || {} });
}

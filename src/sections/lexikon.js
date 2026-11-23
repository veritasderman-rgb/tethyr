// Lexikon (iterace 7, nahrazuje Rejstřík): osoby (postavy, svědci a vedlejší postavy), místa (2D i 3D mapa),
// frakce a organizace, pojmy. Abecední rejstřík, filtry, rychlé hledání, detail hesla. Texty jen z dat
// (public/data/lexikon.json, staví scripts/build-lexikon.py).
import { D } from '../lib/data.js';
import { small, img } from '../lib/img.js';
import { $, $$, esc, norm, plural, reduced } from '../lib/util.js';
import { emit, lexPath, syncMeta } from '../lib/router.js';

const TYPES = [['', 'Vše'], ['osoba', 'Osoby'], ['misto', 'Místa'], ['frakce', 'Frakce a organizace'], ['pojem', 'Pojmy']];
const TNAME = { osoba: 'osoba', misto: 'místo', frakce: 'frakce', pojem: 'pojem' };
const ABC = ['A', 'B', 'C', 'Č', 'D', 'E', 'F', 'G', 'H', 'CH', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'Ř', 'S', 'Š', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ž'];
const PAGE = 72;
const SIDE = { spojenec: 'spojenec', 'nepřítel': 'nepřítel', 'neutrální': 'neutrální', 'družina': 'družina', 'božstvo': 'božstvo', drak: 'drak', jednotka: 'jednotka' };

function letterOf(n) {
  const s = n.replace(/^[„"'(]+/, '');
  if (/^ch/i.test(s)) return 'CH';
  const c = s[0]?.toUpperCase() || '';
  if ('ČŘŠŽ'.includes(c)) return c;
  const b = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return ABC.includes(b) ? b : '#';
}
const stavHtml = (e) => e.stav === 'padl' ? `<span class="lx-st past">† padl</span>` : e.stav === 'zmizel' ? `<span class="lx-st past">zmizel</span>` : e.stav === 'žije' ? '<span class="lx-st">žije</span>' : '';

export function renderLexikon() {
  const el = $('#lexikon');
  const L = D.lexikon;
  const E = L.entries.map((e) => ({ ...e, _l: letterOf(e.n), _s: norm([e.n, e.fn, ...(e.al || []), e.s, e.grp, e.reg, e.kind].filter(Boolean).join(' ')) }));
  const by = Object.fromEntries(E.map((e) => [e.id, e]));
  L._by = L._by || by;
  const cnt = (t) => E.filter((e) => e.t === t).length;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Lexikon</p><h1 id="lexikon-h" tabindex="-1">Kdo je kdo a co je co</h1>
    <p class="lead">${plural(cnt('osoba'), 'osoba', 'osoby', 'osob')}, ${plural(cnt('misto'), 'místo', 'místa', 'míst')}, ${cnt('frakce')} frakcí a organizací a ${cnt('pojem')} pojmů a předmětů z kroniky. U osob stav, vazba na družinu, kapitoly a svědectví, u míst odkaz do 2D i 3D mapy. Texty hesel jsou převzaté z dat kroniky.</p><div class="orn">✦</div></header>
    <div class="wrap lx-ctl">
      <label class="lx-q"><span class="sr">Rychlé hledání v Lexikonu</span><input type="search" id="lxQ" placeholder="Jméno, přezdívka, místo, skupina…" autocomplete="off"></label>
      <div class="lx-t" role="group" aria-label="Druh hesla">${TYPES.map(([k, l]) => `<button class="chip${k === '' ? ' on' : ''}" data-t="${k}" aria-pressed="${k === ''}">${l}</button>`).join('')}</div>
      <div class="lx-f">
        <label><span class="sr">Stav</span><select id="lxS"><option value="">Stav: všichni</option><option value="žije">žije</option><option value="padl">padl</option><option value="zmizel">zmizel</option></select></label>
        <label><span class="sr">Strana</span><select id="lxSide"><option value="">Strana: všechny</option>${Object.keys(SIDE).map((s) => `<option>${s}</option>`).join('')}</select></label>
        <label class="lx-chk"><input type="checkbox" id="lxW"> se svědectvím</label>
        <label class="lx-chk"><input type="checkbox" id="lxP"> s portrétem</label>
      </div>
      <nav class="lx-abc" aria-label="Abecední rejstřík"><button data-l="" class="on" aria-pressed="true">vše</button>${ABC.map((l) => `<button data-l="${l}" aria-pressed="false">${l}</button>`).join('')}</nav>
    </div>
    <div class="wrap lx-body">
      <div class="lx-main"><p class="lx-count" id="lxCount" aria-live="polite"></p><ul class="lx-list" id="lxList"></ul>
        <div class="lx-more"><button class="btn sm" id="lxMore" hidden>Zobrazit další</button></div></div>
      <aside class="lx-det" id="lxDet" aria-live="polite" tabindex="-1"><p class="lx-hint">Vyberte heslo. V Příběhu otevře heslo i karta, která se ukáže po najetí na jméno.</p></aside>
    </div>`;
  const st = { q: '', t: '', l: '', s: '', side: '', w: false, p: false, shown: PAGE };
  const list = $('#lxList', el), det = $('#lxDet', el);
  const avail = new Set(E.map((e) => e._l));
  $$('.lx-abc [data-l]', el).forEach((b) => { if (b.dataset.l && !avail.has(b.dataset.l)) b.disabled = true; });

  function run() {
    const qq = norm(st.q).trim().split(/\s+/).filter(Boolean);
    const res = E.filter((e) => (!st.t || e.t === st.t) && (!st.l || e._l === st.l) && (!st.s || e.stav === st.s) && (!st.side || e.strana === st.side)
      && (!st.w || e.wit) && (!st.p || e.img) && qq.every((w) => e._s.includes(w)));
    // při hledání nahoru přesná a začínající jména
    if (qq.length) { const q0 = qq.join(' '); res.sort((a, b) => (norm(b.n).startsWith(q0) - norm(a.n).startsWith(q0)) || (!!b.wit - !!a.wit)); }
    $('#lxCount', el).textContent = `${res.length} ${res.length === 1 ? 'heslo' : res.length >= 2 && res.length <= 4 ? 'hesla' : 'hesel'}`;
    list.innerHTML = res.slice(0, st.shown).map((e) => `<li><button class="lx-i t-${e.t}${e.strana === 'nepřítel' ? ' foe' : ''}${e.stav === 'padl' || e.stav === 'zmizel' ? ' past' : ''}" data-id="${esc(e.id)}" aria-label="${esc(e.n)}, ${TNAME[e.t]}">
      <span class="lx-pic">${e.img ? `<img src="${small(e.img)}" alt="" loading="lazy" decoding="async">` : `<i aria-hidden="true">${e.t === 'misto' ? '⌖' : e.t === 'frakce' ? '⚑' : e.t === 'pojem' ? '◆' : '✦'}</i>`}</span>
      <span class="lx-tx"><b>${esc(e.n)}</b><small>${esc(TNAME[e.t])}${e.grp ? ` · ${esc(e.grp)}` : e.reg ? ` · ${esc(e.reg)}` : ''}</small><span class="lx-s">${esc(e.s || '')}</span></span>
      <span class="lx-b">${stavHtml(e)}${e.wit ? '<span class="lx-wb" title="Má svědectví">▶</span>' : ''}</span></button></li>`).join('');
    $('#lxMore', el).hidden = res.length <= st.shown;
  }

  function sesLinks(ids) {
    return (ids || []).slice(0, 12).map((id) => { const s = D.sesById?.[id]; return s ? `<a href="#${id}" title="${esc(s.title)}">${esc(s.date_label)}</a>` : ''; }).filter(Boolean).join(' ');
  }
  function open(id, scroll = true) {
    const e = by[id]; if (!e) return;
    $$('.lx-i', list).forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    const chs = (e.ch || []).map((c) => `<a href="#${c}">${esc(L.chTitle[c] || c)}</a>`).join('');
    const rows = [];
    if (e.fn && e.fn !== e.n) rows.push(['Celým jménem', esc(e.fn)]);
    if (e.al?.length) rows.push(['Také', e.al.map(esc).join(', ')]);
    if (e.stav) rows.push(['Stav', `${stavHtml(e)}${e.stx ? ` <span class="lx-stx">${esc(e.stx)}</span>` : ''}`]);
    if (e.strana) rows.push(['Strana', esc(e.strana)]);
    if (e.vaz) rows.push(['Vazba na družinu', esc(e.vaz)]);
    if (e.grp) rows.push(['Skupina', esc(e.grp)]);
    if (e.reg) rows.push([e.t === 'misto' ? 'Oblast' : 'Odkud', esc(e.reg)]);
    if (e.kind && e.t !== 'osoba') rows.push(['Druh', esc(e.kind)]);
    if (e.own) rows.push(['Patří', e.own[1] ? `<a href="#lx/${esc(e.own[1])}">${esc(e.own[0])}</a>` : esc(e.own[0])]);
    det.innerHTML = `<button class="lx-x" type="button" aria-label="Zavřít heslo">×</button>
      ${e.img ? `<div class="lx-dimg">${img(e.img, { alt: e.n, sizes: '(max-width:900px) 100vw, 420px', pos: '50% 30%' })}</div>` : ''}
      <p class="lx-dk">${esc(TNAME[e.t])}${e.sphere ? ' · sféra mimo Toril' : ''}</p><h3 id="lxDetH">${esc(e.n)}</h3>
      <p class="lx-ds">${esc(e.s || '')}</p>
      ${rows.length ? `<dl class="lx-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : ''}
      ${e.d && e.d !== e.s ? `<p class="lx-dd">${esc(e.d)}</p>` : ''}
      ${e.visits?.length ? `<h4>Co se tu stalo</h4><ul class="lx-v">${e.visits.map((v) => `<li>${esc(v)}</li>`).join('')}</ul>` : ''}
      ${e.mem?.length ? `<h4>Členové</h4><p class="lx-mem">${e.mem.map(([n, i]) => i ? `<a href="#lx/${esc(i)}">${esc(n)}</a>` : esc(n)).join(', ')}</p>` : ''}
      ${e.who?.length ? `<h4>Kdo tu žije a působí</h4><p class="lx-mem">${e.who.map((i) => by[i] ? `<a href="#lx/${esc(i)}">${esc(by[i].n)}</a>` : '').filter(Boolean).join(', ')}</p>` : ''}
      ${chs ? `<h4>Kapitoly Příběhu</h4><p class="lx-ch">${chs}</p>` : ''}
      ${e.ses?.length ? `<h4>Sezení</h4><p class="lx-ses">${sesLinks(e.ses)}</p>` : ''}
      <p class="lx-act">${e.wit ? `<button class="btn red sm" data-wit="${esc(e.wit)}">▶ Svědectví</button>` : ''}${e.pc ? `<button class="btn sm" data-char="${esc(e.pc)}">Karta postavy</button>` : ''}${e.m2 ? `<button class="btn sm" data-place="${esc(e.m2)}">2D mapa</button>` : ''}${e.m3 ? `<a class="btn sm" href="mapa3d/index.html#p=${esc(e.m3)}" target="_blank" rel="noopener">3D mapa ↗</a>` : ''}${(e.bat || []).map((b) => `<a class="btn sm" href="#${esc(b)}">Bojové hlášení</a>`).join('')}</p>`;
    det.classList.add('open'); document.body.classList.add('lx-open');
    det.scrollTop = 0;
    if (scroll && window.matchMedia('(max-width: 900px)').matches) det.focus({ preventScroll: true });
    else if (scroll) { const r = det.getBoundingClientRect(); if (r.top < 0 || r.top > innerHeight * 0.5) el.querySelector('.lx-body').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
  }
  const closeDet = () => { det.classList.remove('open'); document.body.classList.remove('lx-open'); if (location.pathname.startsWith('/lexikon/')) { history.replaceState(history.state, '', '/lexikon'); syncMeta(); } };

  $('#lxQ', el).addEventListener('input', (e) => {
    st.q = e.target.value; st.shown = PAGE;
    if (st.l) { st.l = ''; $$('[data-l]', el).forEach((x) => { x.classList.toggle('on', x.dataset.l === ''); x.setAttribute('aria-pressed', x.dataset.l === ''); }); }
    run();
  });
  $('#lxS', el).addEventListener('change', (e) => { st.s = e.target.value; st.shown = PAGE; run(); });
  $('#lxSide', el).addEventListener('change', (e) => { st.side = e.target.value; st.shown = PAGE; run(); });
  $('#lxW', el).addEventListener('change', (e) => { st.w = e.target.checked; st.shown = PAGE; run(); });
  $('#lxP', el).addEventListener('change', (e) => { st.p = e.target.checked; st.shown = PAGE; run(); });
  $('#lxMore', el).onclick = () => { st.shown += PAGE; run(); };
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]');
    if (t) { st.t = t.dataset.t; $$('[data-t]', el).forEach((x) => { x.classList.toggle('on', x === t); x.setAttribute('aria-pressed', x === t); }); st.shown = PAGE; run(); return; }
    const l = e.target.closest('[data-l]');
    if (l) { st.l = l.dataset.l; $$('[data-l]', el).forEach((x) => { x.classList.toggle('on', x === l); x.setAttribute('aria-pressed', x === l); }); st.shown = PAGE; run(); return; }
    const i = e.target.closest('.lx-i');
    if (i) { history.replaceState(history.state, '', lexPath(i.dataset.id)); syncMeta(); open(i.dataset.id); return; }
    if (e.target.closest('.lx-x')) { closeDet(); return; }
    const w = e.target.closest('[data-wit]'); if (w) { emit('witness:open', { id: w.dataset.wit }); return; }
    const c = e.target.closest('[data-char]'); if (c) { emit('party:open', { id: c.dataset.char }); return; }
    const p = e.target.closest('[data-place]'); if (p) { emit('map:place', { id: p.dataset.place }); return; }
    const a = e.target.closest('a[href^="/lexikon/"], a[href^="#lx/"]');
    if (a) { e.preventDefault(); const id = a.getAttribute('href').replace(/^(\/lexikon\/|#lx\/)/, ''); history.replaceState(history.state, '', lexPath(id)); syncMeta(); showEntry(id); }
  });
  det.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDet(); });

  function showEntry(id) {
    const e = by[id]; if (!e) return;
    // aby bylo heslo v seznamu vidět: vyčistit filtry, nastavit písmeno
    st.q = ''; st.t = ''; st.s = ''; st.side = ''; st.w = false; st.p = false; st.l = e._l; st.shown = 9999;
    $('#lxQ', el).value = ''; $('#lxS', el).value = ''; $('#lxSide', el).value = ''; $('#lxW', el).checked = false; $('#lxP', el).checked = false;
    $$('[data-t]', el).forEach((x) => { x.classList.toggle('on', x.dataset.t === ''); x.setAttribute('aria-pressed', x.dataset.t === ''); });
    $$('[data-l]', el).forEach((x) => { x.classList.toggle('on', x.dataset.l === st.l); x.setAttribute('aria-pressed', x.dataset.l === st.l); });
    run(); open(id, false);
    const b = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (window.matchMedia('(max-width: 900px)').matches) det.focus({ preventScroll: true });
    else (b || el.querySelector('.lx-body')).scrollIntoView({ behavior: 'auto', block: 'center' });
  }
  window.addEventListener('lexikon:open', (e) => showEntry(e.detail.id));
  window.addEventListener('registry:search', (e) => {
    st.q = e.detail.q.replace(/^(král|královna|lord|lady|kapitán|generál|velekněžka|mistr|baron|princ|admirál)\s+/i, ''); st.t = ''; st.l = ''; st.shown = PAGE;
    $('#lxQ', el).value = st.q;
    $$('[data-t]', el).forEach((x) => { x.classList.toggle('on', x.dataset.t === ''); x.setAttribute('aria-pressed', x.dataset.t === ''); });
    $$('[data-l]', el).forEach((x) => { x.classList.toggle('on', x.dataset.l === ''); x.setAttribute('aria-pressed', x.dataset.l === ''); });
    run();
    setTimeout(() => el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }), 30);
  });
  window.__lexikon = { open: showEntry, count: () => E.length };
  run();
}

/** /lexikon/<heslo> otevře heslo, /lexikon?q=… vyhledá. */
export function enter(r) {
  if (r.sub) window.dispatchEvent(new CustomEvent('lexikon:open', { detail: { id: r.sub } }));
  else if (r.query.q) window.dispatchEvent(new CustomEvent('registry:search', { detail: { q: r.query.q } }));
}

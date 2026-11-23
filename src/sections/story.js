// 2. Příběh: pět knih, 36 kapitol jako čtení. Převyprávění s citacemi z textů hráčů, marginálie s daty,
// obsah s postupem čtení, „pokračovat, kde jsem skončil“, klávesy ←/→, prokliky na svědectví, mapu, bitvy, proroctví a postavy.
import { D } from '../lib/data.js';
import { img, largest, small, ratio } from '../lib/img.js';
import { $, $$, esc, nb, plural, reduced, settleScroll } from '../lib/util.js';
import { ash } from '../lib/ash.js';
import { openLightbox } from '../lib/lightbox.js';
import { emit } from '../lib/sections.js';
import { routeSvg } from '../lib/minimap.js';

const KEY_POS = 'zd-cteni', KEY_DONE = 'zd-precteno';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* soukromé okno, plné úložiště */ } },
};
const usedWit = new Set();
const LINK = /\[([^\]]+)\]\(([wmbpcs]):([^)]+)\)/g;

// ---------------------------------------------------------------- texty a odkazy
function placeOf(id) {
  return D.map.places.find((p) => p.id === id) || D.map.off.find((p) => p.id === id) || null;
}
function placeName(id) { return D.vypraveni.places[id] || placeOf(id)?.name || id; }
function link3d(id) {
  return `<a class="lk3d" href="mapa3d/index.html#p=${esc(id)}" target="_blank" rel="noopener" title="${esc(placeName(id))} ve 3D mapě" aria-label="${esc(placeName(id))} ve 3D mapě">3D</a>`;
}
/** Text vyprávění → HTML (nejdřív escapovat, pak nahradit značky odkazů). */
function rich(t) {
  return nb(esc(t)).replace(/\[([^\]]+)\]\(([wmbpcs]):([^)]+)\)/g, (_, txt, k, id) => {
    if (k === 'w') {
      const w = D.witById[id];
      return `<a class="lk lk-w" href="#svedectvi/${id}" data-wit="${id}" title="Pustit svědectví: ${esc(w?.jmeno || '')}">${txt}<i aria-hidden="true">▶</i></a>`;
    }
    if (k === 'm') return placeOf(id)
      ? `<a class="lk lk-m" href="#mapa" data-place="${id}" title="Ukázat na mapě">${txt}</a><sup>${link3d(id)}</sup>`
      : `<a class="lk lk-m" href="mapa3d/index.html#p=${id}" target="_blank" rel="noopener" title="Ukázat ve 3D mapě">${txt}</a><sup>${link3d(id)}</sup>`;
    if (k === 'b') return `<a class="lk lk-b" href="#${id}" title="Bojové hlášení">${txt}</a>`;
    if (k === 'p') return `<a class="lk lk-p" href="#pv-${id}" data-verse="pv-${id}" title="Verš Alaundova proroctví">${txt}</a>`;
    if (k === 'c') return `<a class="lk lk-c" href="#druzina" data-char="${id}" title="Karta postavy">${txt}</a>`;
    return `<a class="lk lk-s" href="#${id}">${txt}</a>`;
  });
}
function margin(sids) {
  const ss = (sids || []).map((id) => D.sesById[id]).filter(Boolean);
  if (!ss.length) return '';
  const a = ss[0], b = ss[ss.length - 1];
  const real = a === b ? a.date_label : `${a.date_label} – ${b.date_label}`;
  const dr = a.dr_label || '';
  return `<aside class="mn" aria-label="Kdy a kde"><a href="#${a.id}"><span class="mn-r">u stolu</span> ${esc(real)}</a>${dr ? `<span class="mn-d"><span class="mn-r">ve hře</span> ${esc(dr)}</span>` : ''}${a.where_played ? `<span class="mn-w">${esc(a.where_played)}</span>` : ''}</aside>`;
}
function linksIn(blocks, kind) {
  const out = [];
  for (const b of blocks) for (const m of (b.p || b.q || '').matchAll(LINK)) if (m[2] === kind && !out.includes(m[3])) out.push(m[3]);
  return out;
}

// ---------------------------------------------------------------- střihy a doplňky
function quoteOf(w) {
  const c = w.text.filter((t) => t.length > 50 && t.length < 150);
  return (c.sort((a, b) => b.length - a.length)[0]) || w.text[0];
}
function witnessCut(sids, skip) {
  const cands = [];
  for (const sid of sids) for (const id of D.witBySrc[sid] || []) if (!usedWit.has(id) && !skip.includes(id)) cands.push(id);
  if (!cands.length) return '';
  const id = cands[0]; usedWit.add(id);
  const w = D.witById[id];
  return `<aside class="cut rv" aria-label="Střih na svědectví">
    <div class="cut-img">${img(w.portret, { alt: w.jmeno, sizes: '(max-width:760px) 100vw, 50vw', pos: w.fokus || '50% 30%' })}</div>
    <div class="cut-txt">
      <p class="cut-k">Svědectví · ${w.strana === 'nepřítel' ? '<b class="foe">nepřítel</b>' : 'spojenec'}</p>
      <blockquote>„${esc(quoteOf(w))}“</blockquote>
      <p class="cut-n"><b>${esc(w.jmeno)}</b><span>${esc(w.role)}</span></p>
      <button class="btn sm" data-wit="${esc(w.id)}">▶ Pustit celé svědectví</button>
    </div></aside>`;
}
function chapMap(c, book) {
  const r = routeSvg(c.route, { cls: 'mc' });
  if (!r) return '';
  const first = D.map.route[c.route[0]];
  const pid = D.map.places.find((p) => p.name === first.place)?.id;
  return `<figure class="mapcut rv" aria-label="Mapa kapitoly">
    <figcaption class="mapcut-k">Kudy vedla cesta · ${esc(c.title)}</figcaption>
    ${r.svg}
    <div class="mapcut-f"><span>${esc(r.names.join(' · '))}</span><span class="mapcut-b"><a class="btn sm" href="#mapa" data-era="${book.key}">Trasa ${esc(book.kap.toLowerCase())} na mapě</a>${pid ? `<a class="btn sm" href="mapa3d/index.html#p=${pid}" target="_blank" rel="noopener">3D mapa</a>` : ''}</span></div>
  </figure>`;
}
function sessionHtml(s) {
  if (s.minor) {
    return `<li class="ses minor" id="${s.id}"><div class="ses-rail"><time>${esc(s.date_label)}</time><span>${esc(s.dr_label || '')}</span></div><div class="ses-b"><h4>${esc(s.title)}</h4><p>${esc(nb(s.summary || ''))}</p></div></li>`;
  }
  const bat = (s.battles || []).map((id) => D.battleById[id]).filter(Boolean).map((b) => `<a class="ses-bat" href="#${b.id}"><span>Bitva</span><b>${esc(b.name)}</b><i>${esc(b.outcome)}</i></a>`).join('');
  const more = [];
  if (s.npcs?.length) more.push(`<p class="ses-npc"><b>Vystupují:</b> ${s.npcs.map((n) => `<a href="#rejstrik" data-npc="${esc(n)}">${esc(n)}</a>`).join(', ')}</p>`);
  if (s.lore) more.push(`<div class="ses-lore"><h5>${esc(s.lore[0])}</h5><p>${esc(s.lore[1])}</p></div>`);
  if (s.region) more.push(`<p class="ses-meta">Oblast: ${esc(s.region)}${s.game_label ? ` · ${esc(s.game_label)}` : ''}</p>`);
  return `<li class="ses" id="${s.id}">
    <div class="ses-rail"><time>${esc(s.date_label)}</time><span class="dr">${esc(s.dr_label || '')}</span>${s.where_played ? `<span class="wp">${esc(s.where_played)}</span>` : ''}${s.game_label ? `<span class="gl">${esc(s.game_label)}</span>` : ''}</div>
    <div class="ses-b">
      <h4>${esc(s.title)}</h4>
      <p>${esc(nb(s.summary || ''))}</p>
      ${s.highlights?.length ? `<ul class="hl">${s.highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${s.cast?.length ? `<p class="ses-who">Hráli: ${s.cast.map(([c, p]) => `${esc(c)}${p ? ` <span>(${esc(p)})</span>` : ''}`).join(', ')}</p>` : ''}
      ${more.length ? `<details class="ses-more"><summary>Podrobnosti</summary>${more.join('')}</details>` : ''}
      ${bat}
    </div>
  </li>`;
}

// ---------------------------------------------------------------- kapitola
function chapterHtml(c, book, n, prev, next) {
  const blocks = D.vypraveni.chapters[c.id] || [];
  const list = c.sessions.map((id) => D.sesById[id]).filter(Boolean);
  const lead = c.gallery.find((g) => g.k.startsWith('ilu/'));
  let pi = 0, lastS = '';
  const body = blocks.map((b) => {
    if (b.q) return `<blockquote class="vq rv"><p>${/^[„"]/.test(b.q) ? rich(b.q) : `„${rich(b.q)}“`}</p><footer>— ${esc(b.kdo)}${b.zdroj ? `, <cite>${esc(b.zdroj)}</cite>` : ''}</footer></blockquote>`;
    pi++;
    const sk = (b.s || []).join();
    let h = `<div class="vp-w">${sk && sk !== lastS ? margin(b.s) : ''}<p class="vp${pi === 1 ? ' dc' : ''}">${rich(b.p)}</p></div>`;
    if (sk) lastS = sk;
    if (pi === 2 && lead) h += `<figure class="v-fig rv" data-lb="${esc(largest(lead.k))}" data-cap="${esc(lead.cap)}"><div class="pic" style="aspect-ratio:${ratio(lead.k).toFixed(3)}">${img(lead.k, { alt: lead.cap, sizes: '(max-width:820px) 92vw, 760px' })}</div><figcaption>${esc(lead.cap)}</figcaption></figure>`;
    return h;
  }).join('');
  const wits = [...new Set([...linksIn(blocks, 'w'), ...c.sessions.flatMap((s) => D.witBySrc[s] || [])])].filter((id) => D.witById[id]).slice(0, 8);
  const placeIds = [...new Set([...c.route.map((i) => D.map.places.find((p) => p.name === D.map.route[i]?.place)?.id).filter(Boolean), ...linksIn(blocks, 'm')])];
  const bats = [...new Set([...list.flatMap((s) => s.battles || []), ...linksIn(blocks, 'b')])].map((id) => D.battleById[id]).filter(Boolean);
  const gal = c.gallery;
  const real = c.real, dr = c.drs;
  return `<section class="chap" id="${c.id}" data-ch="${c.id}" aria-labelledby="${c.id}-h">
    <header class="chap-h rv"><p class="chap-n">${esc(book.kap)} · kapitola ${n}</p><h3 id="${c.id}-h">${esc(c.title)}</h3>
      <p class="chap-m"><span>${esc(real)} u stolu</span>${dr ? `<span>${esc(dr)}</span>` : ''}<span>${plural(list.length, 'sezení', 'sezení', 'sezení')}</span><span>čtení asi ${c.min} min</span></p></header>
    ${c.cast?.length ? `<p class="chap-cast rv"><b>Kdo hrál</b> ${c.cast.map(([ch, p]) => `<span>${esc(ch)}${p ? ` <i>${esc(p)}</i>` : ''}</span>`).join('')}</p>` : ''}
    <div class="chap-body">${body}</div>
    <div class="chap-x rv">
      ${wits.length ? `<div class="cx"><h5>Svědci</h5><div class="cx-w">${wits.map((id) => { const w = D.witById[id]; return `<button class="cx-wit${w.strana === 'nepřítel' ? ' foe' : ''}" data-wit="${id}" aria-label="Pustit svědectví: ${esc(w.jmeno)}"><img src="${small(w.portret)}" alt="" loading="lazy" decoding="async"><span>${esc(w.jmeno.split(' (')[0])}</span></button>`; }).join('')}</div></div>` : ''}
      ${placeIds.length ? `<div class="cx"><h5>Místa</h5><p class="cx-p">${placeIds.map((id) => `<span class="chip">${placeOf(id) ? `<a href="#mapa" data-place="${id}">${esc(placeName(id))}</a>` : esc(placeName(id))}${link3d(id)}</span>`).join(' ')}</p></div>` : ''}
      ${bats.length ? `<div class="cx"><h5>Bitvy</h5><p class="cx-p">${bats.map((b) => `<a class="chip red" href="#${b.id}">${esc(b.name)}</a>`).join(' ')}</p></div>` : ''}
    </div>
    ${chapMap(c, book)}
    ${gal.length ? `<div class="chap-gal rv" aria-label="Galerie kapitoly"><h5>Obrazy a fotky od stolu <span>${gal.length}</span></h5><div class="cg">${gal.slice(0, 12).map((g, i) => `<button class="cg-i${g.k.startsWith('foto/') ? ' ph' : ''}" data-gi="${i}" aria-label="Zvětšit: ${esc(g.cap)}"><img src="${small(g.k)}" alt="" loading="lazy" decoding="async"></button>`).join('')}${gal.length > 12 ? `<button class="cg-more" data-gi="12">+${gal.length - 12}</button>` : ''}</div></div>` : ''}
    <details class="chap-ses"><summary>Kronika sezení <span>${list.length}</span></summary><ol class="sessions">${list.map(sessionHtml).join('')}</ol></details>
    ${witnessCut(c.sessions, [])}
    <nav class="chap-nav" aria-label="Další kapitoly">${prev ? `<a href="#${prev.id}" class="cn-prev"><span>◂ Kapitola ${n - 1}</span><b>${esc(prev.title)}</b></a>` : '<span></span>'}${next ? `<a href="#${next.id}" class="cn-next"><span>Kapitola ${n + 1} ▸</span><b>${esc(next.title)}</b></a>` : '<a href="#svedectvi" class="cn-next"><span>Dál ▸</span><b>Svědectví</b></a>'}</nav>
  </section>`;
}

// ---------------------------------------------------------------- oddíl
export function renderStory() {
  const el = $('#pribeh');
  const books = D.books;
  const chs = books.flatMap((b) => b.chapters.map((c) => ({ c, b })));
  const totalMin = chs.reduce((n, x) => n + x.c.min, 0);
  const pos = store.get(KEY_POS, null);
  const posCh = pos && chs.findIndex((x) => x.c.id === pos.ch);
  let html = `<header class="sec-head"><p class="kicker">Příběh</p><h2 id="pribeh-h">Pět knih</h2>
    <p class="lead">Třiadvacet let hry převyprávěných ve třiceti šesti kapitolách, podrobněji než v tištěné kronice. Na okraji stojí, kdy se hrálo u stolu a kdy se to stalo ve hře. Podtržená jména otevírají svědectví, místa na mapě, bitvy, verše proroctví a karty postav.</p>
    <p class="st-meta">${chs.length} kapitol · čtení celkem asi ${Math.round(totalMin / 5) * 5} minut · mezi kapitolami šipkami ← →</p>
    ${posCh > 0 ? `<p class="st-cont"><a class="btn red" href="#${pos.ch}" data-cont>Pokračovat ve čtení ▸</a><span>naposledy kapitola ${posCh + 1}: ${esc(chs[posCh].c.title)}</span></p>` : ''}
    <div class="orn">✦</div></header>
    <nav class="booknav" aria-label="Knihy">${books.map((b) => `<a href="#kniha-${b.key}"><b>${b.key}</b><span>${esc(b.title)}</span></a>`).join('')}</nav>`;
  let n = 0;
  for (const b of books) {
    html += `<article class="book" id="kniha-${b.key}" aria-label="${esc(b.kap)}: ${esc(b.title)}">
      <div class="book-open">
        <div class="book-bg">${img('ilu/' + b.img, { alt: '', sizes: '100vw', pos: '50% 35%' }).replace('<img ', '<img data-par="0.12" data-scale="1.16" ')}</div>
        <div class="book-shade"></div>
        <div class="book-t">
          <p class="book-k rv">${esc(b.kap)}</p>
          <h3 class="rv d1">${esc(b.title)}</h3>
          <dl class="book-3 rv d2"><div><dt>Ve hře</dt><dd>${esc(b.dr)}</dd></div><div><dt>U stolu</dt><dd>${esc(b.real)}</dd></div><div><dt>Sezení</dt><dd>${b.sessions}</dd></div><div><dt>Čtení</dt><dd>${b.chapters.reduce((s, c) => s + c.min, 0)} min</dd></div></dl>
        </div>
      </div>
      <div class="book-intro wrap-text">
        <p class="lead rv">${esc(nb(b.summary))}</p>
        <div class="book-keys rv"><div><h5>Hlavní místa</h5><p>${b.key_places.map((x) => `<span class="chip">${esc(x)}</span>`).join(' ')}</p></div>
        <div><h5>Protivníci</h5><p>${b.key_enemies.map((x) => `<span class="chip red">${esc(x)}</span>`).join(' ')}</p></div></div>
        ${b.side.map((c) => `<div class="side rv"><p class="side-k">Souběžně · ${esc(c.real)} u stolu · ${esc(c.dr)}</p><h5>${esc(c.title)}</h5><p>${esc(nb(c.summary))}</p></div>`).join('')}
        <ol class="book-toc rv">${b.chapters.map((c, i) => `<li><a href="#${c.id}"><span>${n + i + 1}</span>${esc(c.title)}<i>${c.min} min</i></a></li>`).join('')}</ol>
      </div>`;
    b.chapters.forEach((c) => {
      n++;
      const prev = chs[n - 2]?.c, next = chs[n]?.c;
      html += chapterHtml(c, b, n, prev, next);
    });
    html += `</article>`;
  }
  // obsah s postupem čtení (na širokých obrazovkách vlevo, jinak jako vysouvací list)
  html += `<div class="toc-bar" aria-hidden="true"><i id="tocBarI"></i></div>
    <nav class="toc" id="toc" aria-label="Obsah příběhu">
      <div class="toc-h"><b>Obsah</b><span id="tocPct">0 %</span><button class="toc-x" aria-label="Zavřít obsah">×</button></div>
      <ol>${books.map((b) => `<li class="toc-b"><a href="#kniha-${b.key}" class="toc-bk"><b>${b.key}</b> ${esc(b.title)}</a><ol>${b.chapters.map((c) => `<li><a href="#${c.id}" data-toc="${c.id}"><span class="tn">${chs.findIndex((x) => x.c.id === c.id) + 1}</span><span class="tt">${esc(c.title)}</span><span class="tm">${c.min}′</span><i style="--p:0"></i></a></li>`).join('')}</ol></li>`).join('')}</ol>
      <p class="toc-f">← → předchozí a další kapitola</p>
    </nav>
    <button class="toc-btn" id="tocBtn" aria-controls="toc" aria-expanded="false"><span>☰ Obsah</span><b id="tocBtnCh"></b></button>`;
  el.innerHTML = html;
  $$('.book-open', el).forEach((b) => ash(b, { count: 26 }));

  wireClicks(el);
  wireReading(el, chs);
}

function wireClicks(el) {
  el.addEventListener('click', (e) => {
    const w = e.target.closest('[data-wit]');
    if (w) { e.preventDefault(); emit('witness:open', { id: w.dataset.wit }); return; }
    const pl = e.target.closest('[data-place]');
    if (pl) { e.preventDefault(); emit('map:place', { id: pl.dataset.place }); return; }
    const v = e.target.closest('[data-verse]');
    if (v) { e.preventDefault(); history.replaceState(null, '', '#' + v.dataset.verse); emit('prophecy:verse', { id: v.dataset.verse }); return; }
    const ch = e.target.closest('[data-char]');
    if (ch) { e.preventDefault(); emit('party:open', { id: ch.dataset.char }); return; }
    const m = e.target.closest('[data-era]');
    if (m) { emit('map:era', { era: m.dataset.era }); return; }
    const np = e.target.closest('[data-npc]');
    if (np) { emit('registry:search', { q: np.dataset.npc }); return; }
    const f = e.target.closest('.v-fig');
    if (f) { openLightbox([{ src: f.dataset.lb, cap: f.dataset.cap }]); return; }
    const g = e.target.closest('[data-gi]');
    if (g) {
      const c = D.chById[g.closest('.chap').id];
      openLightbox(c.gallery.map((x) => ({ src: largest(x.k), cap: x.cap })), +g.dataset.gi); return;
    }
    const t = e.target.closest('#tocBtn');
    if (t) { toggleToc(); return; }
    if (e.target.closest('.toc-x') || (e.target.closest('#toc a') && window.matchMedia('(max-width: 1279px)').matches)) toggleToc(false);
  });
}

function toggleToc(force) {
  const toc = $('#toc'), btn = $('#tocBtn');
  const open = force ?? !toc.classList.contains('open');
  toc.classList.toggle('open', open); btn.setAttribute('aria-expanded', open);
  if (open) $('a.on', toc)?.scrollIntoView({ block: 'center' });
}

// ---------------------------------------------------------------- čtení: poloha, postup, klávesy
function wireReading(el, chs) {
  const toc = $('#toc'), bar = $('#tocBarI'), pct = $('#tocPct'), btnCh = $('#tocBtnCh');
  const done = new Set(store.get(KEY_DONE, []));
  const items = Object.fromEntries($$('[data-toc]', toc).map((a) => [a.dataset.toc, a]));
  const secs = chs.map((x) => document.getElementById(x.c.id));
  for (const id of done) items[id]?.classList.add('done');
  let cur = -1, ticking = false, saveT = 0, curAt = performance.now();
  const timeIn = {};
  const minFor = (i) => Math.min(25, chs[i].c.min * 60 * 0.3) * 1000; // přečteno = konec kapitoly na obrazovce a aspoň chvíle v ní

  function update() {
    ticking = false;
    const vh = window.innerHeight, y = window.scrollY;
    const r = el.getBoundingClientRect();
    const inStory = r.top < vh * 0.5 && r.bottom > vh * 0.5;
    document.body.classList.toggle('in-story', inStory);
    const total = Math.max(1, el.offsetHeight - vh);
    const p = Math.min(1, Math.max(0, -r.top / total));
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    pct.textContent = `${Math.round(p * 100)} %`;
    // aktuální kapitola: ta, jejíž horní hrana je nad 40 % výšky okna
    let k = -1;
    for (let i = 0; i < secs.length; i++) { if (secs[i].getBoundingClientRect().top < vh * 0.4) k = i; else break; }
    // průběh v jednotlivých kapitolách
    for (let i = Math.max(0, k - 1); i <= Math.min(secs.length - 1, k + 1); i++) {
      const s = secs[i]; if (!s) continue;
      const rr = s.getBoundingClientRect();
      const body = $('.chap-body', s).getBoundingClientRect();
      const pp = Math.min(1, Math.max(0, (vh * 0.6 - body.top) / Math.max(1, body.height)));
      if (i === k) items[s.id].lastElementChild.style.setProperty('--p', pp.toFixed(3));
      const spent = (timeIn[s.id] || 0) + (i === cur ? performance.now() - curAt : 0);
      if (pp >= 0.95 && i === k && spent >= minFor(i) && !done.has(s.id)) { done.add(s.id); items[s.id].classList.add('done'); store.set(KEY_DONE, [...done]); }
      void rr;
    }
    if (k !== cur) {
      if (cur >= 0) timeIn[secs[cur].id] = (timeIn[secs[cur].id] || 0) + performance.now() - curAt;
      if (cur >= 0) items[secs[cur].id].lastElementChild.style.setProperty('--p', done.has(secs[cur].id) ? 1 : 0);
      cur = k; curAt = performance.now();
      Object.values(items).forEach((a) => a.classList.remove('on'));
      if (k >= 0) {
        const id = secs[k].id; items[id].classList.add('on');
        btnCh.textContent = `kap. ${k + 1}`;
        if (toc.matches(':hover') === false && window.matchMedia('(min-width: 1280px)').matches) {
          const a = items[id], box = toc;
          const ar = a.getBoundingClientRect(), br = box.getBoundingClientRect();
          if (ar.top < br.top + 40 || ar.bottom > br.bottom - 40) box.scrollTop += ar.top - br.top - br.height / 2;
        }
      } else btnCh.textContent = '';
    }
    // uložit polohu (nejvýš jednou za 2 s)
    if (k >= 0 && inStory) {
      const rec = { ch: secs[k].id, n: k + 1, title: chs[k].c.title, y: Math.round(y), t: Date.now() };
      clearTimeout(saveT); saveT = setTimeout(() => store.set(KEY_POS, rec), 700); // uložit, až se čtenář zastaví
    }
    // nad plátny knih obsah ztlumit
    const veil = $$('.book-open', el).some((b) => { const q = b.getBoundingClientRect(); return q.top < vh * 0.55 && q.bottom > vh * 0.45; });
    toc.classList.toggle('veil', veil);
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  setInterval(() => { if (document.body.classList.contains('in-story') && !document.hidden) onScroll(); }, 4000);
  update();

  // klávesy ← → mezi kapitolami (jen když je čtenář v Příběhu a nepíše ani neovládá přehrávač)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable], .w-stage, .leaflet-container, .tl-scroll, #lightbox, .drawer')) return;
    if (!document.body.classList.contains('in-story')) return;
    const i = Math.max(0, cur) + (e.key === 'ArrowRight' ? 1 : -1);
    const target = cur < 0 && e.key === 'ArrowRight' ? secs[0] : secs[i];
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + target.id);
    settleScroll(target, { smooth: true });
  });
  void reduced;
}

// 2. Příběh: pět knih, 36 kapitol jako čtení. Převyprávění s citacemi z textů hráčů, marginálie s daty,
// obsah s postupem čtení, „pokračovat, kde jsem skončil“, klávesy ←/→, prokliky na svědectví, mapu, bitvy, proroctví a postavy.
import { D } from '../lib/data.js';
import { img, largest, small, ratio } from '../lib/img.js';
import { $, $$, esc, nb, plural, reduced, settleScroll } from '../lib/util.js';
import { ash } from '../lib/ash.js';
import { openLightbox } from '../lib/lightbox.js';
import { emit, navigate, bookPath, chPath, sesPath, nextAfter, H } from '../lib/router.js';
import { observe, parallax } from '../lib/reveal.js';
import { routeSvg, lazyMaps } from '../lib/minimap.js';
import media from 'virtual:media';
import STAV from '../../data/svedkove-stav.json';
import { subsCs as subs } from '../lib/wstage.js';

const VIDEO = Object.fromEntries(media.video.map((f) => [f.replace(/\.[^.]+$/, ''), f]));

const KEY_POS = 'zd-cteni', KEY_DONE = 'zd-precteno';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* soukromé okno, plné úložiště */ } },
};
const usedWit = new Set();
const LINK = /\[([^\]]+)\]\(([wmbpcsx]):([^)]+)\)/g;

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
  return nb(esc(t)).replace(/\[([^\]]+)\]\(([wmbpcsx]):([^)]+)\)/g, (_, txt, k, id) => {
    if (k === 'x') return `<a class="lk lk-x" href="${H(`#lx/${id}`)}" data-lx="${id}">${txt}</a>`;
    if (k === 'w') {
      const w = D.witById[id];
      return `<a class="lk lk-w" href="${H(`#svedectvi/${id}`)}" data-wit="${id}" title="Pustit svědectví: ${esc(w?.jmeno || '')}">${txt}<i aria-hidden="true">▶</i></a>`;
    }
    if (k === 'm') return placeOf(id)
      ? `<a class="lk lk-m" href="${H(`#mapa`)}" data-place="${id}" title="Ukázat na mapě">${txt}</a><sup>${link3d(id)}</sup>`
      : `<a class="lk lk-m" href="mapa3d/index.html#p=${id}" target="_blank" rel="noopener" title="Ukázat ve 3D mapě">${txt}</a><sup>${link3d(id)}</sup>`;
    if (k === 'b') return `<a class="lk lk-b" href="${H(`#${id}`)}" title="Bojové hlášení">${txt}</a>`;
    if (k === 'p') return `<a class="lk lk-p" href="${H(`#pv-${id}`)}" data-verse="pv-${id}" title="Verš Alaundova proroctví">${txt}</a>`;
    if (k === 'c') return `<a class="lk lk-c" href="${H(`#druzina`)}" data-char="${id}" title="Karta postavy">${txt}</a>`;
    return `<a class="lk lk-s" href="${H(`#${id}`)}">${txt}</a>`;
  });
}
function margin(sids) {
  const ss = (sids || []).map((id) => D.sesById[id]).filter(Boolean);
  if (!ss.length) return '';
  const a = ss[0], b = ss[ss.length - 1];
  const real = a === b ? a.date_label : `${a.date_label} – ${b.date_label}`;
  const dr = a.dr_label || '';
  return `<aside class="mn" aria-label="Kdy a kde"><a href="${H(`#${a.id}`)}"><span class="mn-r">u stolu</span> ${esc(real)}</a>${dr ? `<span class="mn-d"><span class="mn-r">ve hře</span> ${esc(dr)}</span>` : ''}${a.where_played ? `<span class="mn-w">${esc(a.where_played)}</span>` : ''}</aside>`;
}
function linksIn(blocks, kind) {
  const out = [];
  for (const b of blocks) for (const m of (b.p || b.q || '').matchAll(LINK)) if (m[2] === kind && !out.includes(m[3])) out.push(m[3]);
  return out;
}

// ---------------------------------------------------------------- střihy a doplňky
function quoteOf(w) {
  const tx = subs(w);
  const c = tx.filter((t) => t.length > 50 && t.length < 150);
  return (c.sort((a, b) => b.length - a.length)[0]) || tx[0];
}
/** Vsazený „hlas svědka“ uprostřed textu: živý portrét (video ve smyčce, bez zvuku), jedna věta ze svědectví, Přehrát. */
function voiceCard(cands) {
  const id = cands.find((x) => D.witById[x] && !usedWit.has(x));
  if (!id) return '';
  usedWit.add(id);
  const w = D.witById[id];
  const past = w.stav && w.stav !== 'žije';
  const vid = VIDEO[id];
  return `<aside class="vc rv${w.strana === 'nepřítel' ? ' foe' : ''}${past ? ' past' : ''}" aria-label="Hlas svědka: ${esc(w.jmeno)}">
    <div class="vc-m">${img(w.portret, { alt: '', sizes: '(max-width:760px) 40vw, 260px', pos: w.fokus || '50% 30%' })}${vid ? `<video class="vc-v" data-src="assets/video/${esc(vid)}" muted loop playsinline preload="none" aria-hidden="true"></video>` : ''}</div>
    <div class="vc-t"><p class="vc-k">Hlas svědka · ${w.strana === 'nepřítel' ? '<b class="foe">nepřítel</b>' : w.skupina === 'nadhled' ? 'z nadhledu' : 'spojenec'}${past ? ` · ${esc(w.stav)}${STAV[id]?.rok ? ` ${STAV[id].rok} DR` : ''}` : ''}</p>
      <blockquote>„${esc(quoteOf(w))}“</blockquote>
      <p class="vc-n"><b>${esc(w.jmeno)}</b><span>${esc(w.role)}</span></p>
      <button class="btn sm red" data-wit="${esc(w.id)}" aria-label="Přehrát svědectví: ${esc(w.jmeno)}">▶ Přehrát</button></div></aside>`;
}
function chapMap(c, book) {
  const r = routeSvg(c.route, { cls: 'mc', lazy: true });
  if (!r) return '';
  const first = D.map.route[c.route[0]];
  const pid = D.map.places.find((p) => p.name === first.place)?.id;
  return `<figure class="mapcut rv" aria-label="Mapa kapitoly">
    <figcaption class="mapcut-k">Kudy vedla cesta · ${esc(c.title)}</figcaption>
    ${r.svg}
    <div class="mapcut-f"><span>${esc(r.names.join(' · '))}</span><span class="mapcut-b"><a class="btn sm" href="${H(`#mapa`)}" data-era="${book.key}">Trasa ${esc(book.kap.toLowerCase())} na mapě</a>${pid ? `<a class="btn sm" href="mapa3d/index.html#p=${pid}" target="_blank" rel="noopener">3D mapa</a>` : ''}</span></div>
  </figure>`;
}
function sessionHtml(s) {
  if (s.minor) {
    return `<li class="ses minor" id="${s.id}"><div class="ses-rail"><time>${esc(s.date_label)}</time><span>${esc(s.dr_label || '')}</span></div><div class="ses-b"><h4>${esc(s.title)}</h4><p>${esc(nb(s.summary || ''))}</p></div></li>`;
  }
  const bat = (s.battles || []).map((id) => D.battleById[id]).filter(Boolean).map((b) => `<a class="ses-bat" href="${H(`#${b.id}`)}"><span>Bitva</span><b>${esc(b.name)}</b><i>${esc(b.outcome)}</i></a>`).join('');
  const more = [];
  if (s.npcs?.length) more.push(`<p class="ses-npc"><b>Vystupují:</b> ${s.npcs.map((n) => `<a href="${H(`#rejstrik`)}" data-npc="${esc(n)}">${esc(n)}</a>`).join(', ')}</p>`);
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
  const nP = blocks.filter((b) => b.p).length;
  const voiceAt = Math.max(2, Math.min(nP - 1, Math.ceil(nP / 2)));
  const voiceCands = [...new Set([...linksIn(blocks, 'w'), ...c.sessions.flatMap((s) => D.witBySrc[s] || [])])];
  const body = blocks.map((b) => {
    if (b.q) return `<blockquote class="vq rv"><p class="vq-k">${b.kdo === 'Zdeněk T.' ? 'Z textů Pána jeskyně' : 'Z deníků a textů hráčů'}</p><p>${/^[„"]/.test(b.q) ? rich(b.q) : `„${rich(b.q)}“`}</p><footer><b>${esc(b.kdo)}</b>${b.zdroj ? `<cite>${esc(b.zdroj)}</cite>` : ''}</footer></blockquote>`;
    pi++;
    const sk = (b.s || []).join();
    let h = `<div class="vp-w">${sk && sk !== lastS ? margin(b.s) : ''}<p class="vp${pi === 1 ? ' dc' : ''}">${rich(b.p)}</p></div>`;
    if (sk) lastS = sk;
    if (pi === voiceAt) h += voiceCard(voiceCands);
    if (pi === 2 && lead) h += `<figure class="v-fig rv" data-lb="${esc(largest(lead.k))}" data-cap="${esc(lead.cap)}"><div class="pic" style="aspect-ratio:${ratio(lead.k).toFixed(3)}">${img(lead.k, { alt: lead.cap, sizes: '(max-width:820px) 92vw, 760px' })}</div><figcaption>${esc(lead.cap)}</figcaption></figure>`;
    return h;
  }).join('');
  const wits = [...new Set([...linksIn(blocks, 'w'), ...c.sessions.flatMap((s) => D.witBySrc[s] || [])])].filter((id) => D.witById[id]).slice(0, 8);
  const placeIds = [...new Set([...c.route.map((i) => D.map.places.find((p) => p.name === D.map.route[i]?.place)?.id).filter(Boolean), ...linksIn(blocks, 'm')])];
  const bats = [...new Set([...list.flatMap((s) => s.battles || []), ...linksIn(blocks, 'b')])].map((id) => D.battleById[id]).filter(Boolean);
  const gal = c.gallery;
  const real = c.real, dr = c.drs;
  return `<section class="chap" id="${c.id}" data-ch="${c.id}" aria-labelledby="${c.id}-h">
    <div class="chap-tr" aria-hidden="true">${lead ? `<div class="chap-tr-img">${img(lead.k, { alt: '', sizes: '100vw', pos: '50% 40%' })}</div>` : ''}<span class="chap-tr-n">${n}</span></div>
    <header class="chap-h rv"><p class="chap-n">${esc(book.kap)} · kapitola ${n}</p><h1 id="${c.id}-h" tabindex="-1">${esc(c.title)}</h1>
      <p class="chap-m"><span>${esc(real)} u stolu</span>${dr ? `<span>${esc(dr)}</span>` : ''}<span>${plural(list.length, 'sezení', 'sezení', 'sezení')}</span><span>čtení ${readMin(c.min)}</span></p></header>
    ${c.cast?.length ? `<p class="chap-cast rv"><b>Kdo hrál</b> ${c.cast.map(([ch, p]) => `<span>${esc(ch)}${p ? ` <i>${esc(p)}</i>` : ''}</span>`).join('')}</p>` : ''}
    <div class="chap-body">${body}</div>
    <div class="chap-x rv">
      ${wits.length ? `<div class="cx"><h5>Svědci</h5><div class="cx-w">${wits.map((id) => { const w = D.witById[id]; return `<button class="cx-wit${w.strana === 'nepřítel' ? ' foe' : ''}" data-wit="${id}" aria-label="Pustit svědectví: ${esc(w.jmeno)}"><img src="${small(w.portret)}" alt="" loading="lazy" decoding="async"><span>${esc(w.jmeno.split(' (')[0])}</span></button>`; }).join('')}</div></div>` : ''}
      ${placeIds.length ? `<div class="cx"><h5>Místa</h5><p class="cx-p">${placeIds.map((id) => `<span class="chip">${placeOf(id) ? `<a href="${H(`#mapa`)}" data-place="${id}">${esc(placeName(id))}</a>` : esc(placeName(id))}${link3d(id)}</span>`).join(' ')}</p></div>` : ''}
      ${bats.length ? `<div class="cx"><h5>Bitvy</h5><p class="cx-p">${bats.map((b) => `<a class="chip red" href="${H(`#${b.id}`)}">${esc(b.name)}</a>`).join(' ')}</p></div>` : ''}
    </div>
    ${chapMap(c, book)}
    ${gal.length ? `<div class="chap-gal rv" aria-label="Galerie kapitoly"><h5>Obrazy a fotky od stolu <span>${gal.length}</span></h5><div class="cg">${gal.slice(0, 12).map((g, i) => `<button class="cg-i${g.k.startsWith('foto/') ? ' ph' : ''}" data-gi="${i}" aria-label="Zvětšit: ${esc(g.cap)}"><img src="${small(g.k)}" alt="" loading="lazy" decoding="async"></button>`).join('')}${gal.length > 12 ? `<button class="cg-more" data-gi="12">+${gal.length - 12}</button>` : ''}</div></div>` : ''}
    <details class="chap-ses"><summary>Kronika sezení <span>${list.length}</span></summary><ol class="sessions">${list.map(sessionHtml).join('')}</ol></details>
    <p class="chap-pr"><button class="chap-print" type="button" data-print="${c.id}" aria-label="Vytisknout kapitolu ${esc(c.title)}">Vytisknout kapitolu</button></p>
    <nav class="chap-nav" aria-label="Předchozí kapitola a obsah knihy">${prev ? `<a href="${chPath(prev.id)}" class="cn-prev"><span>◂ Kapitola ${n - 1}</span><b>${esc(prev.title)}</b></a>` : `<a href="/pribeh" class="cn-prev"><span>◂ Příběh</span><b>Přehled pěti knih</b></a>`}<a href="${bookPath(book.key)}" class="cn-next cn-book"><span>Obsah knihy ${book.key}</span><b>${esc(book.title)}</b></a></nav>
  </section>`;
}

// ---------------------------------------------------------------- konec knihy: co se změnilo (jen z dat)
function castOf(b) { return new Set(b.chapters.flatMap((c) => (c.cast || []).map(([ch]) => ch))); }
function changes(b, books) {
  const i = books.indexOf(b);
  const before = new Set(books.slice(0, i).flatMap((x) => [...castOf(x)]));
  const after = new Set(books.slice(i + 1).flatMap((x) => [...castOf(x)]));
  const now = castOf(b);
  const pBefore = new Set(books.slice(0, i).flatMap((x) => x.chapters.flatMap((c) => c.players || [])));
  const pNow = [...new Set(b.chapters.flatMap((c) => c.players || []))];
  const came = [...now].filter((x) => !before.has(x));
  const left = i < books.length - 1 ? [...now].filter((x) => !after.has(x)) : [];
  const newPlayers = i ? pNow.filter((x) => !pBefore.has(x)) : [];
  const sesIds = new Set(b.chapters.flatMap((c) => c.sessions));
  const bats = D.world.battles.filter((x) => sesIds.has(x.session));
  const fallen = Object.entries(STAV).filter(([k, v]) => k !== 'popis' && v && (sesIds.has(v.zdroj) || bats.some((x) => x.id === v.zdroj))).map(([k, v]) => [D.witById[k]?.jmeno || k, v, D.witById[k]?.stav]);
  const seenPl = new Set(D.map.route.filter((r) => ['I', 'II', 'III', 'IV', 'V'].indexOf(r.era) < i).map((r) => r.place));
  const newPl = [...new Set(D.map.route.filter((r) => r.era === b.key).map((r) => r.place))].filter((p) => !seenPl.has(p));
  const li = (k, v) => v ? `<div class="bc-r"><dt>${k}</dt><dd>${v}</dd></div>` : '';
  const rows = [
    li('Nově v družině', came.length ? came.map(esc).join(', ') : ''),
    li('Noví hráči u stolu', newPlayers.map(esc).join(', ')),
    li('Naposledy ve hře', left.length ? left.map(esc).join(', ') : ''),
    li('Padli a zmizeli', fallen.map(([n, v, s]) => `${esc(n.split(' (')[0])} <span>(${s === 'zmizel' ? 'zmizel' : 'padl'}, ${esc(v.kde)})</span>`).join(', ')),
    li('Bitvy', bats.map((x) => `<a href="${H(`#${x.id}`)}">${esc(x.name)}</a> <span>${esc(x.outcome.split('.')[0])}</span>`).join('<br>')),
    li('Poprvé na mapě', newPl.length ? `${newPl.length} míst: ${newPl.slice(0, 8).map(esc).join(', ')}${newPl.length > 8 ? ' …' : ''}` : ''),
  ].join('');
  return `<aside class="book-chg rv" aria-label="Co se změnilo v knize ${esc(b.key)}"><p class="bc-k">${esc(b.kap)} · konec</p><h4>Co se změnilo</h4><dl>${rows}</dl>
    <p class="bc-f">Sestaveno z dat kroniky: obsazení kapitol, bojová hlášení, trasa a stav svědků.</p></aside>`;
}

// ---------------------------------------------------------------- stránky Příběhu
// /pribeh = rozcestník pěti knih, /pribeh/kniha-N = kniha (předěl, perex, obsah), /pribeh/kniha-N/<kapitola> = kapitola.
// Žádná nekonečná stránka: každá kapitola je samostatná stránka, na konci „Dál“ na další kapitolu (router).
let chs = [], view = null, stopReading = null;
const chIndex = (id) => chs.findIndex((x) => x.c.id === id);

/** Délka čtení (iterace 10): krátké kapitoly „méně než 2 minuty“ místo nepřesného „1 min“. */
const readMin = (m, short = false) => (m <= 1 ? (short ? 'do 2 min' : 'méně než 2 minuty') : `${short ? '' : 'asi '}${m} min`);

export function renderStory() {
  const el = $('#pribeh');
  chs = D.books.flatMap((b) => b.chapters.map((c) => ({ c, b })));
  el.innerHTML = `<div id="stView"></div>
    <div class="toc-bar" aria-hidden="true"><i id="tocBarI"></i></div>
    <nav class="toc" id="toc" aria-label="Obsah příběhu">
      <div class="toc-h"><b>Obsah</b><span id="tocPct">0 %</span><button class="toc-x" type="button" aria-label="Zavřít obsah">×</button></div>
      <ol>${D.books.map((b) => `<li class="toc-b"><a href="${bookPath(b.key)}" class="toc-bk"><b>${b.key}</b> ${esc(b.title)}</a><ol>${b.chapters.map((c) => `<li><a href="${chPath(c.id)}" data-toc="${c.id}"><span class="tn">${chIndex(c.id) + 1}</span><span class="tt">${esc(c.title)}</span><span class="tm">${c.min <= 1 ? '&lt;2′' : `${c.min}′`}</span><i style="--p:0"></i></a></li>`).join('')}</ol></li>`).join('')}</ol>
      <p class="toc-f">← → předchozí a další kapitola</p>
    </nav>
    <button class="toc-btn" id="tocBtn" type="button" aria-controls="toc" aria-expanded="false"><span>☰ Obsah</span><b id="tocBtnCh"></b></button>`;
  wireClicks(el);
  wireKeys();
  const done = new Set(store.get(KEY_DONE, []));
  for (const id of done) $(`[data-toc="${id}"]`, el)?.classList.add('done');
}

function viewIndex() {
  const books = D.books;
  const totalMin = chs.reduce((n, x) => n + x.c.min, 0);
  const pos = store.get(KEY_POS, null);
  const posCh = pos ? chIndex(pos.ch) : -1;
  const done = new Set(store.get(KEY_DONE, []));
  return `<header class="sec-head"><p class="kicker">Příběh</p><h1 id="pribeh-h" tabindex="-1">Pět knih</h1>
    <p class="lead">Třiadvacet let hry převyprávěných ve třiceti šesti kapitolách, podrobněji než v tištěné kronice. Každá kapitola je samostatná stránka; na okraji stojí, kdy se hrálo u stolu a kdy se to stalo ve hře. Podtržená jména otevírají svědectví, místa na mapě, bitvy, verše proroctví a karty postav.</p>
    <p class="st-meta">${chs.length} kapitol · čtení celkem asi ${Math.round(totalMin / 5) * 5} minut · přečteno ${done.size} z ${chs.length}</p>
    <p class="st-cont">${posCh >= 0 ? `<a class="btn red" href="${chPath(pos.ch)}" data-cont>Pokračovat ve čtení ▸</a><span>naposledy kapitola ${posCh + 1}: ${esc(chs[posCh].c.title)}</span>` : `<a class="btn red" href="${chPath(chs[0].c.id)}">Začít číst: kapitola 1 ▸</a><span>${esc(chs[0].c.title)}</span>`}</p>
    <div class="orn">✦</div></header>
    <ol class="bk-cards wrap" aria-label="Knihy">${books.map((b) => {
      const n = b.chapters.filter((c) => done.has(c.id)).length;
      const all = b.summary.match(/[^.!]+[.!]+(\s|$)/g) || [b.summary];
      const sent = (all[0].length < 70 ? all.slice(0, 2) : all.slice(0, 1)).join('').trim();
      return `<li class="bk-card rv"><a href="${bookPath(b.key)}"><span class="bk-img">${img('ilu/' + b.img, { alt: '', sizes: '(max-width:760px) 100vw, 33vw', pos: '50% 35%' })}</span>
        <span class="bk-t"><span class="bk-k">${esc(b.kap)} · ${esc(b.real)} u stolu</span><b>${esc(b.title)}</b><span class="bk-p">${esc(nb(sent))}</span>
        <span class="bk-m">${b.chapters.length} kapitol · ${b.sessions} sezení${n ? ` · přečteno ${n}` : ''}</span></span><span class="bk-no" aria-hidden="true">${b.key}</span></a></li>`;
    }).join('')}</ol>`;
}

function viewBook(b) {
  const sent = b.summary.match(/[^.!]+[.!]+(\s|$)/g) || [b.summary];
  const head = sent.slice(0, 2).join('').trim(), rest = sent.slice(2).join('').trim();
  const players = [...new Set(b.chapters.flatMap((c) => c.players || []))];
  const bRoute = [...new Set(b.chapters.flatMap((c) => c.route || []))].sort((x, y) => x - y);
  const bmap = routeSvg(bRoute, { cls: 'bm', lazy: true, label: false, aspect: 1.5, pad: 50 });
  const done = new Set(store.get(KEY_DONE, []));
  return `<article class="book" id="kniha-${b.key}" aria-labelledby="kniha-${b.key}-h">
      <div class="book-open">
        <div class="book-bg">${img('ilu/' + b.img, { alt: '', sizes: '100vw', pos: '50% 35%', eager: true }).replace('<img ', '<img data-par="0.12" data-scale="1.16" ')}</div>
        <div class="book-shade"></div>
        <span class="book-num" aria-hidden="true">${b.key}</span>
        <div class="book-t">
          <p class="book-k rv">${esc(b.kap)}</p>
          <h1 class="rv d1" id="kniha-${b.key}-h" tabindex="-1">${esc(b.title)}</h1>
          <p class="book-perex rv d2">${esc(nb(head))}</p>
          <dl class="book-3 rv d2"><div><dt>U stolu</dt><dd>${esc(b.real)}</dd></div><div><dt>Ve hře</dt><dd>${esc(b.dr)}</dd></div><div><dt>Sezení</dt><dd>${b.sessions}</dd></div><div><dt>Kapitol</dt><dd>${b.chapters.length}</dd></div></dl>
          <p class="book-who rv d3"><span>Hráli</span>${players.map((x) => `<b>${esc(x)}</b>`).join('')}</p>
        </div>
        ${bmap ? `<figure class="book-map rv d3" aria-label="Úsek mapy ${esc(b.kap.toLowerCase())}">${bmap.svg}<figcaption>${esc(bmap.names.length)} míst na trase</figcaption></figure>` : ''}
      </div>
      <div class="book-intro wrap-text">
        ${rest ? `<p class="lead rv">${esc(nb(rest))}</p>` : ''}
        <h2 class="book-toc-h">Kapitoly</h2>
        <ol class="book-toc rv">${b.chapters.map((c) => { const i = chIndex(c.id); return `<li><a href="${chPath(c.id)}"${done.has(c.id) ? ' class="done"' : ''}><span>${i + 1}</span>${esc(c.title)}<i>${readMin(c.min, true)}${done.has(c.id) ? ' · přečteno' : ''}</i></a></li>`; }).join('')}</ol>
        <div class="book-keys rv"><div><h3>Hlavní místa</h3><p>${b.key_places.map((x) => `<a class="chip" href="/lexikon?q=${encodeURIComponent(x)}" title="${esc(x)} v Lexikonu">${esc(x)}</a>`).join(' ')}</p></div>
        <div><h3>Protivníci</h3><p>${b.key_enemies.map((x) => `<a class="chip red" href="/lexikon?q=${encodeURIComponent(x.split(' a ')[0])}" title="${esc(x)} v Lexikonu">${esc(x)}</a>`).join(' ')}</p></div></div>
        ${b.side.map((c) => `<div class="side rv"><p class="side-k">Souběžně · ${esc(c.real)} u stolu · ${esc(c.dr)}</p><h3>${esc(c.title)}</h3><p>${esc(nb(c.summary))}</p></div>`).join('')}
      </div>
    </article>`;
}

function viewChapter(c, b) {
  const i = chIndex(c.id);
  const last = b.chapters[b.chapters.length - 1].id === c.id;
  usedWit.clear();
  return `<article class="book book-one">${chapterHtml(c, b, i + 1, chs[i - 1]?.c, chs[i + 1]?.c)}${last ? changes(b, D.books) : ''}</article>`;
}

/** Vstup na stránku Příběhu podle adresy. */
export function enter(r, ctx = {}) {
  const el = $('#pribeh'), box = $('#stView', el);
  stopReading?.(); stopReading = null;
  const b = r.book && D.books.find((x) => x.key === r.book);
  const c = r.ch && D.chById[r.ch];
  let key;
  if (r.ch && (!c || !b)) { key = 'nf'; box.innerHTML = `<header class="sec-head"><p class="kicker">Příběh</p><h1 tabindex="-1">Kapitola nenalezena</h1><p class="lead">Tahle kapitola v kronice není. Vyberte knihu nebo kapitolu v obsahu.</p><p class="st-cont"><a class="btn red" href="/pribeh">Přehled pěti knih</a></p></header>`; }
  else if (c && c.book !== b.key) { navigate(chPath(c.id) + (r.hash ? '#' + r.hash : ''), { replace: true }); return; }
  else if (c) key = c.id;
  else if (b) key = 'kniha-' + b.key;
  else key = 'index';
  if (key !== view || key === 'index') {
    view = key;
    if (key === 'index') box.innerHTML = viewIndex();
    else if (key.startsWith('kniha-')) box.innerHTML = viewBook(b);
    else if (key !== 'nf') box.innerHTML = viewChapter(c, b);
    lazyMaps(box);
    $$('.book-open', box).forEach((x) => ash(x, { count: 26 }));
    wireVoices(box);
    observe(box); parallax(box);
  }
  const reading = !!c && key !== 'nf';
  document.body.classList.toggle('in-story', reading);
  $$('[data-toc]', el).forEach((a) => { const on = reading && a.dataset.toc === c.id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#tocBtnCh').textContent = reading ? `kap. ${chIndex(c.id) + 1}` : '';
  if (reading) {
    window.__chTitle = c.title; window.__chId = c.id;
    stopReading = wireReading(c);
    // sezení v kronice kapitoly (#s-…): rozbalit a doskrolovat
    if (ctx.state?.para) {
      // výsledek hledání v textu kapitoly: doskrolovat na odstavec a zvýraznit ho
      const t = $$('.chap-body .vp', box)[ctx.state.para - 1];
      if (t) { t.classList.add('hit'); setTimeout(() => t.classList.remove('hit'), 4500); settleScroll(t, { key: () => location.pathname === chPath(c.id) }); }
    } else if (r.hash && /^s-/.test(r.hash)) {
      const t = document.getElementById(r.hash);
      if (t) { for (let d = t.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true; t.classList.add('hit'); setTimeout(() => t.classList.remove('hit'), 4000); settleScroll(t, { key: () => location.hash === '#' + r.hash }); }
    } else if (ctx.state?.resume) {
      const pos = store.get(KEY_POS, null);
      if (pos?.ch === c.id && pos.y > 300) settleScroll({ getBoundingClientRect: () => ({ top: pos.y - window.scrollY + (document.getElementById('topbar')?.offsetHeight || 0) + 12 }) }, { key: () => location.pathname === chPath(c.id) });
    }
  } else { window.__chTitle = ''; window.__chId = ''; }
}
export function leave() { stopReading?.(); stopReading = null; document.body.classList.remove('in-story'); toggleToc(false); }

/** Drobečky, titulek a „Dál“ pro stránky Příběhu. */
export function meta(r) {
  const b = r.book && D.books.find((x) => x.key === r.book);
  const c = r.ch && D.chById[r.ch];
  if (!b) return { crumbs: [], title: 'Příběh · Západní draci', next: { href: bookPath('I'), label: `${D.books[0].kap}: ${D.books[0].title}`, sub: `${D.books[0].chapters.length} kapitol · ${D.books[0].real} u stolu` } };
  const bk = `${b.kap}: ${b.title}`;
  if (!c) {
    const f = b.chapters[0];
    return { crumbs: [['Příběh', '/pribeh'], [bk, null]], title: `${b.kap} · ${b.title} · Příběh · Západní draci`, desc: b.summary.slice(0, 180),
      next: { href: chPath(f.id), label: `Kapitola ${chIndex(f.id) + 1}: ${f.title}`, sub: `čtení ${readMin(f.min)}`, k: 'Začít číst' } };
  }
  const i = chIndex(c.id), nx = chs[i + 1];
  let next;
  if (!nx) next = { ...nextAfter('pribeh'), k: 'Dál' };
  else if (nx.b.key !== b.key) next = { href: bookPath(nx.b.key), label: `${nx.b.kap}: ${nx.b.title}`, sub: `${nx.b.chapters.length} kapitol · ${nx.b.real} u stolu` };
  else next = { href: chPath(nx.c.id), label: `Kapitola ${i + 2}: ${nx.c.title}`, sub: `čtení ${readMin(nx.c.min)}` };
  return { crumbs: [['Příběh', '/pribeh'], [`Kniha ${b.key}`, bookPath(b.key)], [`Kapitola ${i + 1}: ${c.title}`, null]],
    title: `${c.title} · Příběh · Západní draci`, desc: `${b.kap}, kapitola ${i + 1}: ${c.title}. ${c.real} u stolu${c.drs ? `, ${c.drs}` : ''}.`, next };
}

/** Živé portréty ve vsazených hlasech svědků: video (bez zvuku) hraje jen ve viditelné kartě, na desktopu a bez úsporného režimu. */
function wireVoices(el) {
  const ok = !reduced() && window.matchMedia('(min-width: 761px)').matches && !navigator.connection?.saveData;
  if (!ok) return;
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) {
      const v = e.target.querySelector('video'); if (!v) continue;
      if (e.isIntersecting) {
        if (!v.src) { v.muted = true; v.defaultMuted = true; v.playsInline = true; v.src = v.dataset.src; v.addEventListener('playing', () => v.classList.add('on'), { once: true }); }
        v.play().catch(() => {});
      } else v.pause();
    }
  }, { threshold: 0.5 });
  $$('.vc', el).forEach((c) => io.observe(c));
}

function wireClicks(el) {
  el.addEventListener('click', (e) => {
    const pr = e.target.closest('[data-print]');
    if (pr) {
      const sec = document.getElementById(pr.dataset.print); if (!sec) return;
      const old = document.title; sec.setAttribute('data-printing', ''); document.body.setAttribute('data-print-ch', '');
      document.title = `${$('h3', sec)?.textContent || 'Kapitola'} · Západní draci`;
      const done = () => { sec.removeAttribute('data-printing'); document.body.removeAttribute('data-print-ch'); document.title = old; window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); setTimeout(() => window.print(), 60); return;
    }
    const w = e.target.closest('[data-wit]');
    if (w) { e.preventDefault(); emit('witness:open', { id: w.dataset.wit }); return; }
    const pl = e.target.closest('[data-place]');
    if (pl) { e.preventDefault(); emit('map:place', { id: pl.dataset.place }); return; }
    const v = e.target.closest('[data-verse]');
    if (v) { e.preventDefault(); emit('prophecy:verse', { id: v.dataset.verse }); return; }
    const ch = e.target.closest('[data-char]');
    if (ch) { e.preventDefault(); emit('party:open', { id: ch.dataset.char }); return; }
    const m = e.target.closest('[data-era]');
    if (m) { e.preventDefault(); emit('map:era', { era: m.dataset.era }); return; }
    const np = e.target.closest('[data-npc]');
    if (np) { e.preventDefault(); emit('registry:search', { q: np.dataset.npc }); return; }
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

// ---------------------------------------------------------------- čtení jedné kapitoly: poloha, postup, přečteno
function wireReading(c) {
  const sec = document.getElementById(c.id);
  const bar = $('#tocBarI'), pct = $('#tocPct');
  const item = $(`[data-toc="${c.id}"]`);
  const done = new Set(store.get(KEY_DONE, []));
  const t0 = performance.now();
  const need = Math.min(25, c.min * 60 * 0.3) * 1000; // přečteno = konec kapitoly na obrazovce a aspoň chvíle v ní
  let ticking = false, saveT = 0;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    const total = Math.max(1, document.documentElement.scrollHeight - vh);
    const p = Math.min(1, Math.max(0, window.scrollY / total));
    bar.style.transform = `scaleX(${p.toFixed(4)})`;
    pct.textContent = `${Math.round(p * 100)} %`;
    const body = $('.chap-body', sec)?.getBoundingClientRect();
    if (!body) return;
    const pp = Math.min(1, Math.max(0, (vh * 0.6 - body.top) / Math.max(1, body.height)));
    item?.lastElementChild.style.setProperty('--p', pp.toFixed(3));
    if (pp >= 0.95 && performance.now() - t0 >= need && !done.has(c.id)) { done.add(c.id); item?.classList.add('done'); store.set(KEY_DONE, [...done]); }
    clearTimeout(saveT);
    saveT = setTimeout(() => store.set(KEY_POS, { ch: c.id, n: chIndex(c.id) + 1, title: c.title, y: Math.round(window.scrollY), t: Date.now() }), 700);
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  const iv = setInterval(() => { if (!document.hidden) onScroll(); }, 4000);
  store.set(KEY_POS, { ...(store.get(KEY_POS, {}) || {}), ch: c.id, n: chIndex(c.id) + 1, title: c.title, t: Date.now(), y: store.get(KEY_POS, {})?.ch === c.id ? store.get(KEY_POS, {}).y : 0 });
  update();
  return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); clearInterval(iv); clearTimeout(saveT); item?.lastElementChild.style.setProperty('--p', done.has(c.id) ? 1 : 0); };
}

// klávesy ← → mezi kapitolami (jen na stránce kapitoly, když čtenář nepíše ani neovládá přehrávač)
function wireKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable], .w-stage, .leaflet-container, .tl-scroll, #lightbox, .drawer, .navp, .srch')) return;
    if (document.body.dataset.page !== 'pribeh' || !window.__chId) return;
    const i = chIndex(window.__chId) + (e.key === 'ArrowRight' ? 1 : -1);
    const t = chs[i]; if (!t) return;
    e.preventDefault();
    navigate(chPath(t.c.id), { gesture: true });
  });
}

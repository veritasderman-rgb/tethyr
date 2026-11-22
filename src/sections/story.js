// 2. Příběh: pět knih, kapitoly, sezení; vložené střihy na svědectví a na mapu.
import { D } from '../lib/data.js';
import { img, largest, small, ratio } from '../lib/img.js';
import { $, $$, esc, nb, plural, h } from '../lib/util.js';
import { ash } from '../lib/ash.js';
import { openLightbox } from '../lib/lightbox.js';

const usedWit = new Set();

function whoPlayed(s) {
  const out = [];
  for (const c of s.characters || []) {
    const ch = D.characters.find((x) => x.name === c || x.name.split(' ')[0] === c || (c === 'Raymond' && x.id === 'ray'));
    const p = ch?.player?.replace(', Pán jeskyně', '');
    out.push(p ? `${esc(c)} <span>(${esc(p)})</span>` : esc(c));
  }
  return out.join(', ');
}

function quoteOf(w) {
  const c = w.text.filter((t) => t.length > 50 && t.length < 150);
  return (c.sort((a, b) => b.length - a.length)[0]) || w.text[0];
}

function witnessCut(sids) {
  const cands = [];
  for (const sid of sids) for (const id of D.witBySrc[sid] || []) if (!usedWit.has(id)) cands.push(id);
  if (!cands.length) return '';
  // preferuj někoho, kdo ještě nemluvil, a střídej strany
  const id = cands[0]; usedWit.add(id);
  const w = D.witById[id];
  return `<aside class="cut rv" aria-label="Střih na svědectví">
    <div class="cut-img">${img(w.portret, { alt: w.jmeno, sizes: '(max-width:760px) 100vw, 50vw', pos: w.fokus || '50% 30%' })}</div>
    <div class="cut-txt">
      <p class="cut-k">Svědectví · ${w.strana === 'nepřítel' ? '<b class="foe">nepřítel</b>' : w.skupina === 'družina' ? 'z družiny' : 'spojenec'}</p>
      <blockquote>„${esc(quoteOf(w))}“</blockquote>
      <p class="cut-n"><b>${esc(w.jmeno)}</b><span>${esc(w.role)}</span></p>
      <button class="btn sm" data-wit="${esc(w.id)}">▶ Pustit celé svědectví</button>
    </div></aside>`;
}

function mapCut(book) {
  const pts = D.map.route.filter((r) => r.era === book.key && r.x != null);
  if (pts.length < 2) return '';
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = 70;
  let x0 = Math.max(0, Math.min(...xs) - pad), x1 = Math.min(2576, Math.max(...xs) + pad);
  let y0 = Math.max(0, Math.min(...ys) - pad), y1 = Math.min(884, Math.max(...ys) + pad);
  // poměr stran aspoň 2:1
  if ((x1 - x0) / (y1 - y0) < 2) { const need = (y1 - y0) * 2 - (x1 - x0); x0 = Math.max(0, x0 - need / 2); x1 = Math.min(2576, x1 + need / 2); }
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const names = [...new Set(pts.map((p) => p.place))];
  return `<aside class="mapcut rv" aria-label="Střih na mapu">
    <div class="mapcut-k">Mapa tažení · ${esc(book.kap)}</div>
    <svg viewBox="${x0} ${y0} ${x1 - x0} ${y1 - y0}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Trasa družiny: ${esc(names.join(', '))}">
      <image href="img/map/toril-2576.webp" x="0" y="0" width="2576" height="884"/>
      <rect x="0" y="0" width="2576" height="884" fill="rgba(18,16,13,.42)"/>
      <path d="${d}" class="mc-route" pathLength="1"/>
      ${pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${i === 0 || i === pts.length - 1 ? 7 : 4.5}" class="mc-pt"/>`).join('')}
    </svg>
    <div class="mapcut-f"><span>${esc(names.slice(0, 7).join(' · '))}${names.length > 7 ? ' …' : ''}</span><a class="btn sm" href="#mapa" data-era="${book.key}">Otevřít na mapě</a></div>
  </aside>`;
}

function sessionHtml(s) {
  if (s.minor) {
    return `<li class="ses minor" id="${s.id}"><div class="ses-rail"><time>${esc(s.date_label)}</time><span>${esc(s.dr_label || '')}</span></div><div class="ses-b"><h4>${esc(s.title)}</h4><p>${esc(nb(s.summary || ''))}</p></div></li>`;
  }
  const ilu = (s.ilu || []).map((m) => `<figure class="ses-ilu" data-lb="${esc(largest('ilu/' + m.f))}" data-cap="${esc(m.cap)}"><div class="pic" style="aspect-ratio:${ratio('ilu/' + m.f).toFixed(3)}">${img('ilu/' + m.f, { alt: m.cap, sizes: '(max-width:900px) 92vw, 760px' })}</div><figcaption>${esc(m.cap)}</figcaption></figure>`).join('');
  const gal = (s.gal || []);
  const ph = (s.photos || []);
  const thumbs = [
    ...gal.map((g) => ({ key: `nove/n${String(g.n).padStart(2, '0')}`, cap: g.cap })),
    ...ph.map((n) => ({ key: `foto/${String(n).padStart(3, '0')}`, cap: `U stolu, ${s.date_label}` })),
  ];
  const bat = (s.battles || []).map((id) => D.battleById[id]).filter(Boolean).map((b) => `<a class="ses-bat" href="#${b.id}"><span>Bitva</span><b>${esc(b.name)}</b><i>${esc(b.outcome)}</i></a>`).join('');
  const more = [];
  if (s.npcs?.length) more.push(`<p class="ses-npc"><b>Vystupují:</b> ${s.npcs.map((n) => `<a href="#rejstrik" data-npc="${esc(n)}">${esc(n)}</a>`).join(', ')}</p>`);
  if (s.lore) more.push(`<div class="ses-lore"><h5>${esc(s.lore[0])}</h5><p>${esc(s.lore[1])}</p></div>`);
  if (s.region) more.push(`<p class="ses-meta">Oblast: ${esc(s.region)}${s.game_label ? ` · ${esc(s.game_label)}` : ''}</p>`);
  return `<li class="ses rv" id="${s.id}">
    <div class="ses-rail">
      <time>${esc(s.date_label)}</time>
      <span class="dr">${esc(s.dr_label || '')}</span>
      ${s.where_played ? `<span class="wp">${esc(s.where_played)}</span>` : ''}
      ${s.game_label ? `<span class="gl">${esc(s.game_label)}</span>` : ''}
    </div>
    <div class="ses-b">
      <h4>${esc(s.title)}</h4>
      ${ilu}
      <p>${esc(nb(s.summary || ''))}</p>
      ${s.highlights?.length ? `<ul class="hl">${s.highlights.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${s.characters?.length ? `<p class="ses-who">Hráli: ${whoPlayed(s)}</p>` : ''}
      ${thumbs.length ? `<div class="ses-th">${thumbs.slice(0, 8).map((t, i) => `<button class="th" data-i="${i}" aria-label="Zvětšit: ${esc(t.cap)}"><img src="${small(t.key)}" alt="" loading="lazy" decoding="async"></button>`).join('')}${thumbs.length > 8 ? `<span class="th-more">+${thumbs.length - 8}</span>` : ''}</div>` : ''}
      ${more.length ? `<details class="ses-more"><summary>Podrobnosti</summary>${more.join('')}</details>` : ''}
      ${bat}
    </div>
  </li>`;
}

export function renderStory() {
  const el = $('#pribeh');
  const books = D.books;
  let html = `<header class="sec-head"><p class="kicker">Příběh</p><h2 id="pribeh-h">Pět knih</h2>
    <p class="lead">Kronika jde sezení po sezení ve dvou časech: v letopočtu Údolí, ve kterém se příběh odehrál, a v letech, kdy se hrál u stolu. Mezi kapitolami se ozývají svědci a mapa ukazuje, kam družina došla.</p><div class="orn">✦</div></header>
    <nav class="booknav" aria-label="Knihy">${books.map((b) => `<a href="#kniha-${b.key}"><b>${b.key}</b><span>${esc(b.title)}</span></a>`).join('')}</nav>`;
  let chN = 0;
  for (const b of books) {
    const ses = D.sessions.filter((s) => s.era === b.key);
    html += `<article class="book" id="kniha-${b.key}" aria-label="${esc(b.kap)}: ${esc(b.title)}">
      <div class="book-open">
        <div class="book-bg">${img('ilu/' + b.img, { alt: '', sizes: '100vw', pos: '50% 35%' }).replace('<img ', '<img data-par="0.12" data-scale="1.16" ')}</div>
        <div class="book-shade"></div>
        <div class="book-t">
          <p class="book-k rv">${esc(b.kap)}</p>
          <h3 class="rv d1">${esc(b.title)}</h3>
          <dl class="book-3 rv d2"><div><dt>Ve hře</dt><dd>${esc(b.dr)}</dd></div><div><dt>U stolu</dt><dd>${esc(b.real)}</dd></div><div><dt>Sezení</dt><dd>${b.sessions}</dd></div></dl>
        </div>
      </div>
      <div class="book-intro wrap-text">
        <p class="lead rv">${esc(nb(b.summary))}</p>
        <div class="book-keys rv"><div><h5>Hlavní místa</h5><p>${b.key_places.map((x) => `<span class="chip">${esc(x)}</span>`).join(' ')}</p></div>
        <div><h5>Protivníci</h5><p>${b.key_enemies.map((x) => `<span class="chip red">${esc(x)}</span>`).join(' ')}</p></div></div>
        ${b.side.map((c) => `<div class="side rv"><p class="side-k">Souběžně · ${esc(c.real)} u stolu · ${esc(c.dr)}</p><h5>${esc(c.title)}</h5><p>${esc(nb(c.summary))}</p></div>`).join('')}
      </div>`;
    b.chapters.forEach((c, ci) => {
      chN++;
      const list = c.sessions.map((id) => D.sesById[id]).filter(Boolean);
      html += `<section class="chap" id="${c.id}" aria-label="${esc(c.title)}">
        <header class="chap-h rv"><p class="chap-n">Kapitola ${chN}</p><h3>${esc(c.title)}</h3>
        <p class="chap-m">${esc(c.real)} u stolu${c.drs ? ` · ${esc(c.drs)}` : ''} · ${plural(list.length, 'sezení', 'sezení', 'sezení')}${c.regions.length ? ` · ${esc(c.regions.slice(0, 3).join(', '))}` : ''}</p></header>
        ${c.vypraveni?.length ? `<div class="chap-v rv">${c.vypraveni.map((p) => `<p>${esc(nb(p))}</p>`).join('')}</div>` : ''}
        <ol class="sessions">${list.map(sessionHtml).join('')}</ol>
        ${witnessCut(c.sessions)}
      </section>`;
      if (ci === Math.floor(b.chapters.length / 2) - 1) html += mapCut(b);
    });
    html += `</article>`;
  }
  el.innerHTML = html;
  $$('.book-open', el).forEach((b) => ash(b, { count: 26 }));
  // lightbox pro malby a fotky
  el.addEventListener('click', (e) => {
    const f = e.target.closest('.ses-ilu');
    if (f) { openLightbox([{ src: f.dataset.lb, cap: f.dataset.cap }]); return; }
    const th = e.target.closest('.th');
    if (th) {
      const li = th.closest('.ses'); const s = D.sesById[li.id];
      const list = [...(s.gal || []).map((g) => ({ src: largest(`nove/n${String(g.n).padStart(2, '0')}`), cap: g.cap })),
        ...(s.photos || []).map((n) => ({ src: largest(`foto/${String(n).padStart(3, '0')}`), cap: `U stolu, ${s.date_label}` }))];
      openLightbox(list, +th.dataset.i); return;
    }
    const w = e.target.closest('[data-wit]');
    if (w) { window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: w.dataset.wit } })); return; }
    const m = e.target.closest('[data-era]');
    if (m) { window.dispatchEvent(new CustomEvent('map:era', { detail: { era: m.dataset.era } })); }
    const n = e.target.closest('[data-npc]');
    if (n) { window.dispatchEvent(new CustomEvent('registry:search', { detail: { q: n.dataset.npc } })); }
  });
  void h;
}

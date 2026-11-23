// 8. Časová osa: dvojí čas (u stolu × DR), linky postav, události, sezení; malovaná osa s přiblížením.
import L from 'leaflet';
import { D } from '../lib/data.js';
import { img, largest } from '../lib/img.js';
import { $, $$, esc, norm } from '../lib/util.js';
import { emit, H as HREF } from '../lib/router.js';

const T0 = 2003, T1 = 2027;
// tmavé barvy linek (z malované osy na pergamenu) zesvětlit pro tmavé pozadí
function lift(hex) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.38 && !(r > g * 2.2 && r > b * 2.2)) { const k = 0.45; r = Math.round(r + (255 - r) * k); g = Math.round(g + (255 - g) * k); b = Math.round(b + (255 - b) * k); }
  return `rgb(${r},${g},${b})`;
}
const ERA_COL = { I: '#c9a54a', II: '#d0573f', III: '#7fa37a', IV: '#6f9ccf', V: '#d7c49a' };

function svg(Wpx) {
  const TL = D.timeline;
  const padL = 18, padR = 30;
  const x = (t) => padL + ((t - T0) / (T1 - T0)) * (Wpx - padL - padR);
  const lanes = [...TL.lines].sort((a, b) => b.lane - a.lane);
  const laneY = {}; lanes.forEach((l, i) => { laneY[l.name] = 182 + i * 19; });
  const yEnd = 182 + lanes.length * 19 + 10;
  const sesY = yEnd + 34, drY = sesY + 46, H = drY + 40;
  let s = `<svg class="tl-svg" viewBox="0 0 ${Wpx} ${H}" width="${Wpx}" height="${H}" role="group" aria-label="Časová osa hry 2003–2026">`;
  // knihy
  TL.books.forEach((b, i) => {
    s += `<rect x="${x(b.t0)}" y="18" width="${x(b.t1) - x(b.t0)}" height="${H - 18}" class="tl-band b${i % 2}"/>`;
    const wpx = x(b.t1) - x(b.t0); const [kn, tt] = b.label.split(' · ');
    const lab = wpx > tt.length * 7.2 + 60 ? `${['I', 'II', 'III', 'IV', 'V'][i]} · ${tt}` : ['I', 'II', 'III', 'IV', 'V'][i];
    s += `<text x="${x(b.t0) + 8}" y="36" class="tl-book"><title>${esc(b.label)}</title>${esc(lab)}</text>`; void kn;
  });
  // roky
  for (let y = T0; y <= 2026; y++) {
    s += `<line x1="${x(y)}" x2="${x(y)}" y1="46" y2="${H - 30}" class="tl-yr"/><text x="${x(y) + 3}" y="58" class="tl-yt">${y}</text>`;
  }
  // události: vodorovné popisky rozložené do řádků tak, aby se nepřekrývaly ani s čarami událostí nad nimi
  const ROWS = [74, 90, 106, 122, 138, 154];
  const occ = ROWS.map(() => []);
  const free = (r, a, b) => occ[r].every(([p, q]) => b + 6 < p || a - 6 > q);
  TL.events.forEach((e) => {
    const xx = x(e.t);
    let label = e.label;
    const width = (s2) => s2.length * 6.2 + 6;
    // v každém řádku zkusit popisek vpravo od tečky, pak vlevo; když se nevejde nikam, zkrátit
    const place = (lab) => {
      const w = width(lab);
      for (let r = 0; r < ROWS.length; r++) for (const side of ['start', 'end']) {
        const a = side === 'start' ? xx + 7 : xx - 7 - w, b = a + w;
        if (a < 4 || b > Wpx - 4) continue;
        if (free(r, Math.min(a, xx - 4), Math.max(b, xx + 4))) return { r, a, b, side };
      }
      return null;
    };
    let pl = place(label);
    while (!pl && label.length > 6) { label = label.slice(0, -2).trimEnd(); pl = place(label + '…'); if (pl) label += '…'; }
    if (!pl) return;
    occ[pl.r].push([Math.min(pl.a, xx - 4), Math.max(pl.b, xx + 4)]);
    const yy = ROWS[pl.r];
    s += `<line x1="${xx}" x2="${xx}" y1="${yy}" y2="${yEnd}" class="tl-ev"/><circle cx="${xx}" cy="${yy}" r="3.5" class="tl-evd"/>`;
    s += `<text x="${pl.side === 'start' ? pl.a : pl.b}" y="${yy + 4}" text-anchor="${pl.side}" class="tl-evt"><title>${esc(e.label)}</title>${esc(label)}</text>`;
  });
  // linky postav
  for (const l of lanes) {
    const y = laneY[l.name];
    const c = D.characters.find((ch) => norm(ch.name) === norm(l.name) || norm(ch.name.split(' ')[0]) === norm(l.name));
    s += `<g class="tl-line" data-c="${esc(c?.id || '')}" tabindex="0" role="button" aria-label="${esc(l.name)}, hraje ${esc(l.player)}, ${Math.floor(l.t0)}–${Math.floor(l.t1)}">
      <line x1="${x(l.t0)}" x2="${x(l.t1)}" y1="${y - 6}" y2="${y - 6}" class="tl-hit" stroke="transparent" stroke-width="44" pointer-events="stroke"/>
      <line x1="${x(l.t0)}" x2="${x(l.t1)}" y1="${y}" y2="${y}" stroke="${lift(l.color)}" class="tl-l${['Rauko', 'Ho'].includes(l.name) ? ' main' : ''}"/>
      <circle cx="${x(l.t0)}" cy="${y}" r="3.5" fill="${lift(l.color)}"/><circle cx="${x(l.t1)}" cy="${y}" r="3" class="tl-end" stroke="${lift(l.color)}"/>
      <text x="${x(l.t0) + 7}" y="${y - 4}" class="tl-ln">${esc(l.name)} <tspan>· ${esc(l.player)}</tspan></text></g>`;
  }
  // sezení
  s += `<text x="${padL}" y="${sesY - 14}" class="tl-lab">Sezení</text>`;
  for (const se of TL.sessions) {
    if (se.t > 2026.95) continue;
    s += `<a href="${HREF(`#${se.id}`)}" class="tl-s"><circle cx="${x(se.t)}" cy="${sesY}" r="4" fill="${ERA_COL[se.era] || '#aaa'}"><title>${esc(se.title)}${se.dr ? ` · ${se.dr} DR` : ''}</title></circle></a>`;
  }
  // DR osa
  s += `<text x="${padL}" y="${drY - 16}" class="tl-lab">Ve hře (DR)</text>`;
  for (let y = T0; y <= 2026; y++) {
    const ds = TL.dr.filter(([t]) => t >= y && t < y + 1).map(([, d]) => d);
    if (!ds.length) continue;
    const a = Math.min(...ds), b = Math.max(...ds);
    s += `<text x="${x(y + 0.5)}" y="${drY}" class="tl-dr">${a === b ? a : `${a}–${String(b).slice(-2)}`}</text>`;
  }
  return s + '</svg>';
}


// Mobilní varianta: karty po letech, vodorovný posun s přichytáváním, dotykové cíle >= 44 px.
function mobileHtml() {
  const TL = D.timeline;
  const yrs = Array.from({ length: T1 - T0 }, (_, i) => T0 + i);
  const books = TL.books;
  const romans = ['I', 'II', 'III', 'IV', 'V'];
  const charOf = (name) => D.characters.find((ch) => norm(ch.name) === norm(name) || norm(ch.name.split(' ')[0]) === norm(name));
  const card = (y) => {
    const bi = books.findIndex((b) => y + 0.5 >= b.t0 && y + 0.5 < b.t1);
    const ds = TL.dr.filter(([t]) => t >= y && t < y + 1).map(([, d]) => d);
    const drTxt = ds.length ? (Math.min(...ds) === Math.max(...ds) ? `${ds[0]} DR` : `${Math.min(...ds)}–${String(Math.max(...ds)).slice(-2)} DR`) : '';
    const ev = TL.events.filter((e) => Math.floor(e.t) === y);
    const act = TL.lines.filter((l) => l.t0 < y + 1 && l.t1 > y).sort((a, b) => a.lane - b.lane);
    const ses = TL.sessions.filter((x) => Math.floor(x.t) === y);
    return `<article class="tl-y" id="tly-${y}" data-y="${y}" style="--bk:${ERA_COL[romans[bi]] || '#c9a54a'}" aria-label="Rok ${y}">
      <header><h4>${y}</h4><span class="dr">${esc(drTxt)}</span></header>
      <p class="bk">${bi >= 0 ? esc(books[bi].label.replace('Kniha ', 'Kniha ')) : ''}</p>
      ${ev.length ? `<h5>Události</h5><ul class="tl-ev-l">${ev.map((e) => `<li>${esc(e.label)}</li>`).join('')}</ul>` : ''}
      ${act.length ? `<h5>U stolu hráli (${act.length})</h5><div class="tl-pc">${act.map((l) => { const c = charOf(l.name); return `<button type="button" ${c ? `data-c="${esc(c.id)}"` : 'disabled'} style="--c:${lift(l.color)}"><i></i>${esc(l.name)} <small>${esc(l.player)}</small></button>`; }).join('')}</div>` : ''}
      ${ses.length ? `<h5>Sezení (${ses.length})</h5><div class="tl-ses">${ses.map((x) => `<a href="${HREF(`#${esc(x.id)}`)}" style="--c:${ERA_COL[x.era] || '#aaa'}">${esc(x.title.length > 30 ? x.title.slice(0, 28).trim() + '…' : x.title)}</a>`).join('')}</div>` : '<h5>Sezení</h5><p class="small">V tomto roce kronika žádné sezení nezná.</p>'}
    </article>`;
  };
  return `<div class="tl-mob" id="tlMob" aria-label="Časová osa po letech">
    <div class="tl-mob-h" role="group" aria-label="Skok na rok">${yrs.map((y) => `<button type="button" data-y="${y}" aria-label="Rok ${y}">${y}</button>`).join('')}</div>
    <div class="tl-mob-track" id="tlTrack" tabindex="0" aria-label="Roky hry, posouvejte vodorovně">${yrs.map(card).join('')}</div>
    <p class="tl-mob-hint">Posouvejte do stran · klepnutím na postavu otevřete její životopis</p></div>`;
}
function wireMobile(el) {
  const root = $('#tlMob', el); if (!root) return;
  const track = $('#tlTrack', root), chips = $$('.tl-mob-h button', root), cards = $$('.tl-y', track);
  const setOn = (y) => chips.forEach((b) => { const on = +b.dataset.y === y; b.setAttribute('aria-current', on ? 'true' : 'false'); if (on) { const h = b.parentElement; h.scrollTo({ left: b.offsetLeft - h.clientWidth / 2 + b.clientWidth / 2, behavior: 'smooth' }); } });
  const io = new IntersectionObserver((ents) => { for (const e of ents) if (e.isIntersecting) setOn(+e.target.dataset.y); }, { root: track, threshold: 0.6 });
  cards.forEach((c) => io.observe(c));
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.tl-mob-h button');
    if (b) { document.getElementById('tly-' + b.dataset.y)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); return; }
    const c = e.target.closest('.tl-pc button[data-c]');
    if (c) emit('party:open', { id: c.dataset.c });
  });
  // začít u roku, kde se hrálo právě „teď“ příběhu: první rok
  setOn(T0);
}

export function renderTimeline() {
  const el = $('#osa');
  const dr = D.timeline.dr_events;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Časová osa</p><h1 id="osa-h" tabindex="-1">Dvojí čas</h1>
    <p class="lead">Nahoře léta u stolu, dole letopočet Údolí. Každá barevná linka je jedna postava a ten, kdo ji hrál. Tečky jsou sezení, klepnutím se otevřou v kronice.</p><div class="orn">✦</div></header>
    <div class="wrap tl-ctl"><div><button class="btn sm" data-z="-1" aria-label="Oddálit">−</button><button class="btn sm" data-z="1" aria-label="Přiblížit">+</button></div>
      <button class="btn sm" id="tlPaint">Malovaná osa ▸</button></div>
    <div class="tl-scroll wrap" id="tlScroll" tabindex="0" aria-label="Časová osa, lze posouvat"></div>
    ${mobileHtml()}
    <div class="wrap tl-paint">
      <button class="tl-paint-btn" id="tlPaint2" aria-label="Otevřít malovanou osu"><span class="pic">${img('osa/osa_full', { alt: 'Malovaná časová osa Cesty Tethyrské královské družiny', sizes: '320px' })}</span><span><b>Cesta Tethyrské královské družiny</b><i>Malovaná osa, jak visí na zdi. Otevřít a přiblížit.</i></span></button>
    </div>
    <div class="wrap dr-list"><h3>Herní letopočet</h3><p class="small">Události světa v pořadí, v jakém se staly. Zlatě jsou ty, které se odehrály u stolu.</p>
      <ol class="drl">${dr.map((t) => `<li class="${t.played ? 'played' : ''}"><span>${esc(t.dr_label || t.dr)}</span><b>${esc(t.title)}</b><p>${esc(t.text || '')}</p></li>`).join('')}</ol></div>`;
  wireMobile(el);
  const box = $('#tlScroll', el);
  let z = 1;
  const draw = () => {
    const base = Math.max(1700, box.clientWidth);
    box.innerHTML = svg(Math.round(base * z));
  };
  draw();
  new ResizeObserver(() => { if (z === 1) draw(); }).observe(box);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-z]');
    if (b) { const c = box.scrollLeft / Math.max(1, box.scrollWidth); z = Math.min(4, Math.max(1, z + (+b.dataset.z) * 0.75)); draw(); box.scrollLeft = c * box.scrollWidth; }
    const ln = e.target.closest('.tl-line');
    if (ln?.dataset.c) emit('party:open', { id: ln.dataset.c });
    if (e.target.closest('#tlPaint, #tlPaint2')) paint();
  });
  box.addEventListener('keydown', (e) => {
    const ln = e.target.closest('.tl-line');
    if (ln && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); emit('party:open', { id: ln.dataset.c }); }
  });
}

function paint() {
  const lb = $('#lightbox');
  lb.hidden = false; document.body.style.overflow = 'hidden';
  lb.innerHTML = `<div class="lb-stage"><button class="lb-close" aria-label="Zavřít">×</button><div class="lb-map" id="osaMap"></div></div><div class="lb-cap">Malovaná osa · kolečkem nebo prsty přibližte, tažením posouvejte</div>`;
  const [w, h] = D.images['osa/osa_full'] || [2480, 3508];
  const m = L.map('osaMap', { crs: L.CRS.Simple, minZoom: -3, maxZoom: 1, zoomSnap: 0.25, attributionControl: false });
  const bounds = [[-h, 0], [0, w]];
  L.imageOverlay(largest('osa/osa_full'), bounds).addTo(m);
  m.fitBounds(bounds);
  const close = () => { m.remove(); lb.hidden = true; lb.innerHTML = ''; document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
  const k = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', k);
  $('.lb-close', lb).onclick = close;
  $('.lb-close', lb).focus();
  void $$;
}

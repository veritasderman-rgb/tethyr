// 5. Družina: hráčské postavy, život ve dvou časech, úrovně, předměty, vztahy; hráči a léta.
import { D } from '../lib/data.js';
import { img, small } from '../lib/img.js';
import { $, esc, nb } from '../lib/util.js';
import { openDrawer } from '../lib/lightbox.js';

const yrs = (s) => (String(s || '').match(/\d{4}/g) || []).map(Number);

function portraitHtml(c, sizes = '(max-width:760px) 50vw, 25vw') {
  if (c.portrait) return img(c.portrait.src, { alt: `Portrét: ${c.full_name || c.name}`, sizes, pos: c.portrait.kind === 'port' ? '50% 28%' : '50% 22%' });
  const ini = (c.name || '?').split(/\s+/).map((x) => x[0]).slice(0, 2).join('');
  return `<span class="mono" aria-hidden="true">${esc(ini)}</span>`;
}

function detail(c) {
  const wit = D.witById[c.id];
  const ms = c.milestones || [];
  const ses = (c.sessions || []).map((id) => D.sesById[id]).filter(Boolean);
  return `<div class="pd">
    <div class="pd-hero">${c.portrait ? img(c.portrait.src, { alt: '', sizes: '860px', pos: c.portrait.kind === 'port' ? '50% 26%' : '50% 20%' }) : ''}<div class="pd-shade"></div>
      <div class="pd-t"><p class="pd-k">${esc([c.race, c.class].filter(Boolean).join(' · '))}</p><h3>${esc(c.full_name || c.name)}</h3>
      <p class="pd-m">${c.player ? `Hraje <b>${esc(c.player)}</b> · ` : ''}u stolu ${esc(c.active_real || '')} · ve hře ${esc(c.active_dr || '')}</p></div></div>
    <div class="pd-b">
      ${c.aliases?.length ? `<p class="pd-al">Také: ${c.aliases.map(esc).join(', ')}</p>` : ''}
      <p class="lead">${esc(nb(c.intro || ''))}</p>
      ${c.appearance ? `<p><b>Vzhled.</b> ${esc(nb(c.appearance))}</p>` : ''}
      ${wit ? `<p><button class="btn sm red" data-wit="${esc(wit.id)}">▶ Svědectví: ${esc(wit.jmeno)}</button></p>` : ''}
      ${ms.length ? `<h4>Život ve dvou časech</h4><ol class="two-time">${ms.map((m) => `<li><div class="tt-r"><span>u stolu</span>${esc(m.date_label || m.date || '')}</div><div class="tt-d"><span>ve hře</span>${esc(m.dr ? m.dr + ' DR' : '')}</div><div class="tt-x"><b>${esc(m.title)}</b> ${esc(nb(m.text || ''))}</div></li>`).join('')}</ol>` : ''}
      <div class="pd-cols">
        ${c.levels?.length ? `<div><h5>Úrovně</h5><table class="mini"><tbody>${c.levels.map((l) => `<tr><td>${esc(l.date || '')}</td><td>${esc(l.dr ? l.dr + ' DR' : '')}</td><td><b>${esc(l.level || '')}</b> ${esc(l.note || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${c.items?.length ? `<div><h5>Předměty</h5><ul class="dots">${c.items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${c.abilities?.length ? `<div><h5>Schopnosti</h5><ul class="dots">${c.abilities.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        ${c.relations?.length ? `<div><h5>Vztahy</h5><ul class="rel">${c.relations.map((r) => `<li><b>${esc(r.who)}</b> – ${esc(r.what)}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${c.fate ? `<div class="pd-fate"><h5>Osud</h5><p>${esc(nb(c.fate))}</p></div>` : ''}
      ${ses.length ? `<h5>Sezení (${ses.length})</h5><p class="pd-ses">${ses.map((s) => `<a href="#${s.id}" data-close>${esc(s.date_label)}</a>`).join(' · ')}</p>` : ''}
    </div></div>`;
}

export function renderParty() {
  const el = $('#druzina');
  const pcs = D.characters.filter((c) => c.kind === 'hrac')
    .sort((a, b) => (yrs(a.active_real)[0] || 9999) - (yrs(b.active_real)[0] || 9999));
  const main = pcs.filter((c) => c.portrait?.kind === 'port' || ['nathan', 'theira', 'turgen', 'ray', 'zek', 'niri', 'zia'].includes(c.id));
  const rest = pcs.filter((c) => !main.includes(c));
  const guides = D.characters.filter((c) => c.kind === 'pruvodce');

  // hráči a léta
  const players = {};
  for (const c of pcs) for (const p of String(c.player || '').replace(', Pán jeskyně', '').split(/,\s*/)) if (p) (players[p] ||= []).push(c);
  const order = ['Lukáš', 'Pepa', 'Zdeněk K.', 'Zdeněk T.', 'Vojta', 'Jana', 'Terka', 'Venca', 'Tomáš'];
  const Y0 = 2003, Y1 = 2026, span = Y1 - Y0 + 1;
  const rows = order.filter((p) => players[p]).map((p) => {
    const cs = players[p];
    const bars = cs.map((c) => { const y = yrs(c.active_real); const a = y[0] || Y0, b = y[y.length - 1] || a; return `<i style="left:${((a - Y0) / span * 100).toFixed(2)}%;width:${(((b - a + 1) / span) * 100).toFixed(2)}%" title="${esc(c.name)} ${esc(c.active_real)}"><span>${esc(c.name)}</span></i>`; }).join('');
    return `<tr><th scope="row">${esc(p)}${p === 'Zdeněk T.' ? '<small>Pán jeskyně</small>' : ''}${p === 'Lukáš' ? '<small>i Pán jeskyně</small>' : ''}</th><td>${cs.map((c) => `<a href="#druzina" data-c="${esc(c.id)}">${esc(c.name)}</a>`).join(', ')}</td><td class="pl-bar"><div>${bars}</div></td></tr>`;
  }).join('');

  el.innerHTML = `<header class="sec-head"><p class="kicker">Družina</p><h2 id="druzina-h">Kdo šel s nimi</h2>
    <p class="lead">Za třiadvacet let prošlo družinou osm hráčů a přes dvacet postav, hru vedl jeden Pán jeskyně. Celou hru, od první hry po epilog, odehrál jen Rauko. Každá postava má dva životopisy: jeden ve hře a jeden u stolu.</p><div class="orn">✦</div></header>
    <div class="cards wrap">${main.map((c, i) => `<button class="pc rv d${i % 3}" data-c="${esc(c.id)}">
      <span class="pc-i">${portraitHtml(c)}</span>
      <span class="pc-t"><b>${esc(c.full_name || c.name)}</b><i>${esc([c.race, c.class].filter(Boolean).join(' · '))}</i><em>${esc(c.player || '')} · ${esc(c.active_real || '')}</em></span></button>`).join('')}</div>
    <div class="wrap minor-pcs"><h4>Další postavy hráčů</h4><p>${rest.map((c) => `<button class="chip" data-c="${esc(c.id)}">${esc(c.name)} <span>· ${esc(c.player || '')}</span></button>`).join(' ')}</p>
    <h4>Průvodci a důležité postavy Pána jeskyně</h4><p>${guides.map((c) => `<button class="chip gold" data-c="${esc(c.id)}">${esc(c.name)}</button>`).join(' ')}</p>
    <h4>Protivníci</h4><p>${D.characters.filter((c) => c.kind === 'protivnik').map((c) => `<button class="chip red" data-c="${esc(c.id)}">${esc(c.name)}</button>`).join(' ')}</p></div>
    <div class="wrap players rv"><h3>Hráči a léta u stolu</h3>
      <div class="pl-scroll"><table class="pl"><thead><tr><th>Hráč</th><th>Postavy</th><th class="pl-bar"><div class="pl-yrs">${[2003, 2008, 2013, 2018, 2023].map((y) => `<span style="left:${((y - Y0) / span * 100).toFixed(1)}%">${y}</span>`).join('')}</div></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small">Hru po celou dobu vedl jeden Pán jeskyně, Zdeněk T. Sám si zahrál jen pixie Zaxe v Sigilských lovcích a goliáše Zeka v nové hře. Variona hrál jiný Zdeněk, v tabulce Zdeněk K.</p></div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    e.preventDefault();
    const c = D.charById[b.dataset.c]; if (!c) return;
    openDrawer(detail(c), (panel) => {
      panel.addEventListener('click', (ev) => {
        const w = ev.target.closest('[data-wit]');
        if (w) { $('.dr-close', panel).click(); window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: w.dataset.wit } })); }
        if (ev.target.closest('[data-close]')) $('.dr-close', panel).click();
      });
    });
  });
  void small;
}

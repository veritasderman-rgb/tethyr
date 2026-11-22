// 9. Rejstřík: hledání v 810 vedlejších postavách, filtr skupina/strana, proklik na sezení.
import { D } from '../lib/data.js';
import { $, $$, esc, norm, reduced } from '../lib/util.js';

const KIND = { 'spojenec': 'spojenci', 'nepřítel': 'nepřátelé', 'neutrální': 'neutrální', 'božstvo': 'božstva', 'drak': 'draci', 'jednotka': 'jednotky' };
const PAGE = 60;

export function renderRegistry() {
  const el = $('#rejstrik');
  const N = D.npcs.map((n) => ({ ...n, _s: norm([n.name, ...(n.aliases || []), n.who, n.group, n.region, n.when].join(' ')) }));
  const groups = [...new Set(N.map((n) => n.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'cs'));
  const kinds = Object.keys(KIND).filter((k) => N.some((n) => n.kind === k));
  el.innerHTML = `<header class="sec-head"><p class="kicker">Rejstřík</p><h2 id="rejstrik-h">${N.length} vedlejších postav</h2>
    <p class="lead">Spojenci, nepřátelé, bohové a draci, se kterými se družina za třiadvacet let potkala. Hledejte jménem, přezdívkou, místem nebo rolí.</p><div class="orn">✦</div></header>
    <div class="wrap rg-ctl">
      <label class="rg-q"><span class="sr">Hledat</span><input type="search" id="rgQ" placeholder="Hledat jméno, místo, roli…" autocomplete="off"></label>
      <label class="rg-g"><span class="sr">Skupina</span><select id="rgG"><option value="">Všechny skupiny</option>${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</select></label>
      <div class="rg-k" role="group" aria-label="Strana"><button class="chip on" data-k="" aria-pressed="true">Vše</button>${kinds.map((k) => `<button class="chip k-${k === 'nepřítel' ? 'foe' : k === 'spojenec' ? 'ally' : 'n'}" data-k="${k}" aria-pressed="false">${KIND[k]}</button>`).join('')}</div>
    </div>
    <p class="wrap rg-count" id="rgCount" aria-live="polite"></p>
    <ul class="wrap rg-list" id="rgList"></ul>
    <div class="wrap rg-more"><button class="btn sm" id="rgMore" hidden>Zobrazit další</button></div>`;
  let q = '', g = '', k = '', shown = PAGE;
  const list = $('#rgList', el);
  function run() {
    const qq = norm(q).trim().split(/\s+/).filter(Boolean);
    const res = N.filter((n) => (!g || n.group === g) && (!k || n.kind === k) && qq.every((w) => n._s.includes(w)));
    $('#rgCount', el).textContent = `${res.length} ${res.length === 1 ? 'postava' : res.length < 5 && res.length ? 'postavy' : 'postav'}`;
    list.innerHTML = res.slice(0, shown).map((n) => `<li class="rg-i ${n.kind === 'nepřítel' ? 'foe' : n.kind === 'spojenec' ? 'ally' : ''}">
      <div class="rg-n"><b>${esc(n.name)}</b>${n.aliases?.length ? `<i>${n.aliases.map(esc).join(', ')}</i>` : ''}</div>
      <div class="rg-w"><p>${esc(n.who || '')}</p>${n.when ? `<p class="rg-when">${esc(n.when)}</p>` : ''}</div>
      <div class="rg-m"><span class="chip">${esc(n.group || '')}</span>${n.kind ? `<span class="chip ${n.kind === 'nepřítel' ? 'red' : n.kind === 'spojenec' ? 'gold' : ''}">${esc(n.kind)}</span>` : ''}
      ${n.sessions?.length ? `<span class="rg-s">${n.sessions.slice(0, 6).map((id) => { const s = D.sesById[id]; return s ? `<a href="#${id}" title="${esc(s.title)}">${esc(s.date_label)}</a>` : ''; }).join(' ')}${n.sessions.length > 6 ? ' …' : ''}</span>` : ''}</div></li>`).join('');
    $('#rgMore', el).hidden = res.length <= shown;
  }
  $('#rgQ', el).addEventListener('input', (e) => { q = e.target.value; shown = PAGE; run(); });
  $('#rgG', el).addEventListener('change', (e) => { g = e.target.value; shown = PAGE; run(); });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-k]');
    if (b) { k = b.dataset.k; $$('[data-k]', el).forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); shown = PAGE; run(); }
  });
  $('#rgMore', el).onclick = () => { shown += PAGE; run(); };
  window.addEventListener('registry:search', (e) => {
    q = e.detail.q.replace(/^(král|královna|lord|lady|kapitán|generál|velekněžka|mistr|baron|princ|admirál)\s+/i, ''); g = ''; k = ''; shown = PAGE;
    $('#rgQ', el).value = q; $('#rgG', el).value = '';
    $$('[data-k]', el).forEach((x) => { x.classList.toggle('on', x.dataset.k === ''); x.setAttribute('aria-pressed', x.dataset.k === ''); });
    run();
    setTimeout(() => $('#rejstrik').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth' }), 30);
  });
  run();
}

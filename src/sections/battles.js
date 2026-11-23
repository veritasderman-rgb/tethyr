// 6. Bitvy jako bojová hlášení: strany, velitelé, jednotky, průběh, výsledek, svědectví obou stran.
import { D } from '../lib/data.js';
import { img, largest, small } from '../lib/img.js';
import { $, esc, nb } from '../lib/util.js';
import { emit, battlePath, nextAfter, H } from '../lib/router.js';
import { openLightbox } from '../lib/lightbox.js';

const real = (v) => v && !['—', '–', '-', '?'].includes(String(v).trim());

function side(sd, i) {
  const u = sd.units || [];
  const hasC = u.some((x) => real(x.count)), hasK = u.some((x) => real(x.commander));
  const long = u.length > 10;
  const rows = u.map((x, j) => `<tr${long && j >= 10 ? ' class="more"' : ''}><td>${esc(x.unit)}</td>${hasC ? `<td class="n">${esc(real(x.count) ? x.count : '')}</td>` : ''}${hasK ? `<td>${esc(real(x.commander) ? x.commander : '')}</td>` : ''}</tr>`).join('');
  return `<div class="bt-side s${i}">
    <h5>${esc(sd.name)}${real(sd.total) ? ` <span>${esc(sd.total)}</span>` : ''}</h5>
    ${sd.commanders?.length ? `<p class="bt-cmd"><b>Velitelé:</b> ${sd.commanders.map(esc).join(', ')}</p>` : ''}
    ${u.length ? (!hasC && !hasK ? `<p class="bt-ul">${u.map((x) => esc(x.unit)).join(' · ')}</p>`
      : `<div class="bt-units${long ? ' clip' : ''}"><table><thead><tr><th>Jednotka</th>${hasC ? '<th>Počet</th>' : ''}${hasK ? '<th>Velitel</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>${long ? `<button class="btn sm ghost bt-all">Celá soupiska (${u.length})</button>` : ''}`) : ''}
  </div>`;
}

export function renderBattles() {
  const el = $('#bitvy');
  const B = D.world.battles;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Bitvy</p><h1 id="bitvy-h" tabindex="-1">Bojová hlášení</h1>
    <p class="lead">${B.length} bitev a střetnutí, od dávné Bitvy kostí po poslední souboj na vrcholu Pyramidy času. Velké bitvy se hrály podle vlastního bitevního systému s kartami jednotek, nejdelší z nich rok na plastické hexové ploše.</p><div class="orn">✦</div></header>
    <div class="bt-cards wrap" id="btCards">${B.map((b, i) => `<a class="bt-card" href="${battlePath(b.id)}">${b.images?.[0] ? `<img src="${small('ilu/' + b.images[0])}" alt="" loading="lazy" decoding="async">` : '<span class="bt-ph"></span>'}<span class="bt-cn">Hlášení č. ${String(i + 1).padStart(2, '0')} · ${esc(b.dr)} DR</span><b>${esc(b.name)}</b><span class="bt-co">${esc(String(b.outcome || '').split('.')[0])}</span></a>`).join('')}</div>
    ${B.map((b, i) => {
      const wit = [...new Set([...(D.witBySrc[b.id] || []), ...(b.session ? D.witBySrc[b.session] || [] : [])])].map((id) => D.witById[id]).filter(Boolean);
      const fr = wit.filter((w) => w.strana !== 'nepřítel'), fo = wit.filter((w) => w.strana === 'nepřítel');
      const ses = b.session ? D.sesById[b.session] : null;
      const pl = D.map?.battles?.find((x) => x.id === b.id)?.pl;
      const sd = b.sides || [];
      const A = sd[0], Z = sd.length > 1 ? sd[sd.length - 1] : null;
      const force = (x, k) => x ? `<div class="dp-side s${k}"><h5>${k ? 'Druhá strana' : 'Naše strana'}</h5><span class="nm">${esc(x.name)}</span>${real(x.total) ? `<span class="tot">Síly: <b>${esc(x.total)}</b></span>` : ''}${x.commanders?.length ? `<span class="cmd"><b>Velitelé</b>${x.commanders.map(esc).join(', ')}</span>` : ''}</div>` : '';
      const img0 = b.images?.[0];
      const links = [
        pl ? `<a class="btn sm" href="${H(`#mapa`)}" data-place="${esc(pl)}">Na mapě ▸</a>` : '',
        fr.length ? `<span class="lbl">Svědci naší strany</span>${fr.map((w) => `<button class="chip" data-wit="${esc(w.id)}" aria-label="Pustit svědectví: ${esc(w.jmeno)}">▶ ${esc(w.jmeno)}</button>`).join('')}` : '',
        fo.length ? `<span class="lbl">Druhé strany</span>${fo.map((w) => `<button class="chip red" data-wit="${esc(w.id)}" aria-label="Pustit svědectví nepřítele: ${esc(w.jmeno)}">▶ ${esc(w.jmeno)}</button>`).join('')}` : '',
      ].join('');
      return `<article class="bt dp rv" id="${b.id}" aria-labelledby="${b.id}-h">
        <div class="dp-top">${img0 ? `<figure class="bt-img" data-lb="${esc(largest('ilu/' + img0))}" data-cap="${esc(b.captions?.[0] || b.name)}"><div class="pic">${img('ilu/' + img0, { alt: b.captions?.[0] || b.name, sizes: '(max-width:900px) 100vw, 1180px' })}</div></figure>` : '<div class="pic"></div>'}
          <div class="dp-ov"><p class="bt-no">Hlášení č. ${String(i + 1).padStart(2, '0')}</p><h3 id="${b.id}-h">${esc(b.name)}</h3></div></div>
        <div class="dp-paper">
          <div class="dp-head"><span>Depeše z bojiště</span><b>č. ${String(i + 1).padStart(2, '0')} / ${String(B.length).padStart(2, '0')}</b></div>
          <dl class="dp-meta"><div><dt>Místo</dt><dd>${esc(b.place)}</dd></div><div><dt>Ve hře</dt><dd>${esc(b.dr)} DR</dd></div><div><dt>U stolu</dt><dd>${esc(b.real_label || '—')}</dd></div>${ses ? `<div><dt>V kronice</dt><dd><a href="${H(`#${ses.id}`)}">${esc(ses.date_label)}</a></dd></div>` : ''}</dl>
          ${A ? `<div class="dp-forces">${force(A, 0)}${Z ? '<span class="dp-vs" aria-hidden="true">VS</span>' + force(Z, 1) : ''}</div>` : ''}
          <div class="dp-cols"><div class="dp-sum"><h5 class="dh">Průběh</h5><p>${esc(nb(b.summary))}</p></div>
            <div class="dp-res"><h5 class="dh">Výsledek</h5><p>${esc(nb(b.outcome))}</p></div></div>
          ${links ? `<div class="dp-links">${links}</div>` : ''}
          ${sd.some((x) => x.units?.length) ? `<details class="dp-det"><summary>Soupisky jednotek</summary><div class="bt-sides">${sd.map(side).join('')}</div></details>` : ''}
        </div>
        <nav class="bt-pn" aria-label="Další hlášení">${i > 0 ? `<a href="${battlePath(B[i - 1].id)}">◂ Hlášení č. ${String(i).padStart(2, '0')}: ${esc(B[i - 1].name)}</a>` : '<span></span>'}<a href="/bitvy">Všechna hlášení</a></nav>
      </article>`;
    }).join('')}`;
  el.addEventListener('click', (e) => {
    const a = e.target.closest('.bt-all');
    if (a) { const box = a.previousElementSibling; box.classList.toggle('clip'); a.textContent = box.classList.contains('clip') ? a.textContent.replace('Skrýt', 'Celá soupiska') : a.textContent.replace('Celá soupiska', 'Skrýt'); return; }
    const w = e.target.closest('[data-wit]'); if (w) { emit('witness:open', { id: w.dataset.wit }); return; }
    const pm = e.target.closest('[data-place]'); if (pm) { e.preventDefault(); emit('map:place', { id: pm.dataset.place }); return; }
    const f = e.target.closest('.bt-img'); if (f) openLightbox([{ src: f.dataset.lb, cap: f.dataset.cap }]);
  });
}

/** /bitvy = přehled hlášení, /bitvy/<bitva> = jedno hlášení (jako samostatná stránka). */
export function enter(r) {
  const el = document.getElementById('bitvy');
  const one = r.sub && document.getElementById(r.sub);
  el.toggleAttribute('data-one', !!one);
  el.querySelectorAll('.bt').forEach((a) => { a.hidden = !!one ? a !== one : true; });
  if (one) one.classList.add('in');
  const lead = el.querySelector('.sec-head .lead'); if (lead) lead.hidden = !!one;
  // jedno hlášení: název nese obraz depeše, hlavička stránky zůstane jen pro čtečky (žádný dvojí titulek)
  el.querySelector('.sec-head')?.classList.toggle('sr', !!one);
  const B = D.world.battles, i = B.findIndex((b) => b.id === r.sub);
  const h = el.querySelector('#bitvy-h'), k = el.querySelector('.sec-head .kicker');
  h.textContent = one ? B[i].name : 'Bojová hlášení';
  if (k) k.textContent = one ? `Bojové hlášení č. ${String(i + 1).padStart(2, '0')} z ${B.length}` : 'Bitvy';
  document.getElementById('btCards').hidden = !!one;
}
export function meta(r) {
  const B = D.world.battles;
  const i = B.findIndex((b) => b.id === r.sub);
  if (i < 0) return null;
  const b = B[i], n = B[i + 1];
  return {
    crumbs: [['Bitvy', '/bitvy'], [b.name, null]],
    title: `${b.name} · Bitvy · Západní draci`,
    desc: `Bojové hlášení: ${b.name}, ${b.dr} DR. ${String(b.outcome || '').split('.')[0]}.`,
    next: n ? { href: battlePath(n.id), label: n.name, sub: `Hlášení č. ${String(i + 2).padStart(2, '0')} · ${n.dr} DR` } : nextAfter('bitvy'),
  };
}

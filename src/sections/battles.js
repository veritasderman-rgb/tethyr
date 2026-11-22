// 6. Bitvy jako bojová hlášení: strany, velitelé, jednotky, průběh, výsledek, svědectví obou stran.
import { D } from '../lib/data.js';
import { img, largest } from '../lib/img.js';
import { $, esc, nb } from '../lib/util.js';
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
  el.innerHTML = `<header class="sec-head"><p class="kicker">Bitvy</p><h2 id="bitvy-h">Bojová hlášení</h2>
    <p class="lead">${B.length} bitev a střetnutí, od dávné Bitvy kostí po poslední souboj na vrcholu Pyramidy času. Velké bitvy se hrály podle vlastního bitevního systému s kartami jednotek, nejdelší z nich rok na plastické hexové ploše.</p><div class="orn">✦</div></header>
    <div class="bt-index wrap">${B.map((b, i) => `<a href="#${b.id}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(b.name)}<i>${esc(b.dr)} DR</i></a>`).join('')}</div>
    ${B.map((b, i) => {
      const wit = [...new Set([...(D.witBySrc[b.id] || []), ...(b.session ? D.witBySrc[b.session] || [] : [])])].map((id) => D.witById[id]);
      const fr = wit.filter((w) => w.strana !== 'nepřítel'), fo = wit.filter((w) => w.strana === 'nepřítel');
      const ses = b.session ? D.sesById[b.session] : null;
      return `<article class="bt rv" id="${b.id}">
        <header class="bt-h"><p class="bt-no">Hlášení č. ${String(i + 1).padStart(2, '0')} · ${esc(b.dr)} DR</p><h3>${esc(b.name)}</h3>
          <p class="bt-m"><span>${esc(b.place)}</span><span>u stolu: ${esc(b.real_label || '—')}</span>${ses ? `<a href="#${ses.id}">v kronice: ${esc(ses.date_label)}</a>` : ''}</p></header>
        ${b.images?.length ? `<figure class="bt-img" data-lb="${esc(largest('ilu/' + b.images[0]))}" data-cap="${esc(b.captions?.[0] || b.name)}"><div class="pic">${img('ilu/' + b.images[0], { alt: b.captions?.[0] || b.name, sizes: '(max-width:900px) 100vw, 1180px' })}</div><figcaption>${esc(b.captions?.[0] || '')}</figcaption></figure>` : ''}
        <div class="bt-body">
          <div class="bt-sum"><h5>Průběh</h5><p>${esc(nb(b.summary))}</p>
          <div class="bt-out"><h5>Výsledek</h5><p>${esc(nb(b.outcome))}</p></div>
          ${wit.length ? `<div class="bt-wit"><h5>Svědectví</h5>${fr.length ? `<p><span class="lbl">Naše strana</span> ${fr.map((w) => `<button class="chip" data-wit="${esc(w.id)}">▶ ${esc(w.jmeno)}</button>`).join(' ')}</p>` : ''}${fo.length ? `<p><span class="lbl foe">Druhá strana</span> ${fo.map((w) => `<button class="chip red" data-wit="${esc(w.id)}">▶ ${esc(w.jmeno)}</button>`).join(' ')}</p>` : ''}</div>` : ''}
          </div>
          <div class="bt-sides">${(b.sides || []).map(side).join('')}</div>
        </div>
      </article>`;
    }).join('')}`;
  el.addEventListener('click', (e) => {
    const a = e.target.closest('.bt-all');
    if (a) { const box = a.previousElementSibling; box.classList.toggle('clip'); a.textContent = box.classList.contains('clip') ? a.textContent.replace('Skrýt', 'Celá soupiska') : a.textContent.replace('Celá soupiska', 'Skrýt'); return; }
    const w = e.target.closest('[data-wit]'); if (w) { window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: w.dataset.wit } })); return; }
    const f = e.target.closest('.bt-img'); if (f) openLightbox([{ src: f.dataset.lb, cap: f.dataset.cap }]);
  });
}

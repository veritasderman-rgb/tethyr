// 7. Alaundovo proroctví: tři kapitoly, verše se odhalují při scrollu, u známých dvojverší „komu patří“.
import { D } from '../lib/data.js';
import { img, small, largest } from '../lib/img.js';
import { $, $$, esc, settleScroll } from '../lib/util.js';
import { openLightbox } from '../lib/lightbox.js';

const NAMES = ['první', 'druhá', 'třetí'];
const ROM = ['I', 'II', 'III'];
// Verše třetí kapitoly, které kronika výslovně označuje za naplněné ve finále 1. 8. 2026: Ho × Yamoh (3-6, 3-7)
// a Elminster × Sar Saratar (3-12). Podle upřesnění autora se ty souboje dohrály v bitvě o Anauroch,
// souběžně s finále na Pyramidě času (vyprávění je v kapitole „Thultanthar a Pyramida času“).
const FIN_CH = 'ch-thultanthar-a-pyramida-casu';
const FUL = { '3-6': 'b-bitva-v-anaurochu', '3-7': 'b-bitva-v-anaurochu', '3-12': 'b-bitva-v-anaurochu' };
const FUL_LABEL = 'Bitva v Anaurochu, 1. 8. 2026';
/** Které kapitoly vyprávění odkazují na který verš (odkazy (p:kapitola-verš) v textech kapitol). */
function refsOf() {
  const m = {};
  for (const [cid, blocks] of Object.entries(D.vypraveni?.chapters || {})) {
    for (const mm of JSON.stringify(blocks).matchAll(/\]\(p:(\d)-(\d+)\)/g)) (m[`${mm[1]}-${mm[2]}`] ||= new Set()).add(cid);
  }
  return m;
}
const chTitle = (id) => D.chById?.[id]?.title || '';
const lines = (v) => v.t.flatMap((l) => String(l).split(/\s*\|\s*/));
function linkRow(key) {
  const refs = [...(refsOf.cache[key] || [])];
  const ful = FUL[key];
  if (!ful && !refs.length) return '';
  const others = ful ? [...new Set([FIN_CH, ...refs])] : refs;
  return `<div class="pr-link">${ful ? `<a class="ful" href="#${ful}">✦ Naplnilo se · ${esc(FUL_LABEL)} ▸</a>` : ''}${!ful ? others.map((c) => `<a href="#${c}">V kronice · ${esc(chTitle(c))} ▸</a>`).join('') : ''}${ful && others.length ? `<span class="ref">Výklad: ${others.map((c) => `<a href="#${c}">${esc(chTitle(c))}</a>`).join(', ')}</span>` : ''}</div>`;
}

export function renderProphecy() {
  const el = $('#proroctvi');
  refsOf.cache = refsOf();
  const P = D.prophecy;
  const known = P.chapters.reduce((n, c) => n + c.verses.filter((v) => v.who).length, 0);
  el.innerHTML = `<header class="sec-head"><p class="kicker">Proroctví</p><h2 id="proroctvi-h">Alaundovo proroctví</h2>
    <p class="lead">${esc(P.intro)}</p><div class="orn">✦</div></header>
    <div class="pr-grid wrap">
      <div class="pr-art" aria-hidden="true">${P.chapters.map((c, i) => `<div class="pr-pic${i === 0 ? ' on' : ''}" data-ch="${i}">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '(max-width:900px) 100vw, 40vw', pos: '50% 30%' })}</div>`).join('')}<div class="pr-art-shade"></div><div class="pr-prog" aria-hidden="true">${ROM.map((r, i) => `<span class="${i === 0 ? 'on' : ''}" data-ch="${i}">${r}</span>`).join('')}</div></div>
      <div class="pr-text">
        <p class="pr-sum"><span><b>Naplnění.</b> Třetí kapitola se podle kroniky naplnila ve finále 1. srpna 2026. Spárované souboje skončily v bitvě o Anauroch, souběžně s finále na Pyramidě času. Verše s doloženým výkladem odkazují na místo, kde se to stalo.</span><a href="#${FIN_CH}">${esc(chTitle(FIN_CH))} ▸</a></p>
        <p class="pr-note ui">U ${known} dvojverší je z her známo, komu patří. Klepněte na <span class="pr-key">✦</span>.</p>
        ${P.chapters.map((c, i) => `<section class="pr-ch" data-ch="${i}" aria-label="Kapitola ${NAMES[i]}">
          <div class="pr-mobpic">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '100vw', pos: '50% 30%' })}</div>
          <p class="pr-rom rv">${ROM[i]}</p><h3 class="pr-k rv">Kapitola ${NAMES[i]}</h3>
          <div class="pr-terc rv">${c.tercet.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
          <div class="pr-orn">✦</div>
          ${c.verses.map((v, j) => `<div class="pr-v rv${v.who ? ' known' : ''}${FUL[`${i + 1}-${j}`] ? ' ful' : ''}" id="pv-${i + 1}-${j}">
            <p>${lines(v).map((l, k) => `<span class="vl" style="--l:${k}">${esc(l)}</span>`).join('')}</p>
            ${v.img ? `<button class="pr-thumb" data-lb="${esc(largest('ilu/' + v.img))}" data-cap="${esc(v.cap || '')}" aria-label="Obraz k verši: ${esc(v.cap || '')}"><img src="${small('ilu/' + v.img)}" alt="" loading="lazy" decoding="async"></button>` : ''}
            ${v.who ? `<button class="pr-who" aria-expanded="false" aria-controls="prw-${i}-${j}">✦ <span>Komu patří</span></button><p class="pr-ans" id="prw-${i}-${j}" hidden><b>${esc(v.who)}</b><small>${esc(v.src)}</small></p>` : ''}
            ${linkRow(`${i + 1}-${j}`)}
          </div>`).join('')}
          <div class="pr-orn">✦</div>
        </section>`).join('')}
      </div>
    </div>`;
  el.addEventListener('click', (e) => {
    const w = e.target.closest('.pr-who');
    if (w) { const a = w.nextElementSibling; a.hidden = !a.hidden; w.setAttribute('aria-expanded', !a.hidden); w.classList.toggle('on', !a.hidden); return; }
    const t = e.target.closest('.pr-thumb');
    if (t) openLightbox([{ src: t.dataset.lb, cap: t.dataset.cap }]);
  });
  // odkaz na verš (z vyprávění): doskrolovat, zvýraznit, případně otevřít výklad
  window.addEventListener('prophecy:verse', (e) => {
    const v = document.getElementById(e.detail.id); if (!v) return;
    v.classList.add('in', 'hit');
    const w = $('.pr-who', v); if (w && w.getAttribute('aria-expanded') !== 'true') w.click();
    if (e.detail.scroll !== false) settleScroll(v);
    setTimeout(() => v.classList.remove('hit'), 4200);
  });
  // obraz kapitoly vlevo podle toho, kterou kapitolu čtenář právě čte
  const pics = $$('.pr-pic', el);
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { pics.forEach((p) => p.classList.toggle('on', p.dataset.ch === e.target.dataset.ch)); $$('.pr-prog span', el).forEach((p) => p.classList.toggle('on', p.dataset.ch === e.target.dataset.ch)); }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('.pr-ch', el).forEach((s) => io.observe(s));
  // verš, který čtenář právě čte, se rozsvítí
  const lit = new IntersectionObserver((ents) => { for (const e of ents) e.target.classList.toggle('lit', e.isIntersecting); }, { rootMargin: '-38% 0px -38% 0px' });
  $$('.pr-v', el).forEach((v) => lit.observe(v));
}

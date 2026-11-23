// 7. Alaundovo proroctví: tři kapitoly, verše se odhalují při scrollu, u známých dvojverší „komu patří“.
import { D } from '../lib/data.js';
import { img, small, largest } from '../lib/img.js';
import { $, $$, esc, settleScroll } from '../lib/util.js';
import { openLightbox } from '../lib/lightbox.js';

const NAMES = ['první', 'druhá', 'třetí'];
const ROM = ['I', 'II', 'III'];

export function renderProphecy() {
  const el = $('#proroctvi');
  const P = D.prophecy;
  const known = P.chapters.reduce((n, c) => n + c.verses.filter((v) => v.who).length, 0);
  el.innerHTML = `<header class="sec-head"><p class="kicker">Proroctví</p><h2 id="proroctvi-h">Alaundovo proroctví</h2>
    <p class="lead">${esc(P.intro)}</p><div class="orn">✦</div></header>
    <div class="pr-grid wrap">
      <div class="pr-art" aria-hidden="true">${P.chapters.map((c, i) => `<div class="pr-pic${i === 0 ? ' on' : ''}" data-ch="${i}">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '(max-width:900px) 100vw, 40vw', pos: '50% 30%' })}</div>`).join('')}<div class="pr-art-shade"></div></div>
      <div class="pr-text">
        <p class="pr-note ui">U ${known} dvojverší je z her známo, komu patří. Klepněte na <span class="pr-key">✦</span>.</p>
        ${P.chapters.map((c, i) => `<section class="pr-ch" data-ch="${i}" aria-label="Kapitola ${NAMES[i]}">
          <div class="pr-mobpic">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '100vw', pos: '50% 30%' })}</div>
          <p class="pr-rom rv">${ROM[i]}</p><h3 class="pr-k rv">Kapitola ${NAMES[i]}</h3>
          <div class="pr-terc rv">${c.tercet.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
          <div class="pr-orn">✦</div>
          ${c.verses.map((v, j) => `<div class="pr-v rv${v.who ? ' known' : ''}" id="pv-${i + 1}-${j}">
            <p>${v.t.map(esc).join('<br>')}</p>
            ${v.img ? `<button class="pr-thumb" data-lb="${esc(largest('ilu/' + v.img))}" data-cap="${esc(v.cap || '')}" aria-label="Obraz k verši: ${esc(v.cap || '')}"><img src="${small('ilu/' + v.img)}" alt="" loading="lazy" decoding="async"></button>` : ''}
            ${v.who ? `<button class="pr-who" aria-expanded="false" aria-controls="prw-${i}-${j}">✦ <span>Komu patří</span></button><p class="pr-ans" id="prw-${i}-${j}" hidden><b>${esc(v.who)}</b><small>${esc(v.src)}</small></p>` : ''}
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
    for (const e of ents) if (e.isIntersecting) pics.forEach((p) => p.classList.toggle('on', p.dataset.ch === e.target.dataset.ch));
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('.pr-ch', el).forEach((s) => io.observe(s));
}

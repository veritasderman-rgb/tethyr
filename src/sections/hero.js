// 1. Úvod: filmový nástup, pomalu se hýbající malba, počítadla.
import { D } from '../lib/data.js';
import { img } from '../lib/img.js';
import { $, $$, esc, reduced, fmt } from '../lib/util.js';
import { ash } from '../lib/ash.js';
import { emit } from '../lib/sections.js';

export function renderHero() {
  const st = D.stats;
  const stats = [
    [st.sessions, 'sezení v kronice'],
    [23, 'let u stolu'],
    [13, 'let ve hře'],
    [st.pcs, 'hráčských postav'],
    [st.battles, 'bitev'],
    [st.npcs, 'vedlejších postav'],
  ];
  let pos = null;
  try { pos = JSON.parse(localStorage.getItem('zd-cteni') || 'null'); } catch { pos = null; }
  const el = $('#uvod');
  el.innerHTML = `
    <div class="hero-bg">${img('ilu/D_01', { alt: 'Čtyři postavy na útesu nad mořem, nad nimi draci a pevnost v dálce.', eager: true, pos: '50% 24%', cls: 'kb' })}</div>
    <div class="hero-shade"></div>
    <div class="hero-in">
      <p class="hero-k rv">Kronika Tethyrské královské družiny</p>
      <h1 class="hero-t rv d1"><span>Západní</span> <span>draci</span></h1>
      <p class="hero-y rv d2"><b>1372–1385</b> letopočtu Údolí <i>·</i> u stolu <b>2003–2026</b></p>
      <p class="hero-p rv d2">Třiadvacet let jedné kampaně ve Forgotten Realms. Od garáže v Lázních Kynžvartě po poslední souboj na vrcholu Pyramidy času. Vyprávějí ti, kdo u toho byli, přátelé i nepřátelé.</p>
      <div class="hero-cta rv d3"><a class="btn red" href="#pribeh">Vstoupit do příběhu</a><button class="btn" type="button" data-film>▶ Dokument · 15 min</button><a class="btn ghost" href="#svedectvi" data-doc>Svědectví ▸</a></div>
      <p class="hero-more rv d3"><a href="#mapa3d">3D mapa Faerûnu</a><i>·</i><a href="#hymna">Hymna družiny</a><i>·</i><a href="#podekovani">Poděkování</a></p>
      ${pos?.ch && pos.n > 1 ? `<p class="hero-cont rv d3"><a href="#${esc(pos.ch)}">Pokračovat ve čtení · kapitola ${+pos.n}: ${esc(pos.title || '')} ▸</a></p>` : ''}
    </div>
    <dl class="hero-stats">${stats.map(([n, l], i) => `<div class="rv d${i % 3}"><dt data-n="${n}">${reduced() ? fmt(n) : '0'}</dt><dd>${l}</dd></div>`).join('')}</dl>
    <a class="hero-down" href="#pribeh" aria-label="Dolů na příběh"><span></span></a>`;
  ash(el, { count: 54 });
  $('[data-doc]', el).addEventListener('click', () => setTimeout(() => emit('witness:focus'), 600));
  // počítadla
  if (!reduced()) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      $$('dt[data-n]', el).forEach((dt, i) => {
        const n = +dt.dataset.n; const t0 = performance.now() + i * 120; const dur = 1600 + Math.min(1400, n * 2);
        const step = (t) => {
          const k = Math.min(1, Math.max(0, (t - t0) / dur)); const v = Math.round(n * (1 - Math.pow(1 - k, 3)));
          dt.textContent = fmt(v); if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.3 });
    io.observe($('.hero-stats', el));
  }
}

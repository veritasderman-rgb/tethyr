// 1. Úvod: filmový nástup, pomalu se hýbající malba, počítadla.
import { D } from '../lib/data.js';
import { img } from '../lib/img.js';
import { $, $$, reduced, fmt } from '../lib/util.js';
import { ash } from '../lib/ash.js';

export function renderHero() {
  const S = D.sessions.filter((s) => s.title && !/zkouška|test|schůzka|administrativa|setkání nad hrou/i.test(s.title));
  const pcs = D.characters.filter((c) => c.kind === 'hrac');
  const stats = [
    [D.sessions.length, 'sezení v kronice'],
    [23, 'let u stolu'],
    [13, 'let ve hře'],
    [pcs.length, 'hráčských postav'],
    [D.world.battles.length, 'bitev'],
    [D.npcs.length, 'vedlejších postav'],
  ];
  const el = $('#uvod');
  el.innerHTML = `
    <div class="hero-bg">${img('ilu/D_01', { alt: 'Čtyři postavy na útesu nad mořem, nad nimi draci a pevnost v dálce.', eager: true, pos: '50% 24%', cls: 'kb' })}</div>
    <div class="hero-shade"></div>
    <div class="hero-in">
      <p class="hero-k rv">Kronika Tethyrské královské družiny</p>
      <h1 class="hero-t rv d1"><span>Západní</span> <span>draci</span></h1>
      <p class="hero-y rv d2"><b>1372–1385</b> letopočtu Údolí <i>·</i> u stolu <b>2003–2026</b></p>
      <p class="hero-p rv d2">Třiadvacet let jedné kampaně ve Forgotten Realms. Od garáže v Lázních Kynžvartě po poslední souboj na vrcholu Pyramidy času. Vyprávějí ti, kdo u toho byli, přátelé i nepřátelé.</p>
      <div class="hero-cta rv d3"><a class="btn red" href="#pribeh">Vstoupit do příběhu</a><a class="btn" href="#svedectvi" data-doc>Svědectví ▸</a></div>
    </div>
    <dl class="hero-stats">${stats.map(([n, l], i) => `<div class="rv d${i % 3}"><dt data-n="${n}">${reduced() ? fmt(n) : '0'}</dt><dd>${l}</dd></div>`).join('')}</dl>
    <a class="hero-down" href="#pribeh" aria-label="Dolů na příběh"><span></span></a>`;
  ash(el, { count: 54 });
  $('[data-doc]', el).addEventListener('click', () => setTimeout(() => window.dispatchEvent(new CustomEvent('witness:focus')), 600));
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
  void S;
}

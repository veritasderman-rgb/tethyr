// 1. Úvod: filmový nástup (titul po písmenech, léta 2003–2026 jako kreslená linka), malba s paralaxou
// (scroll + myš), mlha, paprsek světla, jiskry a prach, pět jasných vstupů do kroniky, počítadla.
import { D } from '../lib/data.js';
import { img } from '../lib/img.js';
import { $, $$, esc, reduced, fmt } from '../lib/util.js';
import { ash } from '../lib/ash.js';
import { emit } from '../lib/sections.js';

const letters = (w, from) => [...w].map((c, i) => `<i style="--i:${from + i}">${esc(c)}</i>`).join('');

function parallax(el) {
  if (reduced()) return;
  const bg = $('.hero-bg', el), mist = $$('.hero-mist', el), ray = $('.hero-ray', el), inn = $('.hero-in', el);
  let mx = 0, my = 0, tx = 0, ty = 0, sy = 0, run = false, raf = 0;
  const tick = () => {
    mx += (tx - mx) * 0.06; my += (ty - my) * 0.06;
    bg.style.transform = `translate3d(${(-mx * 16).toFixed(2)}px, ${(-my * 9 + sy * 0.26).toFixed(2)}px, 0) scale(1.07)`;
    mist[0] && (mist[0].style.transform = `translate3d(${(mx * 30).toFixed(1)}px, ${(sy * 0.12).toFixed(1)}px, 0)`);
    mist[1] && (mist[1].style.transform = `translate3d(${(-mx * 46).toFixed(1)}px, ${(sy * 0.4).toFixed(1)}px, 0)`);
    ray && (ray.style.transform = `translate3d(${(mx * 12).toFixed(1)}px, ${(sy * 0.08).toFixed(1)}px, 0)`);
    inn.style.transform = `translate3d(0, ${(sy * -0.06).toFixed(1)}px, 0)`;
    inn.style.opacity = String(Math.max(0, 1 - sy / (innerHeight * 0.9)).toFixed(3));
    if (run) raf = requestAnimationFrame(tick);
  };
  addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; tx = e.clientX / innerWidth * 2 - 1; ty = e.clientY / innerHeight * 2 - 1; }, { passive: true });
  addEventListener('scroll', () => { sy = Math.min(scrollY, innerHeight * 1.2); }, { passive: true });
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !run) { run = true; raf = requestAnimationFrame(tick); } else if (!e.isIntersecting && run) { run = false; cancelAnimationFrame(raf); }
  }).observe(el);
}

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
  let seen = false;
  try { seen = sessionStorage.getItem('zd-intro') === '1'; sessionStorage.setItem('zd-intro', '1'); } catch { /* bez úložiště */ }
  const el = $('#uvod');
  el.classList.add(seen ? 'quick' : 'cine');
  const ticks = Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"${[0, 7, 17, 23].includes(i) ? ' class="big"' : ''}></i>`).join('');
  const door = (href, ico, t, s, extra = '') => `<a class="door${extra}" href="${href}"><svg viewBox="0 0 24 24" aria-hidden="true">${ico}</svg><b>${t}</b><span>${s}</span></a>`;
  el.innerHTML = `
    <div class="hero-bg">${img('ilu/D_01', { alt: 'Čtyři postavy na útesu nad mořem, nad nimi draci a pevnost v dálce.', eager: true, pos: '50% 24%', cls: 'kb' })}</div>
    <div class="hero-ray" aria-hidden="true"></div>
    <div class="hero-mist a" aria-hidden="true"></div><div class="hero-mist b" aria-hidden="true"></div>
    <div class="hero-shade"></div>
    <div class="hero-in">
      <p class="hero-k"><span>Kronika Tethyrské královské družiny</span></p>
      <h1 class="hero-t" aria-label="Západní draci"><span aria-hidden="true">${letters('Západní', 0)}</span> <span aria-hidden="true">${letters('draci', 8)}</span></h1>
      <p class="hero-y"><b>1372–1385</b> letopočtu Údolí <i>✦</i> u stolu <b>2003–2026</b></p>
      <div class="hero-line" aria-hidden="true"><em>2003</em><div>${ticks}<u></u></div><em>2026</em></div>
      <p class="hero-p">Třiadvacet let jedné kampaně ve Forgotten Realms. Od garáže v Lázních Kynžvartě po poslední souboj na vrcholu Pyramidy času. Vyprávějí ti, kdo u toho byli, přátelé i nepřátelé.</p>
      <nav class="doors" aria-label="Vstupy do kroniky">
        ${door('#pribeh', '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"/>', 'Číst příběh', 'pět knih, 36 kapitol', ' primary')}
        <button class="door" type="button" data-film><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg><b>Pustit dokument</b><span>film, asi 15 minut</span></button>
        ${door('#mapa', '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>', 'Mapa', 'trasa družiny, 3D Faerûn')}
        ${door('#svedectvi', '<circle cx="12" cy="9" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>', 'Svědectví', 'hlasy přátel i nepřátel')}
        ${door('#hymna', '<path d="M9 18V6l10-2v12"/><circle cx="7" cy="18" r="2.5"/><circle cx="17" cy="16" r="2.5"/>', 'Hymna', 'Rauko, videoklip')}
      </nav>
      <p class="hero-more"><a href="#mapa3d">3D mapa Faerûnu</a><i>✦</i><a href="#podekovani">Poděkování Pánu jeskyně</a>${pos?.ch && pos.n > 1 ? `<i>✦</i><a href="#${esc(pos.ch)}">Pokračovat: kapitola ${+pos.n}, ${esc(pos.title || '')}</a>` : ''}</p>
    </div>
    <dl class="hero-stats">${stats.map(([n, l]) => `<div><dt data-n="${n}">${reduced() ? fmt(n) : '0'}</dt><dd>${l}</dd></div>`).join('')}</dl>
    <a class="hero-down" href="#pribeh" aria-label="Dolů na příběh"><span></span></a>`;
  ash(el, { count: 46, sparks: 16, dust: 22 });
  parallax(el);
  // počítadla spustit, až doběhne nástup
  if (!reduced()) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      $$('dt[data-n]', el).forEach((dt, i) => {
        const n = +dt.dataset.n; const t0 = performance.now() + (seen ? 200 : 3200) + i * 110; const dur = 1500 + Math.min(1200, n * 2);
        const step = (t) => {
          const k = Math.min(1, Math.max(0, (t - t0) / dur)); const v = Math.round(n * (1 - Math.pow(1 - k, 3)));
          dt.textContent = fmt(v); if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.2 });
    io.observe($('.hero-stats', el));
  }
  // svědectví: po doskrolování zaostřit přehrávač
  $('.door[href="#svedectvi"]', el).addEventListener('click', () => setTimeout(() => emit('witness:focus'), 600));
}

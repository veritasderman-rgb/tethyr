import '@fontsource/crimson-text/latin-400.css';
import '@fontsource/crimson-text/latin-ext-400.css';
import '@fontsource/crimson-text/latin-400-italic.css';
import '@fontsource/crimson-text/latin-ext-400-italic.css';
import '@fontsource/crimson-text/latin-600.css';
import '@fontsource/crimson-text/latin-ext-600.css';
import '@fontsource/cardo/latin-400.css';
import '@fontsource/cardo/latin-ext-400.css';
import '@fontsource/cardo/latin-400-italic.css';
import '@fontsource/cardo/latin-ext-400-italic.css';
import '@fontsource/cinzel/latin-400.css';
import '@fontsource/cinzel/latin-ext-400.css';
import '@fontsource/cinzel/latin-600.css';
import '@fontsource/cinzel/latin-ext-600.css';
import '@fontsource/fira-sans/latin-400.css';
import '@fontsource/fira-sans/latin-ext-400.css';
import '@fontsource/fira-sans/latin-500.css';
import '@fontsource/fira-sans/latin-ext-500.css';
import 'leaflet/dist/leaflet.css';
import './styles/base.css';
import './styles/sections.css';

import { loadAll } from './lib/data.js';
import { observe, parallax } from './lib/reveal.js';
import { $, $$, settleScroll } from './lib/util.js';
import { renderHero } from './sections/hero.js';
import { renderStory } from './sections/story.js';
import { renderMap } from './sections/map.js';
import { renderWitness } from './sections/witness.js';
import { renderParty } from './sections/party.js';
import { renderBattles } from './sections/battles.js';
import { renderProphecy } from './sections/prophecy.js';
import { renderTimeline } from './sections/timeline.js';
import { renderRegistry } from './sections/registry.js';
import { renderTable } from './sections/table.js';
import { renderHymna } from './sections/hymna.js';
import { renderPodekovani } from './sections/podekovani.js';

function nav() {
  const bar = $('#topbar');
  const btn = $('#menuBtn');
  const menu = $('#mainNav');
  btn.addEventListener('click', () => {
    const o = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', o); menu.classList.toggle('open', o);
  });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) { btn.setAttribute('aria-expanded', 'false'); menu.classList.remove('open'); } });
  const onScroll = () => bar.classList.toggle('solid', window.scrollY > window.innerHeight * 0.6);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  // zvýraznění aktivního oddílu
  const links = $$('a', menu);
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
  }, { rootMargin: '-45% 0px -50% 0px' });
  $$('main > section').forEach((s) => io.observe(s));
}

async function boot() {
  nav();
  try {
    await loadAll();
  } catch (e) {
    $('#loading span').textContent = 'Data se nepodařilo načíst. Spusťte nejdřív npm run data.';
    console.error(e); return;
  }
  const parts = [renderHero, renderStory, renderMap, renderWitness, renderParty, renderBattles, renderProphecy, renderTimeline, renderRegistry, renderTable, renderHymna, renderPodekovani];
  for (const fn of parts) {
    try { fn(); } catch (e) { console.error(fn.name, e); }
  }
  observe(); parallax();
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading')?.remove(), 1200);
  // hluboké odkazy: #svedectvi/<id>, #s-… (sezení), #b-… (bitva), #mapa, #pribeh, #hymna, #podekovani
  route(true);
  window.addEventListener('hashchange', () => route(false));
  // odkazy na oddíly (menu, úvod, patička): po doskrolování dorovnat polohu, lazy obrázky nad cílem ji posouvají
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    const el = id && !id.includes('/') ? document.getElementById(id) : null;
    if (el) settleScroll(el, { now: false, key: () => location.hash === a.getAttribute('href') });
  });
}

/** Přejde na kotvu z adresy. Otevře rozbalené podrobnosti, doskroluje a po načtení obrázků polohu dorovná. */
function route(first) {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return;
  const [sec, sub] = hash.split('/');
  if (sec === 'svedectvi' && sub) {
    window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: sub, autoplay: false } }));
    return;
  }
  const el = document.getElementById(sec);
  if (!el) return;
  if (!first && !/^(s|b)-/.test(sec)) return; // běžné kotvy oddílů vyřídí prohlížeč
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
  settleScroll(el, { key: () => decodeURIComponent(location.hash.slice(1)).split('/')[0] === sec });
}
boot();

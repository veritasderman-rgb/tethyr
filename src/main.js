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
import { $, $$ } from './lib/util.js';
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
  const parts = [renderHero, renderStory, renderMap, renderWitness, renderParty, renderBattles, renderProphecy, renderTimeline, renderRegistry, renderTable];
  for (const fn of parts) {
    try { fn(); } catch (e) { console.error(fn.name, e); }
  }
  observe(); parallax();
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading')?.remove(), 1200);
  // hluboký odkaz (#svedectvi/rauko, #s-2013-08-16 …)
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash) {
    const [sec, sub] = hash.split('/');
    if (sec === 'svedectvi' && sub) window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: sub } }));
    else requestAnimationFrame(() => document.getElementById(sec)?.scrollIntoView());
  }
}
boot();

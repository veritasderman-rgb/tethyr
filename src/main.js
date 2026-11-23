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

import { need } from './lib/data.js';
import { register, ensure, sections, emit } from './lib/sections.js';
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

// Oddíly a data, která potřebují (načítají se až při přiblížení k oddílu).
register('uvod', renderHero, ['images', 'stats']);
register('pribeh', renderStory, ['images', 'books', 'sessions', 'svedectvi', 'world', 'map', 'vypraveni']);
register('mapa', renderMap, ['images', 'map', 'sessions', 'npcs']);
register('svedectvi', renderWitness, ['images', 'svedectvi', 'books', 'map', 'sessions', 'world']);
register('druzina', renderParty, ['images', 'characters', 'sessions', 'svedectvi']);
register('bitvy', renderBattles, ['images', 'world', 'sessions', 'svedectvi']);
register('proroctvi', renderProphecy, ['images', 'prophecy']);
register('osa', renderTimeline, ['images', 'timeline', 'characters']);
register('rejstrik', renderRegistry, ['npcs', 'sessions']);
register('stul', renderTable, ['images', 'gallery', 'sessions']);
register('hymna', renderHymna, ['images']);
register('podekovani', renderPodekovani, ['images']);

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

// kotva → oddíl, ve kterém leží
function sectionOf(hash) {
  const [sec] = hash.split('/');
  if (/^(s|ch|kniha)-/.test(sec)) return 'pribeh';
  if (/^b-/.test(sec)) return 'bitvy';
  if (/^pv-/.test(sec)) return 'proroctvi';
  if (sec === 'mapa3d') return 'mapa';
  return sec;
}

async function boot() {
  nav();
  try {
    await need('images', 'stats');
    await ensure('uvod');
  } catch (e) {
    $('#loading span').textContent = 'Data se nepodařilo načíst. Spusťte nejdřív npm run data.';
    console.error(e); return;
  }
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading')?.remove(), 1200);
  // ostatní oddíly: vykreslit, když se k nim čtenář přiblíží (zhruba dvě obrazovky předem)
  // příběh se čte hned po úvodu: vykreslí se hned, ostatní oddíly až při přiblížení
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { io.unobserve(e.target); ensure(e.target.id); }
  }, { rootMargin: '150% 0px 150% 0px' });
  ensure('pribeh').finally(() => {
    for (const id of sections()) if (id !== 'uvod' && id !== 'pribeh') io.observe(document.getElementById(id));
  });
  // hluboké odkazy: #svedectvi/<id>, #s-… (sezení), #ch-… (kapitola), #b-… (bitva), #pv-… (verš), #mapa, #hymna…
  route(true);
  window.addEventListener('hashchange', () => route(false));
  // odkazy na oddíly (menu, úvod, patička): vykreslit cíl a po doskrolování dorovnat polohu
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented) return;
    const a = e.target.closest('a[href^="#"]'); if (!a) return;
    const id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id || id.includes('/')) return;
    ensure(sectionOf(id)).then(() => {
      const el = document.getElementById(id);
      if (el) settleScroll(el, { now: true, key: () => location.hash === a.getAttribute('href') });
    });
  });
}

/** Přejde na kotvu z adresy. Vykreslí oddíl, otevře rozbalené podrobnosti, doskroluje a polohu dorovná. */
async function route(first) {
  const hash = decodeURIComponent(location.hash.slice(1));
  if (!hash) return;
  const [sec, sub] = hash.split('/');
  if (sec === 'svedectvi' && sub) {
    emit('witness:open', { id: sub, autoplay: false });
    return;
  }
  const owner = sectionOf(hash);
  await ensure(owner);
  const el = document.getElementById(sec);
  if (!el) return;
  if (!first && !/^(s|b|ch|pv)-/.test(sec)) return; // běžné kotvy oddílů vyřídí odkaz výše
  for (let d = el.closest('details'); d; d = d.parentElement?.closest('details')) d.open = true;
  if (/^pv-/.test(sec)) emit('prophecy:verse', { id: sec, scroll: false });
  settleScroll(el, { key: () => decodeURIComponent(location.hash.slice(1)).split('/')[0] === sec });
}
boot();

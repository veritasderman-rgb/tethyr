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
import './styles/base.css';
import './styles/sections.css';
import './styles/system.css';
import './styles/scenes.css';
import './styles/it7.css';
import './styles/it8.css';

import { need } from './lib/data.js';
import { register } from './lib/sections.js';
import { startRouter } from './lib/router.js';
import { $ } from './lib/util.js';
import { initMenu } from './lib/menu.js';
import { initSearch } from './lib/search.js';
import { initHoverCards } from './lib/hovercard.js';
import { filmHooks, pfilmHooks } from './lib/filmhook.js';
import './lib/audio.js';
import './lib/stale.js';
import { closeDrawer, close as closeLightbox } from './lib/lightbox.js';

// Stránky: kód (dynamický import) a data, která potřebují. Načítají se až při prvním vstupu na stránku.
const S = (load, fn) => () => load().then((m) => ({ ...m, render: m[fn] }));
register('uvod', S(() => import('./sections/hero.js'), 'renderHero'), ['images', 'stats']);
register('pribeh', S(() => import('./sections/story.js'), 'renderStory'), ['images', 'books', 'sessions', 'svedectvi', 'world', 'map', 'vypraveni']);
register('mapa', S(() => import('./sections/map.js'), 'renderMap'), ['images', 'map', 'sessions', 'npcs', 'books', 'svedectvi', 'world']);
register('m3d', S(() => import('./sections/map3d.js'), 'renderMap3d'), []);
register('svedectvi', S(() => import('./sections/witness.js'), 'renderWitness'), ['images', 'svedectvi', 'books', 'map', 'sessions', 'world']);
register('druzina', S(() => import('./sections/party.js'), 'renderParty'), ['images', 'characters', 'sessions', 'svedectvi']);
register('bitvy', S(() => import('./sections/battles.js'), 'renderBattles'), ['images', 'world', 'sessions', 'svedectvi', 'map']);
register('proroctvi', S(() => import('./sections/prophecy.js'), 'renderProphecy'), ['images', 'prophecy', 'proroctvi-audio', 'books', 'vypraveni']);
register('osa', S(() => import('./sections/timeline.js'), 'renderTimeline'), ['images', 'timeline', 'characters']);
register('lexikon', S(() => import('./sections/lexikon.js'), 'renderLexikon'), ['lexikon', 'sessions', 'images']);
register('stul', S(() => import('./sections/table.js'), 'renderTable'), ['images', 'gallery', 'sessions']);
register('hymna', S(() => import('./sections/hymna.js'), 'renderHymna'), ['images']);
register('podekovani', S(() => import('./sections/podekovani.js'), 'renderPodekovani'), ['images']);

async function boot() {
  initMenu(); initSearch(); initHoverCards();
  const bar = $('#topbar');
  const onScroll = () => bar.classList.toggle('solid', window.scrollY > 40 || document.body.dataset.page !== 'uvod');
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('page:change', onScroll);
  // přechod na jinou adresu zavře šuplík a lightbox (otevřené z předchozí stránky)
  let lastPath = location.pathname;
  window.addEventListener('route', () => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    if (!document.getElementById('drawer').hidden) closeDrawer();
    if (!document.getElementById('lightbox').hidden) closeLightbox();
  });
  try {
    // books.json je malý a router z něj skládá adresy kapitol a sezení (i ze starých kotev)
    await need('images', 'books');
  } catch (e) {
    $('#loading span').textContent = 'Data se nepodařilo načíst. Zkuste stránku obnovit.';
    console.error(e); return;
  }
  await startRouter({ film: filmHooks, pfilm: pfilmHooks });
  onScroll();
  $('#loading').classList.add('done');
  setTimeout(() => $('#loading')?.remove(), 1200);
}
boot();

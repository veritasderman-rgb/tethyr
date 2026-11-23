// /mapa/3d: 3D mapa Faerûnu jako vlastní stránka. Samotná mapa je samostatná aplikace v public/mapa3d/
// (na celou obrazovku, nebo vložená sem v iframu). Iframe se načte až po klepnutí a při odchodu ze stránky
// se zase odstraní (WebGL by jinak běžel na pozadí).
import { $ } from '../lib/util.js';

const POSTER = '<img src="img/misc/mapa3d-poster.webp" alt="Náhled 3D mapy Faerûnu a Kara-Turu s místy kampaně" loading="lazy" decoding="async" width="1400" height="875">';

export function renderMap3d() {
  const el = $('#m3d');
  el.innerHTML = `<header class="sec-head"><p class="kicker">Mapa · 3D</p><h1 id="m3d-h" tabindex="-1">Faerûn ve třech rozměrech</h1>
    <p class="lead">Faerûn a Kara-Tur z výšky: hory, lesy a moře podle mapy, města a hrady z modelů, létající Thultanthar nad Anaurochem, deset sfér nad Bezstopým mořem, bitvy s vojsky a přelet tažením, kde kamera projde kapitolu po kapitole s titulky.</p><div class="orn">✦</div></header>
    <div class="m3d wrap">
      <div class="m3d-in live">
        <div class="m3d-view" id="m3dView" role="button" tabindex="0" aria-label="Načíst 3D mapu sem">${POSTER}</div>
        <div class="m3d-b"><button class="btn red" id="m3dLoad" type="button" aria-controls="m3dView">▶ Načíst 3D mapu sem</button><a class="btn" href="mapa3d/index.html" target="_blank" rel="noopener">⤢ Na celou obrazovku (nové okno)</a><a class="btn" href="/mapa">2D mapa tažení</a></div>
        <p class="small" id="m3dNote">Načítá se až po klepnutí (asi 4 MB a další modely podle přiblížení). Na telefonu se zapne lehčí kvalita, zvuk a hlasy jen po klepnutí. Odkazy z 3D mapy vedou zpět do kroniky.</p>
      </div>
    </div>`;
  const view = $('#m3dView', el);
  const load = () => {
    if (view.classList.contains('live')) return;
    view.innerHTML = '<iframe id="m3dFrame" src="mapa3d/index.html?embed=1" title="3D mapa Faerûnu" allow="fullscreen; autoplay" allowfullscreen></iframe>';
    view.classList.add('live'); view.removeAttribute('role'); view.removeAttribute('tabindex'); view.removeAttribute('aria-label');
    $('#m3dLoad', el).hidden = true;
  };
  $('#m3dLoad', el).addEventListener('click', load);
  view.addEventListener('click', load);
  view.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); load(); } });
}

/** Odchod ze stránky: vyložit iframe a vrátit náhled. */
export function leave() {
  const view = $('#m3dView');
  if (!view?.classList.contains('live')) return;
  view.classList.remove('live');
  view.innerHTML = POSTER;
  view.setAttribute('role', 'button'); view.setAttribute('tabindex', '0'); view.setAttribute('aria-label', 'Načíst 3D mapu sem');
  const b = $('#m3dLoad'); if (b) b.hidden = false;
}

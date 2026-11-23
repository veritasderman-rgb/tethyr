// 3. Mapa Torilu: pan/zoom, místa, animovaná trasa družiny po knihách, detail místa.
import L from 'leaflet';
import { D } from '../lib/data.js';
import { $, $$, esc, reduced, ROMAN } from '../lib/util.js';

const W = 2576, H = 884;
const ERA_COL = { I: '#c9a54a', II: '#d0573f', III: '#7fa37a', IV: '#6f9ccf', V: '#d7c49a', epilog: '#eadfc6' };
const ERA_NAME = { I: 'Kniha první', II: 'Kniha druhá', III: 'Kniha třetí', IV: 'Kniha čtvrtá', V: 'Kniha pátá', epilog: 'Epilog' };
const ll = (x, y) => [-y, x];

export function renderMap() {
  const el = $('#mapa');
  el.innerHTML = `<header class="sec-head"><p class="kicker">Mapa</p><h2 id="mapa-h">Cesta po Torilu</h2>
    <p class="lead">Kudy družina šla, kniha po knize. Trasu lze přehrát nebo krokovat, místo na mapě otevře, co se tam stalo a kdo tam žije.</p><div class="orn">✦</div></header>
    <div class="m3d wrap" id="mapa3d">
      <div class="m3d-in">
        <div class="m3d-txt">
          <p class="m3d-k">Nové</p>
          <h3>3D mapa Faerûnu</h3>
          <p>Faerûn a Kara-Tur z výšky: moře, hory a lesy podle mapy, 66 míst kampaně, deset sfér nad Bezstopým mořem, 14 bitev s vojsky a výprava družiny, kterou kamera projde zastávku po zastávce (105 zastávek). Klik na místo otevře sezení, bitvu nebo svědectví v kronice.</p>
          <div class="m3d-b"><a class="btn red" href="mapa3d/index.html" target="_blank" rel="noopener">⤢ Otevřít 3D mapu na celou obrazovku</a><button class="btn" id="m3dLoad" aria-controls="m3dFrame">Zobrazit náhled zde</button></div>
          <p class="small">Mapa je těžší na grafiku; na telefonu se přepne na lehčí kvalitu. Zvuk a hlasy se spouštějí až klepnutím.</p>
        </div>
        <div class="m3d-view" id="m3dView">
          <img src="img/misc/mapa3d-poster.webp" alt="Náhled 3D mapy Faerûnu a Kara-Turu s místy kampaně" loading="lazy" decoding="async" width="1400" height="875">
        </div>
      </div>
    </div>
    <div class="map-ui wrap">
      <div class="map-ctl" role="group" aria-label="Ovládání trasy">
        <div class="map-eras" role="group" aria-label="Kniha">
          <button class="btn sm" data-era="all" aria-pressed="true">Vše</button>
          ${ROMAN.map((r) => `<button class="btn sm" data-era="${r}" aria-pressed="false" style="--c:${ERA_COL[r]}">${r}</button>`).join('')}
        </div>
        <div class="map-play">
          <button class="btn sm" id="mpPrev" aria-label="Krok zpět">◂</button>
          <button class="btn sm red" id="mpPlay" aria-label="Přehrát trasu">▶ Přehrát</button>
          <button class="btn sm" id="mpNext" aria-label="Krok vpřed">▸</button>
        </div>
        <label class="map-slider"><span class="sr">Posun v čase</span><input type="range" id="mpRange" min="0" value="0" step="1"></label>
      </div>
      <p class="map-step" id="mpStep" aria-live="polite"></p>
      <div class="map-wrap">
        <div id="leaf" class="leaf" aria-label="Interaktivní mapa Torilu"></div>
        <aside class="map-panel" id="mpPanel" aria-live="polite"><p class="mp-empty">Klikněte na místo na mapě.</p></aside>
      </div>
      <div class="map-off"><span>Mimo mapu:</span> ${D.map.off.map((p, i) => `<button class="chip" data-off="${i}">${esc(p.name)}</button>`).join(' ')}</div>
    </div>`;

  // 3D mapa: iframe se načte až po kliknutí
  $('#m3dLoad', el).addEventListener('click', (e) => {
    const view = $('#m3dView', el);
    view.innerHTML = '<iframe id="m3dFrame" src="mapa3d/index.html" title="3D mapa Faerûnu" allow="fullscreen; autoplay" allowfullscreen></iframe>';
    view.classList.add('live'); view.closest('.m3d-in').classList.add('live');
    e.currentTarget.hidden = true;
  });
  $('#m3dView', el).addEventListener('click', () => { if (!$('#m3dView', el).classList.contains('live')) $('#m3dLoad', el).click(); });

  let map, routeLayer, head, markers = {};
  let era = 'all', idx = 0, timer = null;
  const R = D.map.route;
  const visible = () => R.map((r, i) => ({ ...r, i })).filter((r) => r.x != null && (era === 'all' || r.era === era));
  const range = $('#mpRange', el);

  function panel(p) {
    const ses = (p.sessions || []).map((id) => D.sesById[id]).filter(Boolean);
    const npcs = (p.npcs || []).map((i) => D.npcs[i]).filter(Boolean);
    $('#mpPanel', el).innerHTML = `<p class="mp-k">${esc(p.region || '')}${p.kind ? ` · ${esc(p.kind)}` : ''}${p.approx ? ' · poloha odhadem' : ''}</p>
      <h3>${esc(p.name)}</h3><p>${esc(p.desc || '')}</p>
      ${p.visits?.length ? `<h5>Co se tu stalo</h5><ul class="mp-v">${p.visits.map((v) => `<li><b style="color:${ERA_COL[v.era] || '#ccc'}">${esc(v.era || '')}</b> <span>${esc(v.real)} · ${esc(v.dr)} DR</span> ${esc(v.what)}</li>`).join('')}</ul>` : ''}
      ${ses.length ? `<h5>Sezení</h5><ul class="mp-s">${ses.slice(0, 12).map((s) => `<li><a href="#${s.id}">${esc(s.date_label)} · ${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
      ${npcs.length ? `<h5>Kdo tu žije a působí</h5><p class="mp-n">${npcs.slice(0, 24).map((n) => `<a href="#rejstrik" data-npc="${esc(n.name)}" class="${n.kind === 'nepřítel' ? 'foe' : ''}">${esc(n.name)}</a>`).join(', ')}${npcs.length > 24 ? ' …' : ''}</p>` : ''}`;
    if (window.matchMedia('(max-width: 900px)').matches) $('#mpPanel', el).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
  }

  function draw(animate = false) {
    if (!map) return;
    const pts = visible();
    range.max = Math.max(0, pts.length - 1);
    idx = Math.min(idx, pts.length - 1);
    range.value = idx;
    routeLayer.clearLayers();
    for (let i = 1; i <= idx; i++) {
      const a = pts[i - 1], b = pts[i];
      const line = L.polyline([ll(a.x, a.y), ll(b.x, b.y)], {
        color: ERA_COL[b.era] || '#ddd', weight: 3, opacity: 0.9,
        dashArray: b.walk === false ? '2 8' : null, className: i === idx && animate ? 'route-new' : '',
      });
      routeLayer.addLayer(line);
    }
    const cur = pts[idx];
    if (cur) {
      head.setLatLng(ll(cur.x, cur.y)).addTo(map);
      $('#mpStep', el).innerHTML = `<b style="color:${ERA_COL[cur.era]}">${esc(ERA_NAME[cur.era] || '')}</b> · u stolu ${esc(cur.real)} · ${esc(cur.dr)} DR · <b>${esc(cur.place)}</b> – ${esc(cur.what)}`;
      if (animate && !map.getBounds().pad(-0.15).contains(ll(cur.x, cur.y))) map.panTo(ll(cur.x, cur.y), { animate: !reduced() });
    }
    Object.values(markers).forEach((m) => m.getElement()?.classList.toggle('dim', era !== 'all' && !m._p.visits?.some((v) => v.era === era)));
  }

  function setEra(e) {
    era = e; stop();
    $$('.map-eras button', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.era === e));
    idx = visible().length - 1; draw();
    if (map) {
      const pts = visible();
      if (e === 'all') { const z = Math.min(0, map.getBoundsZoom([[-H, 0], [0, W]], true)); const sz = map.getSize(); const half = (sz.x / 2) / Math.pow(2, z); map.setView(ll(Math.max(half, 640), H / 2), z, { animate: !reduced() }); }
      else if (pts.length) map.fitBounds(L.latLngBounds(pts.map((p) => ll(p.x, p.y))).pad(0.12), { animate: !reduced(), maxZoom: 0.5 });
    }
  }
  function stop() { clearInterval(timer); timer = null; $('#mpPlay', el).textContent = '▶ Přehrát'; }
  function play() {
    if (timer) { stop(); return; }
    if (idx >= visible().length - 1) idx = 0;
    $('#mpPlay', el).textContent = '❚❚ Pauza';
    timer = setInterval(() => {
      if (idx >= visible().length - 1) { stop(); return; }
      idx++; draw(true);
    }, reduced() ? 1400 : 900);
  }

  function init() {
    map = L.map($('#leaf', el), {
      crs: L.CRS.Simple, minZoom: -2.2, maxZoom: 1.5, zoomSnap: 0.25, zoomDelta: 0.5,
      maxBounds: [[-H - 200, -300], [200, W + 300]], attributionControl: false, scrollWheelZoom: false,
    });
    const bounds = [[-H, 0], [0, W]];
    L.imageOverlay('img/map/toril-2576.webp', bounds, { alt: 'Mapa Torilu' }).addTo(map);
    map.fitBounds(bounds);
    map.setMinZoom(map.getBoundsZoom(bounds, false) - 0.25);
    window.addEventListener('resize', () => map.setMinZoom(map.getBoundsZoom(bounds, false) - 0.25));
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    routeLayer = L.layerGroup().addTo(map);
    head = L.marker([0, 0], { icon: L.divIcon({ className: 'route-head', iconSize: [18, 18] }), interactive: false, keyboard: false });
    for (const p of D.map.places) {
      const m = L.marker(ll(p.x, p.y), {
        icon: L.divIcon({ className: `place${p.approx ? ' approx' : ''}`, html: `<i></i><span>${esc(p.name)}</span>`, iconSize: [14, 14] }),
        title: p.name, alt: p.name, keyboard: true, riseOnHover: true,
      }).addTo(map);
      m._p = p;
      m.on('click', () => panel(p));
      markers[p.name] = m;
    }
    setEra('all');
  }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); init(); } }, { rootMargin: '300px' });
  io.observe($('#leaf', el));

  el.addEventListener('click', (e) => {
    const b = e.target.closest('.map-eras button'); if (b) setEra(b.dataset.era);
    const o = e.target.closest('[data-off]'); if (o) panel(D.map.off[+o.dataset.off]);
    const n = e.target.closest('[data-npc]'); if (n) window.dispatchEvent(new CustomEvent('registry:search', { detail: { q: n.dataset.npc } }));
  });
  $('#mpPlay', el).onclick = play;
  $('#mpPrev', el).onclick = () => { stop(); idx = Math.max(0, idx - 1); draw(true); };
  $('#mpNext', el).onclick = () => { stop(); idx = Math.min(visible().length - 1, idx + 1); draw(true); };
  range.oninput = () => { stop(); idx = +range.value; draw(true); };
  window.addEventListener('map:era', (e) => {
    const go = () => { setEra(e.detail.era); idx = 0; draw(); setTimeout(play, 700); };
    if (map) go(); else setTimeout(go, 900);
  });
}

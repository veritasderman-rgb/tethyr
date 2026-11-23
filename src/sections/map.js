// 3. Mapa Torilu: přehrávání cesty družiny v čase (kapitola po kapitole), karty míst, bitev a sfér,
// filtry knih a vrstev, pohledy Faerûn / Kara-Tur / sféry, shlukování značek a popisky bez překryvu, klávesnice.
import L from 'leaflet';
import { D } from '../lib/data.js';
import { img } from '../lib/img.js';
import 'leaflet/dist/leaflet.css';
import { $, $$, esc, reduced, settleScroll } from '../lib/util.js';
import { emit, H as HREF } from '../lib/router.js';

const W = 2576, H = 884;
const ERAS = ['I', 'II', 'III', 'IV', 'V', 'epilog'];
const ERA_COL = { I: '#c9a54a', II: '#d0573f', III: '#7fa37a', IV: '#6f9ccf', V: '#d7c49a', epilog: '#eadfc6' };
const ERA_NAME = { I: 'Kniha první', II: 'Kniha druhá', III: 'Kniha třetí', IV: 'Kniha čtvrtá', V: 'Kniha pátá', epilog: 'Epilog' };
const ERA_SHORT = { I: 'I', II: 'II', III: 'III', IV: 'IV', V: 'V', epilog: 'Ep.' };
const SPEEDS = [0.5, 1, 2, 4];
const SPH_X = -150; // sloupec sfér západně od mapy (mimo podklad)
const ll = (x, y) => [-y, x];
const VIEWS = {
  all: null,
  faerun: [[-H, -10], [0, 1150]],
  karatur: [[-H, 1300], [0, W]],
  sfery: [[-830, SPH_X - 110], [-40, SPH_X + 230]],
};

export function renderMap() {
  const el = $('#mapa');
  const R = D.map.route;
  const CH = Object.fromEntries(D.books.flatMap((b) => b.chapters.map((c) => [c.id, { ...c, era: b.key, kap: b.kap }])));
  const placeById = Object.fromEntries([...D.map.places, ...D.map.off].map((p) => [p.id, p]));
  const placeByName = Object.fromEntries([...D.map.places, ...D.map.off].map((p) => [p.name, p]));
  const BATT = D.battleById || {};
  const WIT = D.witById || {};
  const stopsAt = {};
  R.forEach((r, i) => { const p = placeByName[r.place]; if (p) (stopsAt[p.id] ||= []).push(i); });

  el.innerHTML = `<header class="sec-head"><p class="kicker">Mapa</p><h1 id="mapa-h" tabindex="-1">Cesta po Torilu</h1>
    <p class="lead">Kudy družina šla, kapitola po kapitole. Přehrajte cestu v čase, nebo klepněte na místo: ukáže, co se tam stalo, která sezení, bitvy a svědci k němu patří.</p><div class="orn">✦</div></header>
    <div class="map-ui wrap" id="mapUi">
      <div class="mu-row">
        <div class="mu-grp" role="group" aria-label="Pohled">
          <span class="mu-l">Pohled</span>
          <button class="btn sm" data-view="all" aria-pressed="false">Celek</button>
          <button class="btn sm" data-view="faerun" aria-pressed="true">Faerûn</button>
          <button class="btn sm" data-view="karatur" aria-pressed="false">Kara-Tur</button>
          <button class="btn sm" data-view="sfery" aria-pressed="false">Sféry</button>
        </div>
        <div class="mu-grp map-eras" role="group" aria-label="Knihy">
          <span class="mu-l">Knihy</span>
          <button class="btn sm" data-era="all" aria-pressed="true">Vše</button>
          ${ERAS.map((r) => `<button class="btn sm" data-era="${r}" aria-pressed="false" style="--c:${ERA_COL[r]}" title="${ERA_NAME[r]}">${ERA_SHORT[r]}</button>`).join('')}
        </div>
        <div class="mu-grp mu-lay" role="group" aria-label="Vrstvy">
          <span class="mu-l">Vrstvy</span>
          <button class="chip" data-lay="route" aria-pressed="true">Trasa</button>
          <button class="chip" data-lay="places" aria-pressed="true">Sídla a místa</button>
          <button class="chip" data-lay="battles" aria-pressed="true">⚔ Bitvy</button>
          <button class="chip" data-lay="spheres" aria-pressed="true">✧ Plány existence</button>
          <button class="chip" data-lay="labels" aria-pressed="true">Popisky</button>
        </div>
      </div>
      <div class="mu-play" role="group" aria-label="Přehrávání cesty">
        <button class="btn sm" id="mpChPrev" title="Předchozí kapitola ( [ )" aria-label="Předchozí kapitola">⏮</button>
        <button class="btn sm" id="mpPrev" title="Krok zpět ( , )" aria-label="Krok zpět">◂</button>
        <button class="btn sm red" id="mpPlay" title="Přehrát / pozastavit (mezerník)">▶ Přehrát</button>
        <button class="btn sm" id="mpNext" title="Krok vpřed ( . )" aria-label="Krok vpřed">▸</button>
        <button class="btn sm" id="mpChNext" title="Další kapitola ( ] )" aria-label="Další kapitola">⏭</button>
        <label class="mu-speed"><span>Rychlost</span><select id="mpSpeed" aria-label="Rychlost přehrávání">${SPEEDS.map((s) => `<option value="${s}"${s === 1 ? ' selected' : ''}>${String(s).replace('.', ',')}×</option>`).join('')}</select></label>
        <button class="btn sm ghost" id="mpScale" title="Přepnout léta u stolu / herní letopočet" aria-label="Přepnout léta u stolu a herní letopočet">u stolu</button>
      </div>
      <div class="mu-time">
        <input type="range" id="mpRange" min="0" max="1000" value="0" step="1" aria-label="Posuvník času – léta tažení">
        <div class="mu-strip" id="mpStrip" aria-hidden="true"></div>
        <div class="mu-years" id="mpYears" aria-hidden="true"></div>
      </div>
      <p class="map-step" id="mpStep" aria-live="polite"></p>
      <div class="map-wrap">
        <div class="leaf-box">
          <div id="leaf" class="leaf" tabindex="0" aria-label="Interaktivní mapa Torilu. Mezerník přehraje cestu, čárka a tečka krokují, hranaté závorky skáčou po kapitolách."></div>
          <div class="map-chap" id="mpChap" aria-hidden="true"></div>
        </div>
        <aside class="map-panel" id="mpPanel" aria-live="polite"><p class="mp-empty">Klepněte na místo, bitvu nebo sféru. Nebo spusťte <b>▶ Přehrát</b> a sledujte cestu družiny od roku 2003.</p></aside>
      </div>
      <p class="map-keys small">Klávesy na mapě: <kbd>mezerník</kbd> přehrát · <kbd>,</kbd> <kbd>.</kbd> krok · <kbd>[</kbd> <kbd>]</kbd> kapitola · <kbd>1</kbd>–<kbd>6</kbd> kniha, <kbd>0</kbd> vše · <kbd>+</kbd> <kbd>−</kbd> přiblížení · <kbd>Esc</kbd> zavřít kartu</p>
    </div>
    <a class="m3d-link wrap" href="/mapa/3d"><img src="img/misc/mapa3d-poster.webp" alt="" loading="lazy" decoding="async" width="1400" height="875"><span><small>Vlastní stránka</small><b>3D mapa Faerûnu</b><i>Hory, města, létající Thultanthar a přelet tažením kapitolu po kapitole</i></span></a>`;

  // ------------------------------------------------------------------ stav
  let map, routeLayer, casingLayer, head, placeLayer, battleLayer, sphereLayer, clusterLayer;
  const markers = {}; // id → {m, p, lab}
  const bmarkers = [];
  let era = 'all', pos = 0, playing = false, speed = 1, scale = 'real', raf = 0, last = 0, hold = 0, curCh = null;
  const lay = { route: true, places: true, battles: true, spheres: true, labels: true };
  let pts = [], segs = [];
  const range = $('#mpRange', el);

  const visible = () => R.map((r, i) => ({ ...r, i })).filter((r) => r.x != null && (era === 'all' || r.era === era));
  // zakřivená spojnice (dlouhé přesuny obloukem, ať se cesty tam a zpět nepřekrývají)
  function curve(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 40) return [ll(a.x, a.y), ll(b.x, b.y)];
    const k = Math.min(0.22, 0.08 + d / 6000), cx = (a.x + b.x) / 2 - dy * k, cy = (a.y + b.y) / 2 + dx * k;
    const n = Math.max(6, Math.min(28, Math.round(d / 40))), out = [];
    for (let j = 0; j <= n; j++) { const t = j / n, u = 1 - t; out.push(ll(u * u * a.x + 2 * u * t * cx + t * t * b.x, u * u * a.y + 2 * u * t * cy + t * t * b.y)); }
    return out;
  }
  const segDur = (s) => Math.min(1.7, Math.max(0.5, s.len / 520));

  function build() {
    pts = visible();
    routeLayer.clearLayers(); casingLayer.clearLayers();
    segs = [];
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1], b = pts[j];
      const ptsL = curve(a, b);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const col = ERA_COL[b.era] || '#ddd';
      const cas = L.polyline([], { color: '#0b0907', weight: 6, opacity: 0.55, interactive: false });
      const line = L.polyline([], { color: col, weight: 3, opacity: 0.95, dashArray: b.walk ? null : '7 6', interactive: false, className: 'rt' });
      segs.push({ a, b, pts: ptsL, len, line, cas, shown: -1 });
    }
    buildTicks();
  }

  // posuvník: poloha 0…N-1 (zastávky), popisky let u stolu nebo DR
  function buildTicks() {
    const n = pts.length;
    range.max = String(Math.max(1, (n - 1) * 100));
    let strip = '', run = 0, cur = null;
    const push = () => { if (cur) strip += `<i style="flex:${run};background:${ERA_COL[cur]}"></i>`; };
    pts.forEach((p) => { if (p.era !== cur) { push(); cur = p.era; run = 0; } run++; }); push();
    $('#mpStrip', el).innerHTML = strip;
    const seen = new Set(); let lastX = -99;
    const gap = (34 / Math.max(200, $('#mpYears', el).offsetWidth || 800)) * 100;
    $('#mpYears', el).innerHTML = pts.map((p, i) => {
      const lab = scale === 'real' ? String(Math.floor(p.k)) : String(p.dr);
      if (seen.has(lab)) return ''; seen.add(lab);
      const x = n > 1 ? (i / (n - 1)) * 100 : 0;
      if (x - lastX < gap) return ''; lastX = x;
      return `<span style="left:${x}%">${lab}</span>`;
    }).join('');
  }

  // vykreslení trasy do polohy pos (desetinné číslo = rozkreslený úsek)
  function render(follow = false) {
    if (!map) return;
    const n = pts.length;
    pos = Math.max(0, Math.min(n - 1, pos));
    const i = Math.floor(pos), f = pos - i;
    segs.forEach((s, j) => {
      // úsek j vede z bodu j do j+1
      let k = j < i ? 1 : j === i ? f : 0;
      if (!lay.route) k = 0;
      if (k <= 0) { if (s.shown !== 0) { routeLayer.removeLayer(s.line); casingLayer.removeLayer(s.cas); s.shown = 0; } return; }
      if (k >= 1) { if (s.shown !== 1) { s.line.setLatLngs(s.pts); s.cas.setLatLngs(s.pts); s.shown = 1; } }
      else {
        const m = (s.pts.length - 1) * k, q = Math.floor(m), r = m - q;
        const a = s.pts[q], b = s.pts[Math.min(q + 1, s.pts.length - 1)];
        const part = s.pts.slice(0, q + 1).concat([[a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]]);
        s.line.setLatLngs(part); s.cas.setLatLngs(part); s.shown = 0.5;
      }
      if (!routeLayer.hasLayer(s.line)) { casingLayer.addLayer(s.cas); routeLayer.addLayer(s.line); }
    });
    // úseky aktuální kapitoly svítí, starší ustoupí do pozadí
    const chNow = (pts[Math.min(n - 1, i + (f > 0 ? 1 : 0))] || {}).ch;
    segs.forEach((s) => { const hi = s.b.ch === chNow; if (s.hi !== hi) { s.hi = hi; s.line.setStyle({ opacity: hi ? 1 : 0.42, weight: hi ? 3.6 : 2.4 }); s.cas.setStyle({ opacity: hi ? 0.6 : 0.25 }); } });
    // hlava trasy (aktuální místo pulzuje)
    let hx, hy;
    if (f > 0 && segs[i]) { const s = segs[i], m = (s.pts.length - 1) * f, q = Math.floor(m), r = m - q, a = s.pts[q], b = s.pts[Math.min(q + 1, s.pts.length - 1)]; hy = a[0] + (b[0] - a[0]) * r; hx = a[1] + (b[1] - a[1]) * r; head.setLatLng([hy, hx]); }
    else if (pts[i]) head.setLatLng(ll(pts[i].x, pts[i].y));
    if (pts[i]) { const e = head.getElement(); if (e) e.style.setProperty('--c', ERA_COL[(f > 0.5 && pts[i + 1] ? pts[i + 1] : pts[i]).era]); if (!map.hasLayer(head)) head.addTo(map); }
    range.value = String(Math.round(pos * 100));
    const cur = pts[Math.round(pos)] || pts[i];
    if (cur) caption(cur);
    if (follow && cur) {
      const c = head.getLatLng();
      if (!map.getBounds().pad(-0.18).contains(c)) map.panTo(c, { animate: !reduced(), duration: 0.6 });
    }
    // aktuální místo zvýrazněné
    const cp = cur && placeByName[cur.place];
    Object.values(markers).forEach((o) => o.m.getElement()?.classList.toggle('cur', !!cp && o.p.id === cp.id));
  }

  function chLink(chId, cls = '') {
    const c = CH[chId]; if (!c) return '';
    return `<a class="${cls}" href="${HREF(`#${esc(chId)}`)}" title="Kapitola v Příběhu">${esc(c.title)}</a>`;
  }
  function caption(s) {
    const ses = (s.s || []).map((id) => D.sesById[id]).filter(Boolean);
    $('#mpStep', el).innerHTML = `<b style="color:${ERA_COL[s.era]}">${esc(ERA_NAME[s.era] || '')}</b>${s.ch ? ` · kapitola ${chLink(s.ch)}` : ''} · u stolu ${esc(s.real)} · ${esc(s.dr)} DR<br><b class="ms-pl">${esc(s.place)}</b> – ${esc(s.what)}${ses.length ? ` <span class="ms-s">· sezení ${ses.slice(0, 3).map((x) => `<a href="${HREF(`#${x.id}`)}">${esc(x.date_label)}</a>`).join(', ')}</span>` : ''}`;
    if (s.ch !== curCh) { const prev = curCh; curCh = s.ch; if (prev !== null || playing) chapterTitle(s); }
  }
  let chTimer = 0;
  function chapterTitle(s) {
    const c = CH[s.ch]; const box = $('#mpChap', el);
    if (!c) return;
    box.style.setProperty('--c', ERA_COL[s.era]);
    box.innerHTML = `<p>${esc(ERA_NAME[s.era] || '')} · u stolu ${esc(c.real)}${c.drs ? ` · ${esc(c.drs)}` : ''}</p><h4>${esc(c.title)}</h4>`;
    box.classList.remove('on'); void box.offsetWidth; box.classList.add('on');
    clearTimeout(chTimer); chTimer = setTimeout(() => box.classList.remove('on'), playing ? 3200 / speed + 600 : 2600);
    // při přehrávání se mapa přiblíží na celou kapitolu
    if (playing && map) {
      const cp = pts.filter((p) => p.ch === s.ch);
      if (cp.length > 1) {
        const b = L.latLngBounds(cp.map((p) => ll(p.x, p.y))).pad(0.25);
        if (!map.getBounds().contains(b) || map.getZoom() < map.getBoundsZoom(b) - 1.2) map.flyToBounds(b, { maxZoom: 0.5, duration: reduced() ? 0 : 1.1 });
      }
    }
  }

  // ------------------------------------------------------------------ přehrávání
  function tick(now) {
    raf = 0;
    if (!playing) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (hold > 0) hold -= dt * speed;
    else {
      const i = Math.floor(pos), s = segs[i];
      if (!s) { stop(); return; }
      const before = i;
      pos += (dt * speed) / (reduced() ? 0.01 : segDur(s));
      if (Math.floor(pos) > before || pos >= pts.length - 1) { pos = Math.min(pts.length - 1, before + 1); hold = 0.55 + Math.min(1.2, (pts[before + 1]?.s || []).length * 0.25); }
      render(true);
      if (pos >= pts.length - 1) { stop(); return; }
    }
    raf = requestAnimationFrame(tick);
  }
  function play() {
    if (playing) { stop(); return; }
    if (pos >= pts.length - 1) { pos = 0; curCh = null; render(); }
    playing = true; last = performance.now(); hold = 0.3;
    $('#mpPlay', el).textContent = '❚❚ Pauza'; $('#mpPlay', el).setAttribute('aria-pressed', 'true');
    if (pos === 0 && pts[0]) chapterTitle(pts[0]);
    raf = requestAnimationFrame(tick);
  }
  function stop() {
    playing = false; cancelAnimationFrame(raf); raf = 0;
    $('#mpPlay', el).textContent = '▶ Přehrát'; $('#mpPlay', el).setAttribute('aria-pressed', 'false');
  }
  function step(d) { stop(); pos = d > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1; render(true); }
  function chStep(d) {
    stop();
    const i = Math.round(pos), c = pts[i]?.ch;
    let j = i;
    if (d > 0) { while (j < pts.length - 1 && pts[j].ch === c) j++; }
    else { while (j > 0 && pts[j - 1].ch === c) j--; if (j === i || j === 0 && i === 0) { j = Math.max(0, j - 1); const c2 = pts[j]?.ch; while (j > 0 && pts[j - 1].ch === c2) j--; } }
    pos = j; render(); const s = pts[j];
    if (s) { const cp = pts.filter((p) => p.ch === s.ch); if (cp.length > 1) map.flyToBounds(L.latLngBounds(cp.map((p) => ll(p.x, p.y))).pad(0.25), { maxZoom: 0.5, duration: reduced() ? 0 : 0.9 }); else map.panTo(ll(s.x, s.y)); }
  }

  // ------------------------------------------------------------------ karty
  const panelEl = $('#mpPanel', el);
  function show(html) {
    panelEl.innerHTML = `<button class="mp-x" aria-label="Zavřít kartu">×</button>${html}`;
    panelEl.scrollTop = 0;
    if (window.matchMedia('(max-width: 900px)').matches) panelEl.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'nearest' });
  }
  function witHTML(ids) {
    const ws = [...new Set(ids)].map((id) => WIT[id]).filter(Boolean);
    if (!ws.length) return '';
    return `<h5>Svědci</h5><div class="mp-w">${ws.map((w) => `<a href="${HREF(`#svedectvi/${esc(w.id)}`)}" class="${w.strana === 'nepřítel' ? 'foe' : ''}">${w.portret ? img(w.portret, { alt: '', sizes: '48px', cls: 'mp-wi' }) : ''}<span><b>${esc(w.jmeno)}</b>${esc(w.role || '')}</span></a>`).join('')}</div>`;
  }
  function panelPlace(p) {
    const ses = (p.sessions || []).map((id) => D.sesById[id]).filter(Boolean);
    const npcs = (p.npcs || []).map((i) => D.npcs[i]).filter(Boolean);
    const stops = stopsAt[p.id] || [];
    const chs = [...new Set(stops.map((i) => R[i].ch).filter(Boolean))];
    const bats = (p.battles || []).map((id) => BATT[id]).filter(Boolean);
    const wits = [...(p.wit || []), ...bats.flatMap((b) => D.witBySrc?.[b.id] || [])];
    show(`<p class="mp-k">${esc(p.region || '')}${p.kind ? ` · ${esc(p.kind)}` : ''}${p.approx ? ' · poloha odhadem' : ''}</p>
      <h3>${esc(p.name)}</h3><p>${esc(p.desc || '')}</p>
      ${p.visits?.length ? `<h5>Co se tu stalo</h5><ul class="mp-v">${p.visits.map((v) => { const si = stops.find((i) => R[i].real === v.real && R[i].what === v.what); return `<li><b style="color:${ERA_COL[v.era] || '#ccc'}">${esc(ERA_SHORT[v.era] || v.era || '')}</b> <span>${esc(v.real)} · ${esc(v.dr)} DR</span> ${esc(v.what)}${si != null ? ` <button class="mp-go" data-stop="${si}" title="Ukázat na trase">↳ na trase</button>` : ''}</li>`; }).join('')}</ul>` : ''}
      ${chs.length ? `<h5>V Příběhu</h5><p class="mp-ch">${chs.map((c) => chLink(c)).join(' · ')}</p>` : ''}
      ${bats.length ? `<h5>Bitvy</h5><ul class="mp-s">${bats.map((b) => `<li><a href="${HREF(`#${esc(b.id)}`)}">⚔ ${esc(b.name)}</a> <span>${esc(b.real_label || '')}</span></li>`).join('')}</ul>` : ''}
      ${witHTML(wits)}
      ${ses.length ? `<h5>Sezení</h5><ul class="mp-s">${ses.slice(0, 12).map((s) => `<li><a href="${HREF(`#${s.id}`)}">${esc(s.date_label)} · ${esc(s.title)}</a></li>`).join('')}</ul>` : ''}
      ${npcs.length ? `<h5>Kdo tu žije a působí</h5><p class="mp-n">${npcs.slice(0, 24).map((n) => `<a href="${HREF(`#rejstrik`)}" data-npc="${esc(n.name)}" class="${n.kind === 'nepřítel' ? 'foe' : ''}">${esc(n.name)}</a>`).join(', ')}${npcs.length > 24 ? ' …' : ''}</p>` : ''}
      <p class="mp-3d"><a href="mapa3d/index.html#p=${esc(p.id)}" target="_blank" rel="noopener">Ukázat ve 3D mapě ⤢</a></p>`);
    Object.values(markers).forEach((o) => o.m.getElement()?.classList.toggle('sel', o.p.id === p.id));
  }
  function panelBattle(b) {
    const w = BATT[b.id] || b;
    const ses = w.session && D.sesById[w.session];
    const sides = Array.isArray(w.sides) ? w.sides : [];
    show(`<p class="mp-k">Bitva · ${esc(w.real_label || b.real || '')} · ${esc(w.dr || b.dr)} DR</p><h3>⚔ ${esc(w.name)}</h3>
      ${w.place ? `<p class="mp-k" style="text-transform:none;letter-spacing:0">${esc(w.place)}</p>` : ''}<p>${esc(w.summary || '')}</p>
      ${sides.length ? `<h5>Strany</h5><ul class="mp-s">${sides.map((s) => `<li><b>${esc(s.name)}</b>${s.commanders?.length ? ` <span>– ${esc(s.commanders.slice(0, 4).join(', '))}</span>` : ''}</li>`).join('')}</ul>` : ''}
      ${w.outcome ? `<h5>Výsledek</h5><p>${esc(w.outcome)}</p>` : ''}
      ${witHTML(D.witBySrc?.[b.id] || [])}
      <p class="mp-ch"><a href="${HREF(`#${esc(b.id)}`)}">Bojové hlášení →</a>${ses ? ` · <a href="${HREF(`#${ses.id}`)}">sezení ${esc(ses.date_label)}</a>` : ''}${b.pl ? ` · <a href="mapa3d/index.html#b=${esc(b.id)}" target="_blank" rel="noopener">ve 3D ⤢</a>` : ''}</p>`);
  }

  // ------------------------------------------------------------------ značky, shluky, popisky
  const imp = (p) => (p.visits?.length || 0) + (p.battles?.length || 0) * 2 + (p.wit?.length || 0);
  function placeIcon(p, cls = '') {
    const s = Math.round(Math.min(18, 9 + imp(p) * 1.2));
    return L.divIcon({ className: `place${p.approx ? ' approx' : ''}${cls}`, html: `<i style="--s:${s}px"></i><span class="pl-lab">${esc(p.name)}</span>`, iconSize: [s, s] });
  }
  function relayout() {
    if (!map) return;
    const z = map.getZoom();
    clusterLayer.clearLayers();
    const list = Object.values(markers).filter((o) => o.on && map.hasLayer(o.m));
    list.forEach((o) => { o.pt = map.latLngToContainerPoint(o.m.getLatLng()); o.cl = null; o.m.getElement()?.classList.remove('hid'); });
    // shlukování: blízké značky (pod 20 px) se spojí, dokud nejde o největší přiblížení
    const RAD = z >= map.getMaxZoom() - 0.01 ? 0 : 20;
    const sorted = [...list].sort((a, b) => imp(b.p) - imp(a.p));
    const groups = [];
    for (const o of sorted) {
      if (o.cl) continue;
      const g = [o]; o.cl = g;
      if (RAD) for (const q of sorted) if (!q.cl && Math.hypot(q.pt.x - o.pt.x, q.pt.y - o.pt.y) < RAD) { q.cl = g; g.push(q); }
      groups.push(g);
    }
    const cur = pts[Math.round(pos)] && placeByName[pts[Math.round(pos)].place];
    for (const g of groups) {
      if (g.length < 2) continue;
      g.forEach((o) => o.m.getElement()?.classList.add('hid'));
      const c = L.latLngBounds(g.map((o) => o.m.getLatLng())).getCenter();
      const names = g.map((o) => o.p.name);
      const m = L.marker(c, { icon: L.divIcon({ className: 'mcl', html: `<b>${g.length}</b><span class="pl-lab">${esc(g[0].p.name)} +${g.length - 1}</span>`, iconSize: [26, 26] }), title: names.join(', '), keyboard: true, alt: `Shluk míst: ${names.join(', ')}` });
      m.on('click', () => { const b = L.latLngBounds(g.map((o) => o.m.getLatLng())); map.flyToBounds(b.pad(0.6), { maxZoom: Math.min(map.getMaxZoom(), map.getZoom() + 1.5), duration: reduced() ? 0 : 0.6 }); });
      m._g = g; m.addTo(clusterLayer);
      if (cur && g.some((o) => o.p.id === cur.id)) m.getElement()?.classList.add('cur');
    }
    labelsLayout();
  }
  // popisky bez překryvu: hladově podle důležitosti, vpravo, jinak vlevo, jinak skrýt
  const LW = {};
  const lw = (e, t) => (LW[t] ||= (e.querySelector('.pl-lab')?.offsetWidth || t.length * 6.5 + 12)) + 4;
  function labelsLayout() {
    const box = $('#leaf', el).getBoundingClientRect();
    const placed = [];
    const hit = (r) => placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    const items = [];
    Object.values(markers).forEach((o) => { const e = o.m.getElement(); if (e && o.on && map.hasLayer(o.m) && !e.classList.contains('hid')) items.push({ e, pt: map.latLngToContainerPoint(o.m.getLatLng()), w: lw(e, o.p.name), pr: imp(o.p) + (e.classList.contains('cur') || e.classList.contains('sel') ? 100 : 0) }); });
    clusterLayer.eachLayer((m) => { const e = m.getElement(); if (e) items.push({ e, pt: map.latLngToContainerPoint(m.getLatLng()), w: lw(e, m._g[0].p.name + ' +9'), pr: 50 + m._g.length }); });
    sphereLayer.eachLayer((m) => { if (!m._p) return; const e = m.getElement(); if (e) items.push({ e, pt: map.latLngToContainerPoint(m.getLatLng()), w: lw(e, m._p.name), pr: 30 }); });
    // body samotné a značky bitev jsou překážky
    items.forEach((it) => placed.push({ x: it.pt.x - 6, y: it.pt.y - 6, w: 12, h: 12 }));
    battleLayer.eachLayer((m) => { const q = map.latLngToContainerPoint(m.getLatLng()); placed.push({ x: q.x + 2, y: q.y - 28, w: 26, h: 26 }); });
    items.sort((a, b) => b.pr - a.pr);
    for (const it of items) {
      it.e.classList.remove('lab-l', 'lab-r', 'lab-n');
      if (!lay.labels) { it.e.classList.add('lab-n'); continue; }
      const r = { x: it.pt.x + 10, y: it.pt.y - 9, w: it.w, h: 18 };
      const l = { x: it.pt.x - 10 - it.w, y: it.pt.y - 9, w: it.w, h: 18 };
      const inside = (q) => q.x > 0 && q.x + q.w < box.width && q.y > 0 && q.y + q.h < box.height;
      if (inside(r) && !hit(r)) { placed.push(r); it.e.classList.add('lab-r'); }
      else if (inside(l) && !hit(l)) { placed.push(l); it.e.classList.add('lab-l'); }
      else it.e.classList.add('lab-n');
    }
  }

  function applyFilters() {
    const eraOk = (p) => era === 'all' || (p.visits || []).some((v) => v.era === era);
    Object.values(markers).forEach((o) => {
      o.on = lay.places || o.p.battles?.length;
      const want = lay.places;
      if (want && !map.hasLayer(o.m)) o.m.addTo(placeLayer); else if (!want && placeLayer.hasLayer(o.m)) placeLayer.removeLayer(o.m);
      o.on = want;
      o.m.getElement()?.classList.toggle('dim', !eraOk(o.p));
    });
    bmarkers.forEach((m) => { const on = lay.battles && (era === 'all' || m._b.era === era); if (on && !battleLayer.hasLayer(m)) m.addTo(battleLayer); else if (!on && battleLayer.hasLayer(m)) battleLayer.removeLayer(m); });
    if (lay.spheres && !map.hasLayer(sphereLayer)) sphereLayer.addTo(map); else if (!lay.spheres && map.hasLayer(sphereLayer)) map.removeLayer(sphereLayer);
    sphereLayer.eachLayer((m) => { if (m._p) m.getElement()?.classList.toggle('dim', !eraOk(m._p)); });
    if (!lay.route && map.hasLayer(head)) map.removeLayer(head);
    render(); relayout();
  }

  function setEra(e, fit = true) {
    era = e; stop();
    $$('.map-eras button', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.era === e)));
    build(); pos = pts.length - 1; curCh = undefined; render(); curCh = pts[Math.round(pos)]?.ch;
    if (map && fit) {
      if (e === 'all') setView($('[data-view][aria-pressed="true"]', el)?.dataset.view || 'faerun', false);
      else if (pts.length) map.flyToBounds(L.latLngBounds(pts.map((p) => ll(p.x, p.y))).pad(0.12), { maxZoom: 0.5, duration: reduced() ? 0 : 0.8 });
    }
    applyFilters();
  }
  function setView(v, press = true) {
    if (press) $$('[data-view]', el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === v)));
    if (!map) return;
    if (v === 'sfery' && !lay.spheres) { lay.spheres = true; $('[data-lay="spheres"]', el).setAttribute('aria-pressed', 'true'); applyFilters(); }
    const b = VIEWS[v] || [[-H, 0], [0, W]];
    map.flyToBounds(b, { duration: reduced() ? 0 : 0.8, padding: [10, 10] });
  }

  function init() {
    map = L.map($('#leaf', el), {
      crs: L.CRS.Simple, minZoom: -2.6, maxZoom: 1.5, zoomSnap: 0.25, zoomDelta: 0.5,
      maxBounds: [[-H - 200, SPH_X - 300], [200, W + 300]], attributionControl: false, scrollWheelZoom: false, keyboard: true,
    });
    const bounds = [[-H, 0], [0, W]];
    L.imageOverlay('img/map/toril-2576.webp', bounds, { alt: 'Mapa Torilu' }).addTo(map);
    map.fitBounds(bounds);
    map.setMinZoom(map.getBoundsZoom(bounds, false) - 0.6);
    window.addEventListener('resize', () => { map.setMinZoom(map.getBoundsZoom(bounds, false) - 0.6); buildTicks(); });
    map.on('focus', () => map.scrollWheelZoom.enable());
    map.on('blur', () => map.scrollWheelZoom.disable());
    casingLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    placeLayer = L.layerGroup().addTo(map);
    battleLayer = L.layerGroup().addTo(map);
    clusterLayer = L.layerGroup().addTo(map);
    sphereLayer = L.layerGroup().addTo(map);
    head = L.marker([0, 0], { icon: L.divIcon({ className: 'route-head', html: '<i></i><i></i><b></b>', iconSize: [18, 18] }), interactive: false, keyboard: false, zIndexOffset: 1000 });
    for (const p of D.map.places) {
      const m = L.marker(ll(p.x, p.y), { icon: placeIcon(p), title: p.name, alt: p.name, keyboard: true, riseOnHover: true }).addTo(placeLayer);
      m.on('click', () => { stop(); panelPlace(p); });
      markers[p.id] = { m, p, on: true };
    }
    for (const b of D.map.battles || []) {
      const m = L.marker(ll(b.x, b.y), { icon: L.divIcon({ className: 'bmk', html: '<i><span>⚔</span></i>', iconSize: [22, 22], iconAnchor: [-4, 26] }), title: b.name, alt: b.name, keyboard: true, zIndexOffset: 200 });
      m._b = b; m.on('click', () => { stop(); panelBattle(b); }); m.addTo(battleLayer); bmarkers.push(m);
    }
    // sféry: sloupec ostrovů za západním okrajem mapy, spojený tečkovanou čarou portálu
    const off = D.map.off;
    off.forEach((p, i) => {
      const y = 70 + i * ((H - 120) / Math.max(1, off.length - 1));
      const m = L.marker(ll(SPH_X, y), { icon: L.divIcon({ className: 'sph', html: `<i></i><span class="pl-lab">${esc(p.name)}</span>`, iconSize: [16, 16] }), title: p.name, alt: `Sféra ${p.name}`, keyboard: true });
      m._p = p; m.on('click', () => { stop(); panelPlace(p); }); m.addTo(sphereLayer);
    });
    L.polyline([ll(SPH_X, 40), ll(SPH_X, H - 30)], { color: '#9d7fe0', weight: 1, opacity: 0.45, dashArray: '2 7', interactive: false }).addTo(sphereLayer);
    L.marker(ll(SPH_X, 22), { icon: L.divIcon({ className: 'sph-h', html: 'Plány existence', iconSize: [120, 14] }), interactive: false, keyboard: false }).addTo(sphereLayer);
    map.on('zoomend moveend', relayout);
    map.on('zoomstart', () => clusterLayer.clearLayers());
    build(); pos = pts.length - 1; render(); curCh = pts[Math.round(pos)]?.ch;
    map.fitBounds(VIEWS.faerun, { animate: false }); applyFilters();
  }
  const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); if (!map) init(); } }, { rootMargin: '300px' });
  io.observe($('#leaf', el));

  // ------------------------------------------------------------------ ovládání
  el.addEventListener('click', (e) => {
    const b = e.target.closest('.map-eras button'); if (b) setEra(b.dataset.era);
    const v = e.target.closest('[data-view]'); if (v) setView(v.dataset.view);
    const l = e.target.closest('[data-lay]');
    if (l) { const k = l.dataset.lay; lay[k] = !lay[k]; l.setAttribute('aria-pressed', String(lay[k])); if (k === 'route' && lay.route) head.addTo(map); applyFilters(); }
    const n = e.target.closest('[data-npc]'); if (n) { e.preventDefault(); emit('registry:search', { q: n.dataset.npc }); return; }
    const g = e.target.closest('[data-stop]');
    if (g) { stop(); const i = pts.findIndex((p) => p.i === +g.dataset.stop); if (i < 0) setEra('all', false); pos = Math.max(0, pts.findIndex((p) => p.i === +g.dataset.stop)); render(); map.panTo(head.getLatLng()); }
    if (e.target.closest('.mp-x')) { panelEl.innerHTML = '<p class="mp-empty">Klepněte na místo, bitvu nebo sféru.</p>'; Object.values(markers).forEach((o) => o.m.getElement()?.classList.remove('sel')); }
  });
  $('#mpPlay', el).onclick = play;
  $('#mpPrev', el).onclick = () => step(-1);
  $('#mpNext', el).onclick = () => step(1);
  $('#mpChPrev', el).onclick = () => chStep(-1);
  $('#mpChNext', el).onclick = () => chStep(1);
  $('#mpSpeed', el).onchange = (e) => { speed = +e.target.value; };
  $('#mpScale', el).onclick = (e) => { scale = scale === 'real' ? 'dr' : 'real'; e.currentTarget.textContent = scale === 'real' ? 'u stolu' : 'DR'; buildTicks(); };
  range.oninput = () => { stop(); pos = +range.value / 100; render(true); };
  $('#mapUi', el).addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea') || e.ctrlKey || e.metaKey || e.altKey) return;
    const onBtn = e.target.closest('button, a');
    const k = e.key;
    if (k === ' ' && !onBtn) { e.preventDefault(); play(); }
    else if (k === ',' || k === '<') step(-1);
    else if (k === '.' || k === '>') step(1);
    else if (k === '[') chStep(-1);
    else if (k === ']') chStep(1);
    else if (k === '0') setEra('all');
    else if (/^[1-6]$/.test(k)) setEra(ERAS[+k - 1]);
    else if (k === 'Escape') $('.mp-x', panelEl)?.click();
    else return;
  });
  // odkaz na místo (z vyprávění v Příběhu): mapa se ukáže, přiblíží místo a otevře jeho kartu
  // stránka skrytá / znovu ukázaná: zastavit přehrávání, po návratu přepočítat velikost mapy
  window.addEventListener('page:change', (e) => {
    if (e.detail.from === 'mapa') stop();
    if (e.detail.to === 'mapa' && map) requestAnimationFrame(() => map.invalidateSize());
  });
  window.addEventListener('map:place', (e) => {
    const p = placeById[e.detail.id];
    settleScroll($('.map-ui', el));
    if (!map) { io.disconnect(); init(); }
    if (!p) return;
    stop();
    if (p.x != null) {
      map.setView(ll(p.x, p.y), 0.25, { animate: !reduced() });
      const m = markers[p.id]?.m.getElement();
      if (m) { m.classList.add('hit'); setTimeout(() => m.classList.remove('hit'), 4000); }
    } else setView('sfery');
    panelPlace(p);
  });
  window.addEventListener('map:era', (e) => {
    const go = () => { setEra(e.detail.era); pos = 0; curCh = null; render(); setTimeout(play, 700); };
    if (map) go(); else setTimeout(go, 900);
  });
  // ladicí rozhraní pro testy
  window.__map2d = { get pos() { return pos; }, get n() { return pts.length; }, get playing() { return playing; }, play, stop, step, chStep, setEra, setView, get map() { return map; }, labels: () => $$('.leaf .lab-r, .leaf .lab-l', el).length, clusters: () => $$('.leaf .mcl', el).length };
}

/** /mapa?misto=<id> otevře kartu místa, /mapa?kniha=II přehraje trasu knihy. */
export function enter(r) {
  if (r.query.misto) window.dispatchEvent(new CustomEvent('map:place', { detail: { id: r.query.misto } }));
  else if (r.query.kniha) window.dispatchEvent(new CustomEvent('map:era', { detail: { era: r.query.kniha } }));
}

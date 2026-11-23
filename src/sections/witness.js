// 4. Svědectví (jádro webu, à la „Prelude to Axanar“): jen vedlejší postavy (NPC), nikdy hráčské.
// Portrét nebo „živý portrét“ (video ve smyčce) pod hlasem, titulky po větách podle časování,
// režim „dokument“ s dramaturgií po knihách, střihy na malby bitev a na mapu.
// Nic se nepřehrává samo: zvuk i video startují až po kliknutí.
import media from 'virtual:media';
import DOC from '../../data/dokument.json';
import { D } from '../lib/data.js';
import { img, small } from '../lib/img.js';
import { $, $$, esc, reduced, plural, settleScroll } from '../lib/util.js';

const baseOf = (f) => f.replace(/\.[^.]+$/, '');
const VOICE_FILE = Object.fromEntries(media.voices.map((f) => [baseOf(f), f]));
const HAS_VIDEO = Object.fromEntries(media.video.map((f) => [baseOf(f), f]));
const HAS_TIMING = media.timings.includes('timing.json');
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

// starší odkazy (např. z 3D mapy) na přejmenovaná id
const ALIAS = { khelben: 'khelbenova-dcera' };
const SIDE = { spojenci: 'spojenec', 'nepřátelé': 'nepřítel', 'neutrální': 'neutrální', nadhled: 'hlas z nadhledu' };
const sideLabel = (w) => SIDE[w.skupina] || 'spojenec';
const isFoe = (w) => w.strana === 'nepřítel';
const isPast = (w) => !!w.stav && w.stav !== 'žije'; // padlí a zmizelí: „hlas z minulosti“
const stavTitle = (w) => w.stav_titulek || (w.stav === 'zmizel' ? 'zmizel beze stopy' : '† padl');
const FILTERS = {
  all: () => true,
  friend: (w) => w.skupina === 'spojenci',
  foe: (w) => w.skupina === 'nepřátelé',
  sky: (w) => w.skupina === 'nadhled',
};

export function renderWitness() {
  const el = $('#svedectvi');
  const all = D.svedectvi;
  const nFoe = all.filter(isFoe).length;
  const nSky = all.filter((w) => w.skupina === 'nadhled').length;
  const nVoice = all.filter((w) => VOICE_FILE[w.id]).length;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Svědectví</p><h2 id="svedectvi-h">Hlasy z obou stran</h2>
    <p class="lead">${all.length} lidí a bytostí, kteří družinu znali: spojenci, ${plural(nFoe, 'nepřítel', 'nepřátelé', 'nepřátel')} a ${plural(nSky, 'hlas', 'hlasy', 'hlasů')} z nadhledu. Mluví o tom, co s družinou zažili. Každé slovo se opírá o konkrétní hru, o hráčských postavách mluví ve třetí osobě.</p><div class="orn">✦</div></header>
    <div class="w-stage" id="wStage" tabindex="-1" aria-roledescription="přehrávač svědectví">
      <div class="w-layer" id="wA"></div>
      <div class="w-layer" id="wB"></div>
      <div class="w-inter" id="wInter" aria-hidden="true"></div>
      <div class="w-light" aria-hidden="true"></div>
      <canvas class="w-grain" aria-hidden="true"></canvas>
      <div class="w-vig" aria-hidden="true"></div>
      <div class="w-bars" aria-hidden="true"></div>
      <div class="w-lower" id="wLower"><span class="w-side"></span><h3 class="w-name"></h3><p class="w-role"></p><p class="w-vaz"></p></div>
      <div class="w-sub" id="wSub" aria-live="polite"><p></p></div>
      <div class="w-tap" id="wTap" hidden><button class="btn red" data-act="play">▶ Spustit</button></div>
      <div class="w-start" id="wStart">
        <p class="w-start-k">Dokument o jedné družině</p>
        <h3>Svědectví</h3>
        <p class="w-start-p">Přátelé i nepřátelé Tethyrské královské družiny${nVoice ? ' · s hlasem a živým portrétem' : ''}</p>
        <div class="w-start-b"><button class="btn red" data-act="doc">▶ Přehrát vše jako dokument</button><button class="btn" data-act="pick">Vybrat svědka</button></div>
      </div>
      <div class="w-prog" id="wProgBox" role="slider" aria-label="Průběh svědectví" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><i id="wProg"></i></div>
    </div>
    <div class="w-ctl wrap" role="toolbar" aria-label="Ovládání svědectví">
      <div class="w-ctl-a">
        <button class="btn sm" data-act="prev" aria-label="Předchozí svědek">◂◂</button>
        <button class="btn sm red" data-act="play" id="wPlay" aria-label="Přehrát">▶</button>
        <button class="btn sm" data-act="next" aria-label="Další svědek">▸▸</button>
        <button class="btn sm ghost" data-act="mute" id="wMute" aria-pressed="false" aria-label="Ztlumit zvuk">♪</button>
        <span class="w-count" id="wCount"></span>
      </div>
      <div class="w-ctl-b" role="group" aria-label="Filtr">
        <button class="btn sm" data-f="all" aria-pressed="true">Všichni</button>
        <button class="btn sm" data-f="friend" aria-pressed="false">Spojenci</button>
        <button class="btn sm" data-f="foe" aria-pressed="false">Nepřátelé</button>
        <button class="btn sm" data-f="sky" aria-pressed="false">Z nadhledu</button>
      </div>
      <div class="w-ctl-c">
        <button class="btn sm" data-act="doc" id="wDoc" aria-pressed="false">Přehrát vše jako dokument</button>
        <button class="btn sm ghost" data-act="trans" aria-expanded="false" aria-controls="wTrans">Přepis</button>
      </div>
    </div>
    <div class="w-info wrap-text" id="wInfo" aria-live="polite"></div>
    <div class="w-trans wrap-text" id="wTrans" hidden></div>
    <div class="w-pick wrap" id="wPick" role="list"></div>`;

  const stage = $('#wStage', el);
  const layers = [$('#wA', el), $('#wB', el)];
  const inter = $('#wInter', el);
  let front = 0;
  let filter = 'all';
  let list = all.slice();
  let cur = -1;
  let state = 'idle'; // idle | play | pause | inter | end
  let doc = false;
  let seq = [], seqI = -1;
  let muted = false;
  let video = null, kb = null;
  let hasAudio = false;
  let acc = 0, t0 = 0, total = 0, starts = [], lastSent = -1, raf = 0, interTimer = 0, interLeft = 0, interAt = 0, interNext = null;
  let timing = null;
  const audio = new Audio();
  audio.preload = 'auto';

  // ---------- časování z assets/voices/timing.json
  const timingP = HAS_TIMING ? fetch('assets/voices/timing.json').then((r) => r.json()).then((t) => { timing = t; }).catch(() => {}) : Promise.resolve();

  // ---------- zvuk: jedna trvalá <audio> (odemkne se prvním kliknutím, pak jde přepínat zdroje i v režimu dokument)
  let unlocked = false;
  function unlock() {
    if (unlocked) return; unlocked = true;
    audio.muted = true; audio.src = SILENCE;
    audio.play().then(() => { audio.pause(); audio.muted = muted; }).catch(() => { audio.muted = muted; });
  }
  el.addEventListener('pointerdown', unlock, { capture: true });
  el.addEventListener('keydown', unlock, { capture: true });

  // ---------- výběr osob
  function renderPick() {
    $('#wPick', el).innerHTML = list.map((w, i) => `<button class="w-card${i === cur ? ' on' : ''}${isFoe(w) ? ' foe' : ''}" role="listitem" data-i="${i}">
      <span class="w-card-i"><img src="${small(w.portret)}" alt="" loading="lazy" decoding="async" style="object-position:${esc(w.fokus || '50% 30%')}"></span>
      <span class="w-card-t"><b>${esc(w.jmeno)}</b><i>${esc(w.role)}</i><em>${sideLabel(w)}${isPast(w) ? ' · hlas z minulosti' : ''}${VOICE_FILE[w.id] ? ' · hlas' : ''}${HAS_VIDEO[w.id] ? ' · video' : ''}</em></span></button>`).join('');
  }
  function setFilter(f) {
    filter = f;
    $$('[data-f]', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === f));
    const curId = list[cur]?.id;
    list = all.filter(FILTERS[f]);
    cur = list.findIndex((w) => w.id === curId);
    renderPick(); count();
  }
  function count() {
    const c = $('#wCount', el);
    if (doc && seq.length) {
      const ids = seq.filter((x) => x.k === 'sv');
      const n = ids.filter((x) => seq.indexOf(x) <= seqI).length;
      c.textContent = `Dokument · ${n} / ${ids.length}`;
    } else c.textContent = cur >= 0 ? `${cur + 1} / ${list.length}` : `${list.length} svědků`;
  }

  // ---------- vrstvy obrazu
  function layerHtml(w, withVideo) {
    const pos = w.fokus || '50% 30%';
    return `<div class="w-bg" style="background-image:url('${small(w.portret)}')"></div>
      <div class="w-img"><div class="w-breath">${img(w.portret, { alt: `Portrét: ${w.jmeno}`, sizes: '100vw', pos, eager: true })}</div></div>${withVideo ? '<div class="w-vwrap"></div>' : ''}`;
  }
  function kenBurns(target, dur, fokus = '50% 30%') {
    kb?.cancel(); kb = null;
    if (reduced() || !target) return;
    target.style.transformOrigin = fokus;
    kb = target.animate([
      { transform: 'scale(1.03) translate(0,0)' },
      { transform: 'scale(1.1) translate(-0.6%, -0.4%)' },
    ], { duration: Math.max(8000, dur * 1000 + 2500), easing: 'cubic-bezier(.33,.0,.3,1)', fill: 'forwards' });
  }

  // ---------- časování titulků
  function computeStarts(w, dur) {
    const t = timing?.[w.id];
    if (t && t.starts?.length === w.text.length) return { st: t.starts.slice(), tot: dur || t.duration };
    const lens = w.text.map((x) => Math.max(1.9, x.length * 0.064) + 0.35);
    const sum = lens.reduce((a, b) => a + b, 0);
    const k = dur ? (dur - 0.4) / sum : 1;
    let tt = dur ? 0.25 : 0.9; const st = [];
    for (const l of lens) { st.push(tt); tt += l * k; }
    return { st, tot: dur || tt + 0.6 };
  }
  const clock = () => (hasAudio ? audio.currentTime : state === 'play' ? acc + (performance.now() - t0) / 1000 : acc);

  function showSentence(i, w) {
    const sub = $('#wSub p', el);
    if (i === lastSent) return; lastSent = i;
    sub.classList.remove('in');
    setTimeout(() => { if (lastSent !== i) return; sub.textContent = i >= 0 ? w.text[i] : ''; if (i >= 0) sub.classList.add('in'); }, i === 0 ? 0 : 240);
  }
  function loop() {
    cancelAnimationFrame(raf);
    const w = list[cur] || D.witById[seq[seqI]?.id];
    const step = () => {
      if (state !== 'play' || !w) return;
      const t = clock();
      let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      showSentence(i, w);
      const p = Math.min(1, t / total);
      $('#wProg', el).style.transform = `scaleX(${p})`;
      $('#wProgBox', el).setAttribute('aria-valuenow', Math.round(p * 100));
      $('#wLower', el).classList.toggle('in', t > 0.35 && t < total - 0.5);
      if ((hasAudio && audio.ended) || t >= total + 0.9) { end(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- načtení svědka
  function teardownMedia() {
    audio.pause(); audio.onended = null;
    hasAudio = false;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video = null; }
  }
  const byId = (id) => D.witById[id];
  let loadToken = 0;
  async function load(w, { autoplay = true } = {}) {
    const tok = ++loadToken;
    clearTimeout(interTimer); interNext = null;
    teardownMedia();
    cancelAnimationFrame(raf);
    const ix = list.findIndex((x) => x.id === w.id);
    if (ix >= 0) cur = ix; else if (!doc) { cur = -1; }
    $('#wStart', el).classList.add('gone');
    $('#wTap', el).hidden = true;
    const useVideo = !!HAS_VIDEO[w.id] && !reduced();
    // prolínačka mezi vrstvami (obraz hned, video po spuštění)
    const next = layers[1 - front];
    next.className = 'w-layer';
    next.innerHTML = layerHtml(w, useVideo);
    if (useVideo) {
      video = document.createElement('video');
      video.className = 'w-video'; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
      video.setAttribute('playsinline', ''); video.setAttribute('muted', ''); video.setAttribute('aria-hidden', 'true');
      video.src = `assets/video/${HAS_VIDEO[w.id]}`;
      video.style.objectPosition = w.fokus || '50% 30%';
      video.addEventListener('playing', () => next.classList.add('has-video'), { once: true });
      $('.w-vwrap', next).appendChild(video);
      video.load();
    }
    next.classList.add('on'); layers[front].classList.remove('on'); front = 1 - front;
    inter.classList.remove('in', 'card');
    // titulek a popisek
    const lower = $('#wLower', el);
    lower.classList.remove('in');
    lower.classList.toggle('foe', isFoe(w));
    lower.classList.toggle('past', isPast(w)); stage.classList.toggle('past', isPast(w));
    $('.w-side', lower).textContent = sideLabel(w);
    $('.w-name', lower).textContent = w.jmeno;
    $('.w-role', lower).innerHTML = `${esc(w.role)}${isPast(w) ? ` <span class="w-dead">${esc(stavTitle(w))} · hlas z minulosti</span>` : ''}`;
    $('.w-vaz', lower).textContent = w.vazba || '';
    lastSent = -1; $('#wSub p', el).textContent = ''; $('#wSub p', el).classList.remove('in');
    renderPick(); count(); info(w); trans(w);
    // zvuk a délka
    let dur = 0;
    await timingP;
    if (tok !== loadToken) return;
    if (VOICE_FILE[w.id]) {
      audio.src = `assets/voices/${VOICE_FILE[w.id]}`; audio.muted = muted; audio.load();
      dur = await new Promise((res) => {
        const done = (v) => { audio.onloadedmetadata = null; audio.onerror = null; res(v); };
        audio.onloadedmetadata = () => done(audio.duration || 0);
        audio.onerror = () => done(0);
        setTimeout(() => done(audio.duration || 0), 5000);
      });
      hasAudio = dur > 0;
    }
    if (tok !== loadToken) return; // mezitím přepnuto
    const c = computeStarts(w, dur); starts = c.st; total = c.tot;
    if (!useVideo) kenBurns($('.w-breath img', next), total, w.fokus);
    acc = 0; interPaused = false; state = 'pause'; // (po střihu v režimu dokument je stav ještě „inter“)
    if (autoplay) play(); else { state = 'pause'; ui(); kb?.pause(); stage.classList.add('paused'); $('#wTap', el).hidden = false; }
  }

  function play() {
    if (state === 'idle') { startPlain(); return; }
    if (state === 'end') { const w = curW(); if (w) load(w); return; }
    if (state === 'inter') { resumeInter(); return; }
    state = 'play'; t0 = performance.now();
    $('#wTap', el).hidden = true;
    if (hasAudio) {
      audio.muted = muted;
      const p = audio.play();
      p?.catch(() => { // prohlížeč zvuk zablokoval: počkáme na klepnutí
        state = 'pause'; acc = audio.currentTime; stage.classList.add('paused'); video?.pause(); kb?.pause(); ui(); $('#wTap', el).hidden = false;
      });
      audio.onended = () => { if (state === 'play') end(); };
    }
    video?.play().catch(() => {});
    kb?.play(); stage.classList.remove('paused');
    ui(); loop();
  }
  function pause() {
    if (state === 'inter') { pauseInter(); return; }
    if (state !== 'play') return;
    acc = clock(); state = 'pause';
    audio.pause(); video?.pause(); kb?.pause(); stage.classList.add('paused');
    ui();
  }
  const curW = () => (doc ? byId(seq[seqI]?.id) : list[cur]);
  function end() {
    state = 'end'; ui();
    $('#wLower', el).classList.remove('in');
    showSentence(-1, curW());
    if (doc) { interTimer = setTimeout(() => runSeq(seqI + 1), 900); return; }
  }
  function ui() {
    const playing = state === 'play' || (state === 'inter' && !interPaused);
    $('#wPlay', el).textContent = playing ? '❚❚' : '▶';
    $('#wPlay', el).setAttribute('aria-label', playing ? 'Pozastavit' : 'Přehrát');
    $('#wDoc', el).setAttribute('aria-pressed', doc);
    $('#wDoc', el).textContent = doc ? 'Zastavit dokument' : 'Přehrát vše jako dokument';
    stage.classList.toggle('doc', doc);
  }
  function startPlain() { // první spuštění přehrávače bez dokumentu
    if (cur < 0) cur = 0;
    load(list[cur]);
  }

  // ---------- střihy (režim dokument): karta knihy, mapa, malba bitvy
  let interPaused = false;
  function showInter(html, ms, then, cls = '') {
    clearTimeout(interTimer); loadToken++;
    state = 'inter'; interPaused = false; ui();
    teardownMedia();
    $('#wLower', el).classList.remove('in');
    showSentence(-1, null);
    $('#wProg', el).style.transform = 'scaleX(0)';
    inter.className = 'w-inter ' + cls;
    inter.innerHTML = html;
    requestAnimationFrame(() => requestAnimationFrame(() => inter.classList.add('in')));
    interNext = then; interLeft = ms; interAt = performance.now();
    interTimer = setTimeout(() => { if (state === 'inter') then(); }, ms);
  }
  function pauseInter() {
    interPaused = true; clearTimeout(interTimer);
    interLeft -= performance.now() - interAt;
    inter.classList.add('frozen'); ui();
  }
  function resumeInter() {
    interPaused = false; inter.classList.remove('frozen'); ui();
    interAt = performance.now();
    interTimer = setTimeout(() => { if (state === 'inter') interNext?.(); }, Math.max(400, interLeft));
  }
  function bookOf(key) { return D.books.find((b) => b.key === key); }
  function cardHtml(b) {
    return `<div class="wi-card"><p class="wi-k">${esc(b.kap)}</p><h4>${esc(b.title)}</h4><p class="wi-m">${esc(b.dr)} · u stolu ${esc(b.real)}</p></div>`;
  }
  function paintHtml(b) {
    const key = 'ilu/' + (b.images?.[0] || '');
    return `<div class="wi-paint">${img(key, { alt: b.captions?.[0] || b.name, sizes: '100vw', eager: true })}</div>
      <div class="w-inter-t"><p>${esc(b.dr)} DR · ${esc(b.place)}</p><h4>${esc(b.name)}</h4></div>`;
  }
  function mapHtml(b) {
    const pts = D.map.route.filter((r) => r.era === b.key && r.x != null);
    if (pts.length < 2) return null;
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const pad = 90;
    let x0 = Math.max(0, Math.min(...xs) - pad), x1 = Math.min(2576, Math.max(...xs) + pad);
    let y0 = Math.max(0, Math.min(...ys) - pad), y1 = Math.min(884, Math.max(...ys) + pad);
    const ar = 16 / 9;
    let w = x1 - x0, h = y1 - y0;
    if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
    if (w > 2576) { w = 2576; x0 = 0; } if (h > 884) { h = 884; y0 = 0; }
    x0 = Math.max(0, Math.min(2576 - w, x0)); y0 = Math.max(0, Math.min(884 - h, y0));
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
    const names = [...new Set(pts.map((p) => p.place))];
    const sc = w / 1400;
    return `<svg class="wi-map" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <image href="img/map/toril-2576.webp" x="0" y="0" width="2576" height="884"/>
      <rect x="0" y="0" width="2576" height="884" fill="rgba(14,12,9,.5)"/>
      <path d="${d}" class="wi-route" pathLength="1" style="stroke-width:${(2.2 * sc).toFixed(1)}"/>
      ${pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${((i === 0 || i === pts.length - 1 ? 8 : 5) * sc).toFixed(1)}" class="wi-pt" style="animation-delay:${(0.4 + (i / pts.length) * 3.2).toFixed(2)}s"/>`).join('')}
    </svg>
    <div class="w-inter-t"><p>${esc(b.dr)} · u stolu ${esc(b.real)}</p><h4>${esc(b.kap)}: ${esc(b.title)}</h4><span class="wi-places">${esc(names.slice(0, 6).join(' · '))}</span></div>`;
  }
  function endCard() {
    return `<div class="wi-card"><p class="wi-k">Konec dokumentu</p><h4>Kronika Tethyrské královské družiny</h4><p class="wi-m"><a href="#hymna">Hymna</a> · <a href="#podekovani">Poděkování</a></p></div>`;
  }

  // ---------- dramaturgie dokumentu (data/dokument.json)
  function buildSeq() {
    const out = [];
    for (const it of DOC.scenar) {
      if (it.k === 'kniha') {
        const b = bookOf(it.key); if (!b) continue;
        out.push({ k: 'card', b });
        if (mapHtml(b)) out.push({ k: 'map', b });
      } else if (it.k === 'bitva') {
        const b = D.battleById[it.id]; if (b?.images?.length) out.push({ k: 'paint', b });
      } else if (it.k === 'sv') {
        if (byId(it.id)) out.push({ k: 'sv', id: it.id });
      } else if (it.k === 'konec') out.push({ k: 'konec' });
    }
    return out;
  }
  function runSeq(i) {
    if (!doc) return;
    if (i >= seq.length) { stopDoc(); return; }
    seqI = i;
    const it = seq[i];
    count();
    if (it.k === 'sv') { load(byId(it.id)); return; }
    const go = () => runSeq(i + 1);
    const skip = reduced();
    if (it.k === 'card') showInter(cardHtml(it.b), skip ? 2500 : 5200, go, 'card');
    else if (it.k === 'map') showInter(mapHtml(it.b), skip ? 2500 : 6500, go, 'map');
    else if (it.k === 'paint') showInter(paintHtml(it.b), skip ? 2500 : 5200, go, 'paint');
    else if (it.k === 'konec') showInter(endCard(), 9000, () => stopDoc(), 'card');
    // malba: pomalý nájezd
    const im = $('.wi-paint img', inter);
    if (im && !reduced()) im.animate([{ transform: 'scale(1.02)' }, { transform: 'scale(1.1) translate(-1%, -.6%)' }], { duration: 6200, easing: 'linear', fill: 'forwards' });
  }
  function jumpSv(dir) { // v dokumentu: další / předchozí svědek
    let i = seqI + dir;
    while (i >= 0 && i < seq.length && seq[i].k !== 'sv') i += dir;
    if (i < 0) i = seq.findIndex((x) => x.k === 'sv');
    if (i >= seq.length) { stopDoc(); return; }
    // před svědka přeskočit rovnou na něj (střihy mezi tím se vynechají)
    clearTimeout(interTimer); interNext = null;
    runSeq(i);
  }
  function startDoc() {
    unlock();
    doc = true; seq = buildSeq(); seqI = -1;
    filter !== 'all' && setFilter('all');
    ui(); stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $('#wStart', el).classList.add('gone');
    runSeq(0);
  }
  function stopDoc() {
    doc = false; clearTimeout(interTimer); interNext = null; interPaused = false;
    inter.classList.remove('in', 'frozen');
    if (state === 'inter') { state = 'idle'; $('#wStart', el).classList.remove('gone'); }
    seq = []; seqI = -1; ui(); count();
  }

  // ---------- informace pod přehrávačem: vazba a odkazy na zdrojová sezení
  function info(w) {
    const box = $('#wInfo', el);
    const links = (w.zdroje || []).map((z) => {
      const s = D.sesById[z]; const b = D.battleById[z];
      if (s) return { d: s.date, h: `<a href="#${s.id}">${esc(s.date_label)} · ${esc(s.title)}</a>` };
      if (b) return { d: String(b.dr || ''), h: `<a href="#${b.id}">${esc(b.name)}</a>` };
      if (z === 'hymna') return { d: 'zzzz', h: '<a href="#hymna">Hymna družiny</a>' };
      return null;
    }).filter(Boolean);
    const hasTxt = (w.zdroje || []).some((z) => z.startsWith('txt:'));
    box.innerHTML = `<p class="w-vazba"><b>Vazba</b> ${esc(w.vazba || '')}</p>
      <p class="w-srcs"><b>Opřeno o</b> ${links.map((l) => l.h).join('<i> · </i>')}${hasTxt ? '<i> · </i><span>texty hráčů</span>' : ''}</p>`;
  }
  function trans(w) {
    const box = $('#wTrans', el);
    if (!w) { box.innerHTML = ''; return; }
    box.innerHTML = `<h3>${esc(w.jmeno)}</h3><p class="w-tr-role">${esc(w.role)} · ${sideLabel(w)}${isPast(w) ? ` · ${esc(stavTitle(w))}` : ''}</p>
      ${w.text.map((t) => `<p>${esc(t)}</p>`).join('')}`;
  }

  // ---------- zrno (canvas)
  function grain() {
    const c = $('.w-grain', el); if (reduced()) { c.remove(); return; }
    const ctx = c.getContext('2d'); c.width = 220; c.height = 140;
    let on = false, last = 0;
    const id = ctx.createImageData(c.width, c.height);
    const f = (t) => {
      if (!on) return;
      if (t - last > 80) {
        last = t;
        for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
        ctx.putImageData(id, 0, 0);
      }
      requestAnimationFrame(f);
    };
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) requestAnimationFrame(f); else if (state === 'play' || (state === 'inter' && !interPaused)) pause(); }, { threshold: 0.2 }).observe(stage);
  }

  // ---------- jemný parallax portrétu za myší
  stage.addEventListener('pointermove', (e) => {
    if (reduced() || e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty('--px', `${(-x * 14).toFixed(1)}px`); stage.style.setProperty('--py', `${(-y * 9).toFixed(1)}px`);
  });

  // ---------- posuvník (klik na lištu průběhu)
  function seekTo(frac) {
    if (state === 'inter' || state === 'idle' || !total) return;
    const t = Math.max(0, Math.min(total - 0.2, frac * total));
    if (hasAudio) audio.currentTime = t; else { acc = t; t0 = performance.now(); }
    lastSent = -2;
    if (state === 'end') { state = 'pause'; play(); }
    else { const w = curW(); let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k; lastSent = -3; showSentence(i, w); $('#wProg', el).style.transform = `scaleX(${t / total})`; }
  }
  $('#wProgBox', el).addEventListener('click', (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width);
  });
  $('#wProgBox', el).addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.stopPropagation(); seekTo(clock() / total + 0.05); }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); seekTo(clock() / total - 0.05); }
  });

  // ---------- ovládání
  function step(dir) {
    unlock();
    if (doc) { jumpSv(dir); return; }
    if (!list.length) return;
    const i = cur < 0 ? 0 : (cur + dir + list.length) % list.length;
    load(list[i]);
  }
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'play') state === 'play' || (state === 'inter' && !interPaused) ? pause() : play();
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'doc') { doc ? stopDoc() : startDoc(); }
    else if (a === 'pick') $('#wPick', el).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    else if (a === 'mute') {
      muted = !muted; e.target.closest('button').setAttribute('aria-pressed', muted);
      audio.muted = muted;
    } else if (a === 'trans') {
      const b = e.target.closest('button'); const box = $('#wTrans', el);
      box.hidden = !box.hidden; b.setAttribute('aria-expanded', !box.hidden);
    }
    const f = e.target.closest('[data-f]'); if (f) setFilter(f.dataset.f);
    const card = e.target.closest('.w-card');
    if (card) { if (doc) stopDoc(); load(list[+card.dataset.i]); stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
  });
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button, .w-prog') || state === 'idle') return;
    state === 'play' || (state === 'inter' && !interPaused) ? pause() : play();
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const inStage = stage.contains(document.activeElement);
    if (e.key === ' ' && document.activeElement === stage) { e.preventDefault(); state === 'play' || (state === 'inter' && !interPaused) ? pause() : play(); }
    else if (e.key === 'ArrowRight' && inStage && !e.target.closest('.w-prog')) step(1);
    else if (e.key === 'ArrowLeft' && inStage && !e.target.closest('.w-prog')) step(-1);
    else if (e.key === 'Escape' && doc) stopDoc();
  });
  window.addEventListener('witness:open', (e) => {
    const w = byId(e.detail.id) || byId(ALIAS[e.detail.id]); if (!w) return;
    if (doc) stopDoc();
    setFilter('all');
    if (e.detail.autoplay === false) settleScroll(stage); // hluboký odkaz: stránka se ještě skládá
    else stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#svedectvi/${w.id}`);
    unlock();
    setTimeout(() => load(w, { autoplay: e.detail.autoplay !== false }), 450);
  });
  window.addEventListener('witness:focus', () => stage.focus({ preventScroll: true }));

  renderPick(); count(); grain(); ui();
  // náhled prvního svědka pod úvodní kartou
  layers[0].innerHTML = layerHtml(all[0], false); layers[0].classList.add('on', 'idle');
  $('#wInfo', el).innerHTML = '';
}

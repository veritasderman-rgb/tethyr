// 4. Svědectví (jádro webu, à la „Prelude to Axanar“): portrét v pohybu, titulky po větách,
// audio/video ze složek assets/voices a assets/video, pokud existují; jinak časování podle délky textu.
import media from 'virtual:media';
import { D } from '../lib/data.js';
import { img, small, largest } from '../lib/img.js';
import { $, $$, esc, reduced } from '../lib/util.js';

const HAS_VOICE = new Set(media.voices.map((f) => f.replace(/\.[^.]+$/, '')));
const VOICE_FILE = Object.fromEntries(media.voices.map((f) => [f.replace(/\.[^.]+$/, ''), f]));
const HAS_VIDEO = Object.fromEntries(media.video.map((f) => [f.replace(/\.[^.]+$/, ''), f]));
const HAS_TIMING = new Set(media.timings.map((f) => f.replace(/\.json$/i, '')));

const SIDE = { 'družina': 'z družiny', 'spojenci': 'spojenec', 'nepřátelé': 'nepřítel' };
const sideLabel = (w) => (w.strana === 'nepřítel' ? 'nepřítel' : SIDE[w.skupina] || 'spojenec');

export function renderWitness() {
  const el = $('#svedectvi');
  const all = D.svedectvi;
  const nFoe = all.filter((w) => w.strana === 'nepřítel').length;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Svědectví</p><h2 id="svedectvi-h">Hlasy z obou stran</h2>
    <p class="lead">${all.length} lidí, kteří družinu znali. Druhové, spojenci a ${nFoe} nepřátel vzpomínají do kamery na to, co s ní zažili. Každé slovo se opírá o konkrétní hru.</p><div class="orn">✦</div></header>
    <div class="w-stage" id="wStage" tabindex="-1" aria-roledescription="přehrávač svědectví">
      <div class="w-layer" id="wA"></div>
      <div class="w-layer" id="wB"></div>
      <div class="w-inter" id="wInter" aria-hidden="true"></div>
      <div class="w-light" aria-hidden="true"></div>
      <canvas class="w-grain" aria-hidden="true"></canvas>
      <div class="w-vig" aria-hidden="true"></div>
      <div class="w-bars" aria-hidden="true"></div>
      <div class="w-lower" id="wLower"><span class="w-side"></span><h3 class="w-name"></h3><p class="w-role"></p></div>
      <div class="w-sub" id="wSub" aria-live="polite"><p></p></div>
      <div class="w-start" id="wStart">
        <p class="w-start-k">Dokument o jedné družině</p>
        <h3>Svědectví</h3>
        <p class="w-start-p">Přátelé i nepřátelé Tethyrské královské družiny</p>
        <div class="w-start-b"><button class="btn red" data-act="doc">▶ Přehrát vše jako dokument</button><button class="btn" data-act="pick">Vybrat svědka</button></div>
      </div>
      <div class="w-prog" aria-hidden="true"><i id="wProg"></i></div>
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
        <button class="btn sm" data-f="friend" aria-pressed="false">Přátelé</button>
        <button class="btn sm" data-f="foe" aria-pressed="false">Nepřátelé</button>
      </div>
      <div class="w-ctl-c">
        <button class="btn sm" data-act="doc" id="wDoc" aria-pressed="false">Přehrát vše jako dokument</button>
        <button class="btn sm ghost" data-act="trans" aria-expanded="false" aria-controls="wTrans">Přepis</button>
      </div>
    </div>
    <div class="w-trans wrap-text" id="wTrans" hidden></div>
    <div class="w-pick wrap" id="wPick" role="list"></div>`;

  const stage = $('#wStage', el);
  const layers = [$('#wA', el), $('#wB', el)];
  let front = 0;
  let filter = 'all';
  let list = all.slice();
  let cur = -1;
  let state = 'idle'; // idle | play | pause | inter | end
  let doc = false;
  let muted = false;
  let audio = null, video = null, kb = null;
  let acc = 0, t0 = 0, total = 0, starts = [], lastSent = -1, raf = 0, interTimer = 0;

  // ---------- výběr osob
  function renderPick() {
    $('#wPick', el).innerHTML = list.map((w, i) => `<button class="w-card${i === cur ? ' on' : ''}${w.strana === 'nepřítel' ? ' foe' : ''}" role="listitem" data-i="${i}">
      <span class="w-card-i"><img src="${small(w.portret)}" alt="" loading="lazy" decoding="async" style="object-position:${esc(w.fokus || '50% 30%')}"></span>
      <span class="w-card-t"><b>${esc(w.jmeno)}</b><i>${esc(w.role)}</i><em>${sideLabel(w)}${HAS_VOICE.has(w.id) ? ' · hlas' : ''}${HAS_VIDEO[w.id] ? ' · video' : ''}</em></span></button>`).join('');
  }
  function setFilter(f) {
    filter = f;
    $$('[data-f]', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === f));
    const curId = list[cur]?.id;
    list = all.filter((w) => f === 'all' || (f === 'foe' ? w.strana === 'nepřítel' : w.strana !== 'nepřítel'));
    cur = Math.max(-1, list.findIndex((w) => w.id === curId));
    renderPick(); count();
  }
  function count() { $('#wCount', el).textContent = cur >= 0 ? `${cur + 1} / ${list.length}` : `${list.length} svědků`; }

  // ---------- vrstvy obrazu
  function layerHtml(w) {
    const pos = w.fokus || '50% 30%';
    const tall = (D.images[w.portret]?.[1] || 1) > (D.images[w.portret]?.[0] || 1);
    return `<div class="w-bg" style="background-image:url('${small(w.portret)}')"></div>
      <div class="w-img${tall ? ' tall' : ''}"><div class="w-breath">${img(w.portret, { alt: `Portrét: ${w.jmeno}`, sizes: '100vw', pos, eager: true })}</div></div>`;
  }
  function kenBurns(target, dur, fokus = '50% 30%') {
    kb?.cancel();
    if (reduced() || !target) return;
    target.style.transformOrigin = fokus;
    const dx = (Math.random() - 0.5) * 3, dy = (Math.random() - 0.3) * 2;
    kb = target.animate([
      { transform: 'scale(1.04) translate(0,0)' },
      { transform: `scale(1.14) translate(${dx}%, ${dy}%)` },
    ], { duration: Math.max(8000, dur * 1000 + 2500), easing: 'cubic-bezier(.33,.0,.3,1)', fill: 'forwards' });
  }

  // ---------- časování titulků
  function computeStarts(w, dur) {
    const lens = w.text.map((t) => Math.max(1.9, t.length * 0.064) + 0.35);
    const sum = lens.reduce((a, b) => a + b, 0);
    if (Array.isArray(w.casy) && w.casy.length === w.text.length) return { st: w.casy.slice(), tot: dur || (w.casy.at(-1) + lens.at(-1)) };
    const k = dur ? (dur - 0.4) / sum : 1;
    let t = dur ? 0.25 : 0.9; const st = [];
    for (const l of lens) { st.push(t); t += l * k; }
    return { st, tot: dur || t + 0.6 };
  }
  const clock = () => {
    if (video && !video.muted && !audio) return video.currentTime;
    if (audio) return audio.currentTime;
    return state === 'play' ? acc + (performance.now() - t0) / 1000 : acc;
  };

  function showSentence(i, w) {
    const sub = $('#wSub p', el);
    if (i === lastSent) return; lastSent = i;
    sub.classList.remove('in');
    setTimeout(() => { sub.textContent = i >= 0 ? w.text[i] : ''; if (i >= 0) sub.classList.add('in'); }, i === 0 ? 0 : 260);
  }
  function loop() {
    cancelAnimationFrame(raf);
    const w = list[cur];
    const step = () => {
      if (state !== 'play' || !w) return;
      const t = clock();
      let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      showSentence(i, w);
      $('#wProg', el).style.transform = `scaleX(${Math.min(1, t / total)})`;
      $('#wLower', el).classList.toggle('in', t > 0.35 && t < total - 0.4);
      const mediaEnded = (audio && audio.ended) || (video && !audio && !video.muted && video.ended);
      if (t >= total + 0.9 || mediaEnded) { end(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- načtení svědka
  function teardownMedia() {
    if (audio) { audio.pause(); audio.src = ''; audio = null; }
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video = null; }
  }
  async function load(i, { autoplay = true } = {}) {
    clearTimeout(interTimer);
    teardownMedia();
    cancelAnimationFrame(raf);
    cur = (i + list.length) % list.length;
    const w = list[cur];
    $('#wStart', el).classList.add('gone');
    $('#wInter', el).classList.remove('in');
    // prolínačka mezi vrstvami
    const next = layers[1 - front];
    next.innerHTML = layerHtml(w);
    if (HAS_VIDEO[w.id]) {
      video = document.createElement('video');
      video.className = 'w-video'; video.playsInline = true; video.preload = 'auto';
      video.src = `assets/video/${HAS_VIDEO[w.id]}`;
      video.muted = HAS_VOICE.has(w.id) || muted;
      video.loop = HAS_VOICE.has(w.id);
      video.setAttribute('aria-hidden', 'true');
      video.addEventListener('loadeddata', () => next.classList.add('has-video'), { once: true });
      next.appendChild(video);
    }
    next.classList.add('on'); layers[front].classList.remove('on'); front = 1 - front;
    // titulek a popisek
    const lower = $('#wLower', el);
    lower.classList.remove('in');
    lower.classList.toggle('foe', w.strana === 'nepřítel');
    $('.w-side', lower).textContent = sideLabel(w) + (w.hrac ? ` · hraje ${w.hrac}` : '');
    $('.w-name', lower).textContent = w.jmeno;
    $('.w-role', lower).textContent = w.role;
    lastSent = -1; $('#wSub p', el).textContent = ''; $('#wSub p', el).classList.remove('in');
    renderPick(); count(); trans();
    $$('.w-card', el)[cur]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    // délka: audio > video > text
    let dur = 0;
    if (HAS_VOICE.has(w.id)) {
      audio = new Audio(`assets/voices/${VOICE_FILE[w.id]}`);
      audio.preload = 'auto'; audio.muted = muted;
      dur = await new Promise((res) => {
        audio.addEventListener('loadedmetadata', () => res(audio.duration || 0), { once: true });
        audio.addEventListener('error', () => { audio = null; res(0); }, { once: true });
        setTimeout(() => res(audio?.duration || 0), 4000);
      });
      if (dur && HAS_TIMING.has(w.id)) {
        try { const c = await (await fetch(`assets/voices/${w.id}.json`)).json(); if (Array.isArray(c)) w.casy = c; } catch { /* bez časů */ }
      }
    } else if (video && !video.muted) {
      dur = await new Promise((res) => {
        video.addEventListener('loadedmetadata', () => res(video.duration || 0), { once: true });
        video.addEventListener('error', () => res(0), { once: true });
        setTimeout(() => res(video?.duration || 0), 4000);
      });
    }
    if (list[cur] !== w) return; // mezitím přepnuto
    const c = computeStarts(w, dur); starts = c.st; total = c.tot;
    kenBurns($('.w-breath img', next), total, w.fokus);
    acc = 0;
    if (autoplay) play(); else { state = 'pause'; ui(); kb?.pause(); }
  }

  function play() {
    if (cur < 0) { load(0); return; }
    if (state === 'end') { load(cur); return; }
    state = 'play'; t0 = performance.now();
    audio?.play().catch(() => { /* prohlížeč blokuje zvuk; jede se podle textu */ audio = null; });
    video?.play().catch(() => {});
    kb?.play(); stage.classList.remove('paused');
    ui(); loop();
  }
  function pause() {
    if (state !== 'play') return;
    acc = clock(); state = 'pause';
    audio?.pause(); video?.pause(); kb?.pause(); stage.classList.add('paused');
    ui();
  }
  function end() {
    state = 'end'; ui();
    $('#wLower', el).classList.remove('in');
    showSentence(-1, list[cur]);
    if (doc) {
      if (cur >= list.length - 1) { stopDoc(); return; }
      interstitial(cur + 1);
    }
  }
  function ui() {
    $('#wPlay', el).textContent = state === 'play' ? '❚❚' : '▶';
    $('#wPlay', el).setAttribute('aria-label', state === 'play' ? 'Pozastavit' : 'Přehrát');
    $('#wDoc', el).setAttribute('aria-pressed', doc);
    stage.classList.toggle('doc', doc);
  }

  // ---------- prolínačka na obraz bitvy (režim dokumentu)
  function interFor(w) {
    for (const z of w.zdroje || []) {
      const b = D.battleById[z];
      if (b?.images?.length) return { key: 'ilu/' + b.images[0], t: b.name, s: `${b.dr} DR · ${b.place}` };
    }
    for (const z of w.zdroje || []) {
      const s = D.sesById[z];
      if (s?.ilu?.length) return { key: 'ilu/' + s.ilu[0].f, t: s.title, s: `${s.dr_label || ''} · u stolu ${s.date_label}` };
    }
    return null;
  }
  function interstitial(nextI) {
    const w = list[nextI];
    const it = interFor(w);
    if (!it || reduced()) { load(nextI); return; }
    state = 'inter';
    const box = $('#wInter', el);
    box.innerHTML = `${img(it.key, { alt: '', sizes: '100vw', eager: true })}<div class="w-inter-t"><p>${esc(it.s)}</p><h4>${esc(it.t)}</h4></div>`;
    requestAnimationFrame(() => box.classList.add('in'));
    const im = $('img', box);
    im.animate([{ transform: 'scale(1.02)' }, { transform: 'scale(1.1)' }], { duration: 5200, easing: 'linear', fill: 'forwards' });
    interTimer = setTimeout(() => { if (state === 'inter') load(nextI); }, 4200);
  }
  function startDoc() { doc = true; ui(); stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); load(0); }
  function stopDoc() { doc = false; ui(); }

  // ---------- přepis
  function trans() {
    const w = list[cur]; const box = $('#wTrans', el);
    if (!w) { box.innerHTML = ''; return; }
    const src = (w.zdroje || []).map((z) => {
      const s = D.sesById[z]; const b = D.battleById[z];
      if (s) return `<a href="#${s.id}">${esc(s.date_label)} · ${esc(s.title)}</a>`;
      if (b) return `<a href="#${b.id}">${esc(b.name)}</a>`;
      return esc(z);
    });
    box.innerHTML = `<h3>${esc(w.jmeno)}</h3><p class="w-tr-role">${esc(w.role)} · ${sideLabel(w)}</p>
      ${w.text.map((t) => `<p>${esc(t)}</p>`).join('')}<p class="w-tr-src"><b>Opřeno o:</b> ${src.join(' · ')}</p>`;
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
    new IntersectionObserver(([e]) => { on = e.isIntersecting; if (on) requestAnimationFrame(f); else if (state === 'play') pause(); }, { threshold: 0.25 }).observe(stage);
  }

  // ---------- jemný parallax portrétu za myší
  stage.addEventListener('pointermove', (e) => {
    if (reduced() || e.pointerType !== 'mouse') return;
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty('--px', `${(-x * 14).toFixed(1)}px`); stage.style.setProperty('--py', `${(-y * 9).toFixed(1)}px`);
  });

  // ---------- ovládání
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'play') state === 'play' ? pause() : play();
    else if (a === 'prev') { if (doc && state === 'inter') return; load(cur - 1); }
    else if (a === 'next') load(cur + 1);
    else if (a === 'doc') { doc ? stopDoc() : startDoc(); }
    else if (a === 'pick') $('#wPick', el).scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    else if (a === 'mute') {
      muted = !muted; e.target.setAttribute('aria-pressed', muted);
      if (audio) audio.muted = muted; if (video && !HAS_VOICE.has(list[cur]?.id)) video.muted = muted;
    } else if (a === 'trans') {
      const b = e.target.closest('button'); const box = $('#wTrans', el);
      box.hidden = !box.hidden; b.setAttribute('aria-expanded', !box.hidden);
    }
    const f = e.target.closest('[data-f]'); if (f) setFilter(f.dataset.f);
    const card = e.target.closest('.w-card');
    if (card) { stopDoc(); load(+card.dataset.i); stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); }
  });
  stage.addEventListener('click', (e) => {
    if (e.target.closest('button') || state === 'idle') return;
    state === 'play' ? pause() : play();
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === ' ' && document.activeElement === stage) { e.preventDefault(); state === 'play' ? pause() : play(); }
    else if (e.key === 'ArrowRight' && stage.contains(document.activeElement)) load(cur + 1);
    else if (e.key === 'ArrowLeft' && stage.contains(document.activeElement)) load(cur - 1);
    else if (e.key === 'Escape' && doc) stopDoc();
  });
  window.addEventListener('witness:open', (e) => {
    setFilter('all');
    const i = list.findIndex((w) => w.id === e.detail.id);
    stage.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    stopDoc();
    setTimeout(() => load(Math.max(0, i)), 500);
    history.replaceState(null, '', `#svedectvi/${e.detail.id}`);
  });
  window.addEventListener('witness:focus', () => stage.focus({ preventScroll: true }));

  renderPick(); count(); grain();
  // náhled prvního svědka pod úvodní kartou
  layers[0].innerHTML = layerHtml(all[0]); layers[0].classList.add('on', 'idle');
  void largest;
}

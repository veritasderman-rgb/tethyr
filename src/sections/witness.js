// 4. Svědectví (jádro webu, à la „Prelude to Axanar“): jen vedlejší postavy (NPC), nikdy hráčské.
// Dokumentární galerie (Spojenci / Nepřátelé / Mocní Faerûnu s jmenovkami), přehrávač s živým portrétem (video ve smyčce),
// hlasem a titulky po větách podle timing.json. Nic se nepřehrává samo: zvuk startuje až po kliknutí.
// Režim „Dokument“ (celoobrazovkový film) je v sections/film.js.
import media from 'virtual:media';
import { D } from '../lib/data.js';
import { small } from '../lib/img.js';
import { navigate, witPath, syncMeta } from '../lib/router.js';
import { voice, load as loadVoice, stop as stopVoice, unlock, claim, getVolume, setVolume, isMuted, setMuted, onVolume } from '../lib/audio.js';
import { createStage, grain, STAGE_HTML, sideLabel, isFoe, isPast, stavShort, stavTitle, stavInfo, groupOf, subsCs, subMode, setSubMode, SUB_LABEL } from '../lib/wstage.js';
import { $, $$, esc, reduced, plural, settleScroll } from '../lib/util.js';

const baseOf = (f) => f.replace(/\.[^.]+$/, '');
const VOICE_FILE = Object.fromEntries(media.voices.map((f) => [baseOf(f), f]));
const HAS_VIDEO = Object.fromEntries(media.video.map((f) => [baseOf(f), f]));
// video v celé délce se synchronizovanými ústy (assets/video/<id>_plne.mp4, příznak `video_plne` v datech svědka)
const FULL_VIDEO = Object.fromEntries(media.video.filter((f) => /_plne\.[^.]+$/.test(f)).map((f) => [baseOf(f).replace(/_plne$/, ''), f]));
const HAS_TIMING = media.timings.includes('timing.json');
const mmss = (t) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, '0')}`;

// starší odkazy (např. z 3D mapy) na přejmenovaná id
const ALIAS = { khelben: 'khelbenova-dcera' };
const CUTS = {
  all: { label: 'Všichni', f: () => true },
  spojenci: { label: 'Spojenci', f: (w) => groupOf(w) === 'spojenci' },
  nepratele: { label: 'Nepřátelé', f: (w) => groupOf(w) === 'nepratele' },
  mocni: { label: 'Mocní Faerûnu', f: (w) => groupOf(w) === 'mocni' },
};
const GROUPS = [
  { key: 'spojenci', h: 'Spojenci', p: 'Ti, kdo šli s družinou nebo jí podali ruku. Někteří už nežijí.' },
  { key: 'nepratele', h: 'Nepřátelé', p: 'Protivníci, kteří družinu poznali z druhé strany. Neochotně uznávají, pohrdají, nebo lžou sami sobě.' },
  { key: 'mocni', h: 'Mocní Faerûnu', p: 'Vládci, mágové a draci, kteří se dívali z nadhledu a občas zasáhli.' },
];

export function renderWitness() {
  const el = $('#svedectvi');
  const all = D.svedectvi;
  const nFoe = all.filter((w) => groupOf(w) === 'nepratele').length;
  const nMighty = all.filter((w) => groupOf(w) === 'mocni').length;
  const nVoice = all.filter((w) => VOICE_FILE[w.id]).length;
  const nDead = all.filter(isPast).length;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Svědectví</p><h1 id="svedectvi-h" tabindex="-1">Hlasy z obou stran</h1>
    <p class="lead">${all.length} lidí a bytostí, kteří družinu znali: spojenci, ${plural(nFoe, 'nepřítel', 'nepřátelé', 'nepřátel')} a ${plural(nMighty, 'mocný', 'mocní', 'mocných')} Faerûnu. ${nDead ? `${plural(nDead, 'z nich už nežije nebo zmizel', 'z nich už nežijí nebo zmizeli', 'z nich už nežije nebo zmizelo')}, jejich hlas je „z minulosti“. ` : ''}Mluví o tom, co s družinou zažili. Každé slovo se opírá o konkrétní hru, o hráčských postavách mluví ve třetí osobě.</p><div class="orn">✦</div></header>
    <div class="w-stage" id="wStage" tabindex="0" aria-roledescription="přehrávač svědectví" aria-label="Přehrávač svědectví, mezerník přehraje nebo pozastaví">
      ${STAGE_HTML}
      <div class="w-tap" id="wTap" hidden><button class="btn red" data-act="play">▶ Spustit</button></div>
      <div class="w-start" id="wStart">
        <p class="w-start-k">Dokument o jedné družině</p>
        <h3>Svědectví</h3>
        <p class="w-start-p">Přátelé i nepřátelé Tethyrské královské družiny${nVoice ? ' · s hlasem a živým portrétem' : ''}</p>
        <div class="w-start-b"><button class="btn red" data-act="doc">▶ Přehrát celý dokument</button><button class="btn" data-act="first">Začít prvním svědkem</button></div>
      </div>
      <div class="w-nextup" id="wNext" hidden><span></span><button class="btn sm" data-act="cancelnext">Zůstat</button></div>
      <div class="w-prog" id="wProgBox" role="slider" aria-label="Průběh svědectví" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0"><i id="wProg"></i></div>
    </div>
    <div class="w-ctl wrap" role="toolbar" aria-label="Ovládání svědectví">
      <div class="w-ctl-a">
        <button class="btn sm" data-act="prev" aria-label="Předchozí svědek"><span aria-hidden="true">⏮</span></button>
        <button class="btn sm" data-act="back" aria-label="Zpět o deset sekund"><span aria-hidden="true">−10</span></button>
        <button class="btn sm red" data-act="play" id="wPlay" aria-label="Přehrát"><span aria-hidden="true">▶</span></button>
        <button class="btn sm" data-act="fwd" aria-label="Dopředu o deset sekund"><span aria-hidden="true">+10</span></button>
        <button class="btn sm" data-act="next" aria-label="Další svědek"><span aria-hidden="true">⏭</span></button>
        <span class="w-vol"><button class="btn sm ghost" data-act="mute" id="wMute" aria-pressed="false" aria-label="Ztlumit zvuk"><span aria-hidden="true">♪</span></button><input type="range" id="wVol" min="0" max="100" step="1" aria-label="Hlasitost"></span>
        <span class="w-count" id="wCount"></span>
      </div>
      <div class="w-ctl-b" role="group" aria-label="Střih: koho přehrávat jako další">
        <span class="w-cut-l">Střih</span>
        ${Object.entries(CUTS).map(([k, c], i) => `<button class="btn sm" data-f="${k}" aria-pressed="${i === 0}">${c.label}</button>`).join('')}
        <button class="btn sm ghost" data-act="auto" id="wAuto" aria-pressed="true" title="Po skončení svědectví automaticky pokračovat dalším ve zvoleném střihu">Automaticky další</button>
      </div>
      <div class="w-ctl-c">
        <button class="btn sm red" data-act="doc" id="wDoc">▶ Celý dokument</button>
        <span class="w-cc" role="group" aria-label="Titulky (hlas je anglicky)"><span class="w-cc-l" aria-hidden="true">Titulky</span>${['cs', 'en', 'off'].map((m) => `<button class="btn sm ghost" data-cc="${m}" aria-pressed="${subMode() === m}">${SUB_LABEL[m]}</button>`).join('')}</span>
        <button class="btn sm ghost" data-act="trans" aria-expanded="false" aria-controls="wTrans">Přepis</button>
      </div>
    </div>
    <div class="w-info wrap-text" id="wInfo" aria-live="polite"></div>
    <div class="w-trans wrap-text" id="wTrans" hidden></div>
    <div class="w-gal wrap" id="wGal"></div>`;

  const stageEl = $('#wStage', el);
  const stage = createStage(stageEl);
  const setGrain = grain(stageEl);
  let filter = 'all';
  let list = all.slice();
  let cur = -1;           // index v `list`
  let curId = '';         // právě načtený svědek (i mimo střih)
  let state = 'idle';     // idle | play | pause | end
  let auto = true;
  let hasAudio = false;
  let acc = 0, t0 = 0, total = 0, starts = [], raf = 0, nextTimer = 0, nextTick = 0;
  let timing = null;
  let loadToken = 0;

  const timingP = HAS_TIMING ? fetch('assets/voices/timing.json').then((r) => r.json()).then((t) => { timing = t; renderGal(); }).catch(() => {}) : Promise.resolve();

  // ---------- galerie
  const firstSentence = (s) => { const m = String(s || '').match(/^.+?[.!?](\s|$)/); return m ? m[0].trim() : s; };
  function card(w) {
    const dur = timing?.[w.id]?.duration;
    const past = isPast(w);
    return `<button class="wc${isFoe(w) ? ' foe' : ''}${past ? ' past' : ''}${w.id === curId ? ' on' : ''}" data-id="${esc(w.id)}" aria-label="Přehrát svědectví: ${esc(w.jmeno)}, ${esc(w.role)}${past ? `, ${esc(stavShort(w))}` : ''}">
      <span class="wc-ph"><img src="${small(w.portret)}" alt="" loading="lazy" decoding="async" style="object-position:${esc(w.fokus || '50% 30%')}">
        ${past ? `<span class="wc-x" aria-hidden="true"><b>${w.stav === 'zmizel' ? '?' : '†'}</b>${stavInfo(w)?.rok ? `${stavInfo(w).rok} DR` : ''}</span>` : ''}
        <span class="wc-play" aria-hidden="true">▶</span></span>
      <span class="wc-plate">
        <i class="wc-side">${esc(sideLabel(w))}</i>
        <b class="wc-name">${esc(w.jmeno)}</b>
        <em class="wc-role">${esc(w.role)}</em>
        <small class="wc-vaz">${esc(firstSentence(w.vazba))}</small>
        <span class="wc-meta"><span class="wc-st">${past ? esc(stavShort(w)) : 'žije'}</span>${dur ? `<span>${mmss(dur)}</span>` : ''}${VOICE_FILE[w.id] ? '<span>hlas</span>' : ''}${HAS_VIDEO[w.id] ? '<span>video</span>' : ''}</span>
      </span></button>`;
  }
  function renderGal() {
    $('#wGal', el).innerHTML = GROUPS.map((g) => {
      const items = all.filter((w) => groupOf(w) === g.key);
      const hide = filter !== 'all' && filter !== g.key;
      return `<section class="wg${hide ? ' off' : ''}" data-g="${g.key}" aria-labelledby="wg-${g.key}"><header class="wg-h"><h3 id="wg-${g.key}">${g.h} <span>${items.length}</span></h3><p>${g.p}</p></header>
        <div class="wg-grid">${items.map(card).join('')}</div></section>`;
    }).join('');
  }
  function setFilter(f) {
    filter = f;
    $$('[data-f]', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.f === f));
    list = all.filter(CUTS[f].f);
    cur = list.findIndex((w) => w.id === curId);
    renderGal(); count();
  }
  function count() {
    const c = $('#wCount', el);
    c.textContent = cur >= 0 ? `${cur + 1} / ${list.length}` : `${list.length} svědků`;
  }
  function markOn() { $$('.wc', el).forEach((b) => b.classList.toggle('on', b.dataset.id === curId)); }

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
  const clock = () => (hasAudio ? voice.currentTime : state === 'play' ? acc + (performance.now() - t0) / 1000 : acc);
  const curW = () => D.witById[curId];

  function loop() {
    cancelAnimationFrame(raf);
    const w = curW();
    const step = () => {
      if (state !== 'play' || !w) return;
      const t = clock();
      stage.sync(t, !(hasAudio && voice.paused));
      let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      stage.setSub(i, w);
      const p = Math.min(1, t / total);
      $('#wProg', el).style.transform = `scaleX(${p})`;
      $('#wProgBox', el).setAttribute('aria-valuenow', Math.round(p * 100));
      stage.lower.classList.toggle('in', t > 0.35 && t < total - 0.5);
      if ((hasAudio && voice.ended) || t >= total + 0.9) { end(); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- načtení svědka
  async function loadW(w, { autoplay = true } = {}) {
    const tok = ++loadToken;
    cancelNext();
    stopVoice(); hasAudio = false;
    cancelAnimationFrame(raf);
    curId = w.id;
    if (document.body.dataset.page === 'svedectvi' && location.pathname !== witPath(w.id)) { history.replaceState(history.state, '', witPath(w.id)); syncMeta(); }
    const ix = list.findIndex((x) => x.id === w.id); cur = ix;
    $('#wStart', el).classList.add('gone');
    $('#wTap', el).hidden = true;
    const fullV = w.video_plne && FULL_VIDEO[w.id];
    const m = stage.setWitness(w, { useVideo: true, video: fullV ? `assets/video/${fullV}` : HAS_VIDEO[w.id] ? `assets/video/${HAS_VIDEO[w.id]}` : '', full: !!fullV });
    $('#wProg', el).style.transform = 'scaleX(0)';
    markOn(); count(); info(w); trans(w); ui();
    let dur = 0;
    await timingP;
    if (tok !== loadToken) return;
    if (VOICE_FILE[w.id]) { dur = await loadVoice(`assets/voices/${VOICE_FILE[w.id]}`); hasAudio = dur > 0; }
    if (tok !== loadToken) return; // mezitím přepnuto
    const c = computeStarts(w, dur); starts = c.st; total = c.tot;
    if (!m.video) stage.ken(m.img, total, w.fokus);
    acc = 0; state = 'pause';
    if (autoplay) play();
    else { ui(); stage.freeze(true); $('#wTap', el).hidden = false; }
  }

  function play() {
    if (state === 'idle') { const w = list[Math.max(cur, 0)] || list[0]; if (w) loadW(w); return; }
    if (state === 'end') { const w = curW(); if (w) loadW(w); return; }
    cancelNext();
    claim('svedectvi', pause);
    state = 'play'; t0 = performance.now();
    $('#wTap', el).hidden = true;
    if (hasAudio) {
      voice.onended = () => { if (state === 'play') end(); };
      voice.play().catch(() => { // prohlížeč zvuk zablokoval: počkáme na klepnutí
        if (state !== 'play') return;
        state = 'pause'; acc = voice.currentTime; stage.freeze(true); ui(); $('#wTap', el).hidden = false;
      });
    }
    stage.freeze(false); stage.playVideo();
    ui(); loop();
  }
  function pause() {
    cancelNext();
    if (state !== 'play') return;
    acc = clock(); state = 'pause';
    voice.pause(); stage.freeze(true); stage.sync(acc, false);
    ui();
  }
  const toggle = () => (state === 'play' ? pause() : play());
  function end() {
    state = 'end'; ui();
    stage.lower.classList.remove('in');
    stage.setSub(-1, null);
    $('#wProg', el).style.transform = 'scaleX(1)';
    // automatické pokračování dalším svědkem ve zvoleném střihu
    if (auto && cur >= 0 && cur < list.length - 1) {
      const nx = list[cur + 1];
      const box = $('#wNext', el); let left = 4;
      const say = () => { $('span', box).textContent = `Další svědek: ${nx.jmeno} · ${left}`; };
      say(); box.hidden = false;
      nextTick = setInterval(() => { left -= 1; if (left > 0) say(); }, 1000);
      nextTimer = setTimeout(() => { cancelNext(); loadW(nx); }, 4000);
    }
  }
  function cancelNext() { clearTimeout(nextTimer); clearInterval(nextTick); nextTimer = nextTick = 0; $('#wNext', el).hidden = true; }
  function ui() {
    const playing = state === 'play';
    const p = $('#wPlay', el);
    $('span', p).textContent = playing ? '❚❚' : '▶';
    p.setAttribute('aria-label', playing ? 'Pozastavit' : 'Přehrát');
    $('#wAuto', el).setAttribute('aria-pressed', auto);
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
      ${subsCs(w).map((t) => `<p>${esc(t)}</p>`).join('')}
      ${w.jazyk === 'en' ? `<details class="w-tr-en"><summary>Anglický originál (namluvené znění)</summary>${w.text.map((t) => `<p lang="en">${esc(t)}</p>`).join('')}</details>` : ''}`;
  }

  // ---------- zrno a pauza mimo obrazovku
  new IntersectionObserver(([e]) => { setGrain(e.isIntersecting); if (!e.isIntersecting && state === 'play') pause(); }, { threshold: 0.2 }).observe(stageEl);
  window.addEventListener('film:opened', () => { pause(); setGrain(false); });

  // ---------- jemný parallax portrétu za myší
  stageEl.addEventListener('pointermove', (e) => {
    if (reduced() || e.pointerType !== 'mouse') return;
    const r = stageEl.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    stageEl.style.setProperty('--px', `${(-x * 14).toFixed(1)}px`); stageEl.style.setProperty('--py', `${(-y * 9).toFixed(1)}px`);
  });

  // ---------- posuv
  function seekTo(t) {
    if (state === 'idle' || !total) return;
    t = Math.max(0, Math.min(total - 0.2, t));
    if (hasAudio) voice.currentTime = t; else { acc = t; t0 = performance.now(); }
    stage.clearSub(); stage.sync(t, state === 'play');
    if (state === 'end') { state = 'pause'; play(); return; }
    let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
    stage.setSub(i, curW()); $('#wProg', el).style.transform = `scaleX(${t / total})`;
  }
  $('#wProgBox', el).addEventListener('click', (e) => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    seekTo(((e.clientX - r.left) / r.width) * total);
  });
  $('#wProgBox', el).addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.stopPropagation(); e.preventDefault(); seekTo(clock() + 5); }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); e.preventDefault(); seekTo(clock() - 5); }
  });

  // ---------- hlasitost
  const volEl = $('#wVol', el), muteEl = $('#wMute', el);
  const syncVol = () => { volEl.value = Math.round(getVolume() * 100); muteEl.setAttribute('aria-pressed', isMuted()); $('span', muteEl).textContent = isMuted() || getVolume() === 0 ? '✕' : '♪'; };
  volEl.addEventListener('input', () => setVolume(volEl.value / 100));
  onVolume(syncVol); syncVol();

  // ---------- ovládání
  function step(dir) {
    unlock();
    if (!list.length) return;
    const base = cur >= 0 ? cur : (dir > 0 ? -1 : 0);
    const i = (base + dir + list.length) % list.length;
    loadW(list[i]);
  }
  const scrollToStage = () => stageEl.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  el.addEventListener('click', (e) => {
    const cc = e.target.closest('[data-cc]');
    if (cc) { setSubMode(cc.dataset.cc); return; }
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (a === 'play') toggle();
    else if (a === 'prev') step(-1);
    else if (a === 'next') step(1);
    else if (a === 'back') seekTo(clock() - 10);
    else if (a === 'fwd') seekTo(clock() + 10);
    else if (a === 'first') { const w = list[0]; if (w) { loadW(w); } }
    else if (a === 'doc') navigate('/dokument', { gesture: true });
    else if (a === 'cancelnext') { cancelNext(); }
    else if (a === 'auto') { auto = !auto; if (!auto) cancelNext(); ui(); }
    else if (a === 'mute') setMuted(!isMuted());
    else if (a === 'trans') {
      const b = e.target.closest('button'); const box = $('#wTrans', el);
      box.hidden = !box.hidden; b.setAttribute('aria-expanded', !box.hidden);
    }
    const f = e.target.closest('[data-f]'); if (f) setFilter(f.dataset.f);
    const c = e.target.closest('.wc');
    if (c) { const w = D.witById[c.dataset.id]; if (w) { if (!list.some((x) => x.id === w.id)) setFilter('all'); loadW(w); scrollToStage(); } }
    const so = e.target.closest('.w-srcs a');
    if (so) pause();
  });
  stageEl.addEventListener('click', (e) => {
    if (e.target.closest('button, .w-prog') || state === 'idle') return;
    toggle();
  });
  el.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea')) return;
    const inStage = stageEl.contains(document.activeElement);
    if (e.key === ' ' && document.activeElement === stageEl) { e.preventDefault(); toggle(); }
    else if (e.key === 'ArrowRight' && inStage && !e.target.closest('.w-prog')) step(1);
    else if (e.key === 'ArrowLeft' && inStage && !e.target.closest('.w-prog')) step(-1);
  });
  window.addEventListener('witness:open', (e) => {
    const w = D.witById[e.detail.id] || D.witById[ALIAS[e.detail.id]]; if (!w) return;
    if (!list.some((x) => x.id === w.id)) setFilter('all');
    const auto0 = e.detail.autoplay !== false;
    // hluboký odkaz i proklik: oddíly mezi tím se ještě skládají (líné vykreslení), proto poloha dorovnávat
    settleScroll(stageEl, { smooth: auto0 });
    // zvuk je odemčený při prvním doteku kdekoli na stránce (lib/audio.js); prodleva jen pro dojezd posunu
    setTimeout(() => loadW(w, { autoplay: auto0 }), auto0 ? 350 : 450);
  });
  window.addEventListener('submode', (e) => $$('[data-cc]', el).forEach((b) => b.setAttribute('aria-pressed', b.dataset.cc === e.detail)));
  window.addEventListener('witness:focus', () => stageEl.focus({ preventScroll: true }));

  renderGal(); count(); ui();
  // náhled prvního svědka pod úvodní kartou
  const first = stage.setWitness(all[0], { useVideo: false });
  first.layer.classList.add('idle');
  stage.lower.classList.remove('in');
  $('#wInfo', el).innerHTML = '';
  // odchod na jinou stránku: zastavit (skrytý přehrávač by jinak hrál dál)
  window.addEventListener('page:change', (e) => { if (e.detail.from === 'svedectvi') { pause(); cancelNext(); } });
  window.__wit = { get state() { return state; }, get cur() { return curId; }, voice };
}

/** Vstup na stránku /svedectvi/<id>: otevřít svědka. Po kliknutí (gesto) hned hraje, při přímém otevření adresy čeká na klepnutí. */
export function enter(r, ctx = {}) {
  if (!r.sub) return;
  window.dispatchEvent(new CustomEvent('witness:open', { detail: { id: r.sub, autoplay: !!ctx.gesture && !ctx.pop && ctx.state?.autoplay !== false } }));
}

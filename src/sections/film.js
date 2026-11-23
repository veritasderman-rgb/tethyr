// Režim „Dokument“: celoobrazovkový film (~15 minut) poskládaný z dat kroniky.
// Úvodní titulek → pět knih (titulek knihy, mapa s trasou, malby s pomalým pohybem kamery, svědkové přítel i nepřítel,
// mezititulek s letopočtem) → finále (Rivalen, Elminster) → závěrečná karta → poděkování Pánu jeskyně → hymna (videoklip).
// Ovládání: mezerník, šipky (←/→ ±10 s, Shift+←/→ scéna), ↑/↓ hlasitost, C titulky, M zvuk, F celá obrazovka, Esc zavřít,
// časová lišta s kapitolami. Svědkové jsou jen vedlejší postavy (nikdy hráčské). Nic se nespouští samo bez kliknutí.
import media from 'virtual:media';
import { H } from '../lib/router.js';
import DOC from '../../data/dokument.json';
import TXT from '../../data/podekovani.txt?raw';
import HY from '../../data/hymna.json';
import { D, need } from '../lib/data.js';
import { img } from '../lib/img.js';
import { routeSvg } from '../lib/minimap.js';
import { voice, load as loadVoice, stop as stopVoice, unlock, claim, getVolume, setVolume, isMuted, setMuted, onVolume } from '../lib/audio.js';
import { createStage, grain, STAGE_HTML, sideLabel, subMode, setSubMode, SUB_LABEL } from '../lib/wstage.js';
import { $, $$, esc, reduced } from '../lib/util.js';

const baseOf = (f) => f.replace(/\.[^.]+$/, '');
const VOICE_FILE = Object.fromEntries(media.voices.map((f) => [baseOf(f), f]));
const HAS_VIDEO = Object.fromEntries(media.video.map((f) => [baseOf(f), f]));
const HAS_CLIP = (media.klip || []).includes('rauko_klip.mp4');
const mmss = (t) => { t = Math.max(0, Math.round(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DUR = { title: 8, book: 4.5, map: 6.5, paint: 4.8, year: 5, end: 5.5, thanks: 34, tail: 1.1 };
const ROMAN_NAME = { I: 'první', II: 'druhá', III: 'třetí', IV: 'čtvrtá', V: 'pátá' };

let root = null, api = null, built = false, loading = null;

/** Otevře film (volá ho router při vstupu na adresu /dokument, viz lib/filmhook.js). */
export function openFilm(opts = {}) { return open(opts); }
/** Zavře film bez zásahu do adresy (router odchází jinam). */
export function closeFilm() { api?.close('', true); }
async function open(opts = {}) {
  unlock();
  if (!api) {
    if (!loading) loading = (async () => {
      await need('images', 'svedectvi', 'books', 'map', 'sessions', 'world');
      let timing = null;
      try { timing = await (await fetch('assets/voices/timing.json')).json(); } catch { /* bez časů: odhad podle textu */ }
      api = create(timing);
    })();
    try { await loading; } catch (e) { console.error('film', e); loading = null; return; }
  }
  api.open(opts);
}

// ======================================================================== scénář
function scenario(timing) {
  const segs = [];
  const chapters = [];
  const addCh = (id, label, short) => { chapters.push({ id, label, short }); return chapters.length - 1; };
  const sv = (id, ch, book) => {
    const w = D.witById[id]; if (!w) return;
    let dur = timing?.[id]?.duration;
    if (!dur) dur = w.text.reduce((a, t) => a + Math.max(1.9, t.length * 0.064) + 0.35, 0.9);
    segs.push({ type: 'sv', ch, id, dur: dur + DUR.tail, label: `${w.jmeno} · ${sideLabel(w)}`, book });
  };
  const caption = (key) => {
    for (const b of D.books) for (const c of b.chapters) for (const g of c.gallery) if (g.k === key) return { cap: g.cap, s: g.s };
    for (const bt of D.world.battles) if (bt.images?.some((i) => `ilu/${i}` === key)) return { cap: `${bt.name}${bt.dr ? ` · ${bt.dr} DR` : ''}`, s: bt.id };
    return { cap: '' };
  };

  const c0 = addCh('uvod', 'Úvod', 'Úvod');
  segs.push({ type: 'title', ch: c0, dur: DUR.title, label: 'Západní draci' });

  DOC.knihy.forEach((k, bi) => {
    const b = D.books.find((x) => x.key === k.key); if (!b) return;
    const ch = addCh('kniha-' + k.key, `Kniha ${k.key} · ${b.title}`, k.key);
    const chap = b.chapters.find((c) => c.id === k.ch) || b.chapters[0];
    segs.push({ type: 'book', ch, dur: DUR.book, b, label: `${b.kap}: ${b.title}` });
    if (routeSvg(chap.route, { aspect: 1.6 })) segs.push({ type: 'map', ch, dur: DUR.map, b, chap, label: `Trasa: ${chap.title}` });
    k.malby.forEach((key, i) => segs.push({ type: 'paint', ch, dur: DUR.paint, key, n: bi * 3 + i, ...caption(key), label: 'Malba' }));
    k.sv.forEach((id) => sv(id, ch, b));
    segs.push({ type: 'year', ch, dur: DUR.year, rok: k.rok, b, label: k.rok.r });
  });

  const cf = addCh('finale', 'Finále', 'Finále');
  segs.push({ type: 'paint', ch: cf, dur: DUR.paint, key: DOC.finale.malba, n: 20, ...caption(DOC.finale.malba), label: 'Malba' });
  DOC.finale.sv.forEach((id) => sv(id, cf, D.books[4]));
  segs.push({ type: 'end', ch: cf, dur: DUR.end, label: 'Konec' });

  const cp = addCh('podekovani', 'Poděkování', 'Dík');
  segs.push({ type: 'thanks', ch: cp, dur: DUR.thanks, label: 'Poděkování Pánu jeskyně' });

  if (HAS_CLIP) {
    const chh = addCh('hymna', 'Hymna „Rauko“', 'Hymna');
    segs.push({ type: 'hymn', ch: chh, dur: HY.delka || 360, label: 'Hymna „Rauko“' });
  }
  let t = 0;
  for (const s of segs) { s.at = t; t += s.dur; }
  chapters.forEach((c, i) => { const ss = segs.filter((s) => s.ch === i); c.at = ss[0].at; c.dur = ss.reduce((a, s) => a + s.dur, 0); });
  return { segs, chapters, total: t };
}

function parseThanks() {
  const lines = TXT.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const title = lines.shift();
  const paras = []; let cur = [];
  for (const l of lines) { if (l) cur.push(l); else if (cur.length) { paras.push(cur.join(' ')); cur = []; } }
  if (cur.length) paras.push(cur.join(' '));
  return { title, paras };
}

// ======================================================================== film
function create(timing) {
  const SC = scenario(timing);
  const { segs, chapters, total } = SC;
  const HYL = HY.sekce.flatMap((s) => s.lines.map((l) => ({ t: l.t, x: l.x, label: s.label }))).sort((a, b) => a.t - b.t);

  root = document.createElement('div');
  root.id = 'film'; root.className = 'film'; root.hidden = true;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Dokument: kronika Tethyrské královské družiny');
  root.tabIndex = -1;
  root.innerHTML = `
    <div class="f-stage m-none" id="fStage">${STAGE_HTML}</div>
    <div class="f-scene" id="fScene" aria-live="off"></div>
    <div class="f-lyr" id="fLyr" aria-live="polite"><p></p></div>
    <div class="f-cover" aria-hidden="true"></div>
    <div class="f-load" id="fLoad" hidden>Načítám…</div>
    <div class="f-ui" id="fUi">
      <div class="f-top"><p class="f-where" id="fWhere" aria-live="off"></p><button class="f-b f-x" data-a="close" aria-label="Zavřít dokument (Esc)"><span aria-hidden="true">✕</span></button></div>
      <button class="f-big" data-a="play" id="fBig" aria-label="Přehrát"><span aria-hidden="true">▶</span></button>
      <div class="f-bar">
        <div class="f-tl" id="fTl" role="slider" tabindex="0" aria-label="Časová lišta dokumentu, šipky posouvají o deset sekund" aria-valuemin="0" aria-valuemax="${Math.round(total)}" aria-valuenow="0" aria-valuetext="0:00">
          ${chapters.map((c, i) => `<div class="f-tl-c" data-c="${i}" style="flex:${c.dur.toFixed(2)} 1 0"><i class="f-tl-f"></i><span class="f-tl-l" title="${esc(c.label)}"><b>${esc(c.short)}</b><em>${esc(c.label)}</em></span></div>`).join('')}
          ${segs.map((s, i) => s.type === 'sv' ? `<u class="f-tl-t" style="left:${((s.at + 0.3) / total * 100).toFixed(3)}%" data-i="${i}"></u>` : '').join('')}
        </div>
        <div class="f-ctl" role="toolbar" aria-label="Ovládání dokumentu">
          <button class="f-b" data-a="prev" aria-label="Předchozí scéna (Shift + ←)"><span aria-hidden="true">⏮</span></button>
          <button class="f-b" data-a="back" aria-label="Zpět o deset sekund (←)"><span aria-hidden="true">−10</span></button>
          <button class="f-b f-p" data-a="play" id="fPlay" aria-label="Přehrát (mezerník)"><span aria-hidden="true">▶</span></button>
          <button class="f-b" data-a="fwd" aria-label="Dopředu o deset sekund (→)"><span aria-hidden="true">+10</span></button>
          <button class="f-b" data-a="next" aria-label="Další scéna (Shift + →)"><span aria-hidden="true">⏭</span></button>
          <span class="f-time" id="fTime">0:00 / ${mmss(total)}</span>
          <span class="f-sp"></span>
          <span class="f-vol"><button class="f-b" data-a="mute" id="fMute" aria-pressed="false" aria-label="Ztlumit (M)"><span aria-hidden="true">♪</span></button><input type="range" id="fVol" min="0" max="100" aria-label="Hlasitost"></span>
          <button class="f-b f-cc" data-a="cc" id="fCc" aria-pressed="true" aria-label="Titulky zapnuty (C)"><span aria-hidden="true">CC</span></button>
          <button class="f-b" data-a="fs" id="fFs" aria-label="Celá obrazovka (F)"><span aria-hidden="true">⛶</span></button>
        </div>
      </div>
    </div>
    <div class="f-start" id="fStart">
      <p class="f-k">Dokument o jedné družině</p>
      <h2>Západní draci</h2>
      <p class="f-sub">Přátelé i nepřátelé Tethyrské královské družiny vzpomínají do kamery · ${mmss(total - (segs.find((s) => s.type === 'hymn')?.dur || 0))} filmu${HAS_CLIP ? ` a hymna (${mmss(segs.find((s) => s.type === 'hymn')?.dur || 0)})` : ''}</p>
      <div class="f-start-b"><button class="btn red f-go" data-a="go"><span aria-hidden="true">▶</span> Spustit dokument</button><button class="btn" data-a="close">Zavřít</button></div>
      <p class="f-tip">Mezerník pauza · ← → o deset sekund · Shift + ← → scéna · C titulky · F celá obrazovka · Esc zavřít</p>
    </div>
    <div class="f-done" id="fDone" hidden>
      <p class="f-k">Konec dokumentu</p>
      <h2>Kronika Tethyrské královské družiny</h2>
      <div class="f-start-b"><button class="btn red" data-a="again">Přehrát znovu</button><a class="btn" href="${H(`#podekovani`)}" data-a="close">Poděkování</a><a class="btn" href="${H(`#hymna`)}" data-a="close">Hymna</a><button class="btn" data-a="close">Zavřít</button></div>
    </div>`;
  document.body.appendChild(root);

  const $s = (s) => $(s, root);
  const stageEl = $s('#fStage'), scene = $s('#fScene'), ui = $s('#fUi'), lyr = $s('#fLyr p');
  const stage = createStage(stageEl);
  const setGrain = grain(stageEl);

  // ---------------- stav
  let idx = -1, segOff = 0, playing = false, busy = false, started = false, finished = false;
  let base = 0, t0 = 0, raf = 0, tok = 0, hideT = 0, sceneAnims = [], opener = null, prevHash = '';
  let hasAudio = false, starts = [], wDur = 0, hv = null, cc = true, anim = null;

  const cur = () => segs[idx];
  const segTime = () => {
    const s = cur(); if (!s) return 0;
    if (s.type === 'sv' && hasAudio) return voice.currentTime;
    if (s.type === 'hymn' && hv) return hv.currentTime;
    return playing && !busy ? base + (performance.now() - t0) / 1000 : base;
  };
  const globalT = () => (cur() ? cur().at + Math.min(segTime(), cur().dur) : 0);

  // ---------------- scény
  const imgFull = (key, alt, cls = '') => img(key, { alt, sizes: '100vw', eager: true, cls });
  function sceneHtml(s) {
    if (s.type === 'title') {
      return `<div class="fs fs-title"><div class="fs-bg">${imgFull(DOC.uvod.bg, 'Čtyři postavy na útesu nad mořem, nad nimi draci a pevnost v dálce.', 'fs-pan')}</div><div class="fs-shade"></div>
        <div class="fs-in"><p class="fs-k fs-a" style="--d:.8s">${esc(DOC.uvod.k)}</p><h2 class="fs-h fs-a" style="--d:1.8s">${esc(DOC.uvod.t)}</h2><p class="fs-m fs-a" style="--d:3.4s">${esc(DOC.uvod.r)}</p></div></div>`;
    }
    if (s.type === 'book') {
      const b = s.b;
      return `<div class="fs fs-book"><div class="fs-bg">${imgFull('ilu/' + b.img, '', 'fs-pan')}</div><div class="fs-shade"></div>
        <div class="fs-in"><p class="fs-k fs-a" style="--d:.3s">${esc(b.kap)}</p><h2 class="fs-h fs-a" style="--d:.8s">${esc(b.title)}</h2><p class="fs-m fs-a" style="--d:1.6s">${esc(b.dr)} · u stolu ${esc(b.real)}</p></div></div>`;
    }
    if (s.type === 'map') {
      const asp = innerWidth / innerHeight;
      const r = routeSvg(s.chap.route, { cls: 'wi', aspect: Math.min(2.4, Math.max(1, asp)), pad: 90, padTop: 170, minW: 700, dim: 0.5 });
      // na výšku (telefon): když se trasa vejde do středního výřezu, mapa vyplní celou obrazovku, jinak se zobrazí celá s okraji
      if (r && asp < 1 && r.box.rw * 1.2 <= r.box.h * asp) r.svg = r.svg.replace('xMidYMid meet', 'xMidYMid slice');
      return `<div class="fs fs-map">${r ? r.svg : ''}<div class="fs-cap"><p class="fs-k">${esc(s.b.kap)} · ${esc(s.chap.drs || s.b.dr)} · u stolu ${esc(s.chap.real)}</p><h3>${esc(s.chap.title)}</h3>${r ? `<span class="fs-pl">${esc(r.names.slice(0, 7).join(' · '))}</span>` : ''}</div></div>`;
    }
    if (s.type === 'paint') {
      return `<div class="fs fs-paint"><div class="fs-bg">${imgFull(s.key, s.cap || 'Malba z kroniky', 'fs-pan')}</div><div class="fs-shade fs-low"></div>
        ${s.cap ? `<div class="fs-cap"><p class="fs-k fs-a" style="--d:.6s">Malba z kroniky</p><h3 class="fs-a" style="--d:.9s">${esc(s.cap)}</h3></div>` : ''}</div>`;
    }
    if (s.type === 'year') {
      return `<div class="fs fs-year"><div class="fs-in"><p class="fs-y fs-a" style="--d:.2s">${esc(s.rok.r)}</p><i class="fs-line fs-a" style="--d:.9s"></i><p class="fs-t fs-a" style="--d:1.4s">${esc(s.rok.t)}</p></div></div>`;
    }
    if (s.type === 'end') {
      return `<div class="fs fs-end"><div class="fs-in"><p class="fs-k fs-a" style="--d:.3s">${esc(DOC.konec.k)}</p><h2 class="fs-h fs-a" style="--d:.8s">${esc(DOC.konec.t)}</h2><p class="fs-m fs-a" style="--d:1.8s">${esc(DOC.konec.r)}</p></div></div>`;
    }
    if (s.type === 'thanks') {
      const { title, paras } = parseThanks();
      const sign = paras[paras.length - 1], last = paras[paras.length - 2];
      return `<div class="fs fs-thanks"><div class="fs-roll"><p class="fs-k">${esc(title)}</p>
        <p class="to">${esc(paras[0])}</p>${paras.slice(1, -2).map((p) => `<p>${esc(p)}</p>`).join('')}<p class="last">${esc(last)}</p><p class="sign">${esc(sign)}</p></div></div>`;
    }
    if (s.type === 'hymn') {
      return `<div class="fs fs-hymn"><video class="fs-vid" playsinline preload="auto" poster="${DOC.hymna.poster}" aria-label="Videoklip k hymně Rauko"></video></div>`;
    }
    return '';
  }
  function sceneAnimate(s, off) {
    // pomalý pohyb kamery přes malbu / obálku
    const im = $('.fs-pan', scene);
    if (im && !reduced()) {
      const dir = (s.n ?? (s.type === 'book' ? 1 : 0)) % 2 ? -1 : 1;
      im.animate([
        { transform: `scale(1.04) translate(${-1.6 * dir}%, ${1.2}%)` },
        { transform: `scale(${s.type === 'paint' ? 1.17 : 1.12}) translate(${1.8 * dir}%, ${-1.4}%)` },
      ], { duration: s.dur * 1000 + 800, easing: 'linear', fill: 'both' });
    }
    // titulky na závěr: textový „roll“
    const roll = $('.fs-roll', scene);
    if (roll) {
      const h = roll.offsetHeight, vh = scene.clientHeight;
      const endY = -Math.max(0, h - vh * 0.52);
      roll.animate([{ transform: `translateY(${vh * 0.92}px)`, offset: 0 }, { transform: `translateY(${endY}px)`, offset: 0.86 }, { transform: `translateY(${endY}px)`, offset: 1 }],
        { duration: s.dur * 1000, easing: 'linear', fill: 'both' });
    }
    sceneAnims = scene.getAnimations({ subtree: true });
    sceneAnims.forEach((a) => { a.currentTime = off * 1000; if (!playing) a.pause(); });
  }

  // ---------------- vstup do segmentu
  function enableUi() {
    const s = cur();
    const ch = chapters[s.ch];
    $s('#fWhere').innerHTML = `<b>${esc(ch.label)}</b><span>${esc(s.label || '')}</span>`;
  }
  async function enter(i, off = 0) {
    const my = ++tok;
    busy = true; idx = i; segOff = off; finished = false; base = off; t0 = performance.now(); lastTl = -1;
    root.classList.remove('is-done'); $s('#fDone').hidden = true;
    enableUi(); paintTl(off);
    root.classList.add('cut');
    if (started && !reduced()) await sleep(340);
    if (my !== tok) return;
    teardown();
    const s = cur();
    root.dataset.type = s.type;
    stageEl.classList.toggle('m-none', s.type !== 'sv');
    scene.style.display = s.type === 'sv' ? 'none' : '';
    lyr.textContent = ''; lyr.classList.remove('in');
    let readyCb = null;
    if (s.type === 'sv') {
      const w = D.witById[s.id];
      const fullV = w.video_plne && HAS_VIDEO[s.id + '_plne'];
      const m = stage.setWitness(w, { useVideo: true, video: fullV ? `assets/video/${fullV}` : HAS_VIDEO[s.id] ? `assets/video/${HAS_VIDEO[s.id]}` : '', full: !!fullV });
      const t = timing?.[s.id];
      starts = t && t.starts?.length === w.text.length ? t.starts.slice() : (() => { const lens = w.text.map((x) => Math.max(1.9, x.length * 0.064) + 0.35); let tt = 0.9; return lens.map((l) => { const a = tt; tt += l; return a; }); })();
      hasAudio = false;
      if (VOICE_FILE[s.id]) {
        $s('#fLoad').hidden = false;
        const d = await loadVoice(`assets/voices/${VOICE_FILE[s.id]}`);
        if (my !== tok) return;
        $s('#fLoad').hidden = true;
        hasAudio = d > 0; wDur = d;
      }
      voice.onended = () => { if (my === tok && playing) next(); };
      if (!m.video) stage.ken(m.img, s.dur, w.fokus);
      if (off > 0) { if (hasAudio) voice.currentTime = Math.min(off, wDur - 0.2); }
      stage.freeze(!playing); if (playing) { if (hasAudio) await voice.play().catch(() => blocked()); stage.playVideo(); }
      preloadAhead(i);
    } else if (s.type === 'hymn') {
      scene.innerHTML = sceneHtml(s);
      hv = $('.fs-vid', scene);
      hv.src = DOC.hymna.video; hv.volume = getVolume(); hv.muted = isMuted();
      hv.addEventListener('ended', () => { if (my === tok) next(); });
      hv.addEventListener('error', () => { if (my === tok) { hv = null; finish(); } });
      await new Promise((res) => { hv.addEventListener('loadedmetadata', res, { once: true }); setTimeout(res, 7000); });
      if (my !== tok) return;
      if (off > 0) hv.currentTime = off;
      if (playing) await hv.play().catch(() => blocked());
    } else {
      scene.innerHTML = sceneHtml(s);
      sceneAnimate(s, off);
      if (s.type === 'thanks' && HAS_CLIP) { const l = new Image(); l.src = DOC.hymna.poster; }
    }
    base = off; t0 = performance.now();
    root.classList.remove('cut');
    busy = false;
    setGrain(s.type === 'sv' && playing);
    startLoop();
    ui_();
  }
  function teardown() {
    stopVoice(); hasAudio = false;
    stage.clear();
    if (hv) { hv.pause(); hv.removeAttribute('src'); hv.load(); hv = null; }
    scene.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
    sceneAnims = []; scene.innerHTML = '';
  }
  const preloaded = new Set();
  function preloadAhead(i) { // další hlasy se stáhnou do cache předem
    for (let k = i + 1; k < Math.min(segs.length, i + 4); k++) {
      const s = segs[k];
      if (s.type === 'sv' && VOICE_FILE[s.id] && !preloaded.has(s.id)) { preloaded.add(s.id); fetch(`assets/voices/${VOICE_FILE[s.id]}`).catch(() => {}); }
    }
  }
  function blocked() { // zvuk zablokován: zastavit a čekat na klepnutí
    if (!playing) return;
    setPlaying(false); root.classList.add('need-tap');
  }

  // ---------------- smyčka, titulky, lišta
  function startLoop() { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (busy || idx < 0) return;
    const s = cur(), t = segTime();
    paintTl();
    if (s.type === 'sv') {
      const w = D.witById[s.id];
      stage.sync(t, playing && !(hasAudio && voice.paused));
      let i = -1; for (let k = 0; k < starts.length; k++) if (t >= starts[k]) i = k;
      if (cc) stage.setSub(i, w); else stage.clearSub();
      stage.lower.classList.toggle('in', t > 0.35 && t < s.dur - DUR.tail - 0.4);
    } else if (s.type === 'hymn') {
      let line = null; for (const l of HYL) if (t >= l.t) line = l; else break;
      const show = cc && line && t < line.t + 8;
      if (show && lyr.textContent !== line.x) { lyr.textContent = line.x; }
      lyr.classList.toggle('in', !!show);
    }
    if (playing && (t >= s.dur || (s.type === 'sv' && hasAudio && voice.ended) || (s.type === 'hymn' && hv?.ended))) next();
  }
  let lastTl = -1;
  function paintTl() {
    const g = globalT();
    if (Math.abs(g - lastTl) < 0.05) return; lastTl = g;
    const tl = $s('#fTl');
    const s = cur();
    const c = chapters[s.ch];
    $$('.f-tl-c', tl).forEach((e, i) => {
      const ch = chapters[i];
      const f = Math.max(0, Math.min(1, (g - ch.at) / ch.dur));
      e.firstElementChild.style.transform = `scaleX(${f})`;
      e.classList.toggle('cur', i === s.ch);
    });
    tl.setAttribute('aria-valuenow', Math.round(g)); tl.setAttribute('aria-valuetext', `${mmss(g)} z ${mmss(total)}, ${c.label}`);
    $s('#fTime').textContent = `${mmss(g)} / ${mmss(total)}`;
  }

  // ---------------- přehrávání
  function setPlaying(p) {
    playing = p;
    const s = cur();
    if (p) {
      root.classList.remove('need-tap');
      t0 = performance.now();
      if (s) {
        if (s.type === 'sv') { if (hasAudio) voice.play().catch(blocked); stage.freeze(false); stage.playVideo(); setGrain(true); }
        else if (s.type === 'hymn') hv?.play().catch(blocked);
        sceneAnims.forEach((a) => a.play());
      }
    } else {
      base = segTime();
      if (s) {
        if (s.type === 'sv') { voice.pause(); stage.freeze(true); setGrain(false); }
        else if (s.type === 'hymn') hv?.pause();
        sceneAnims.forEach((a) => a.pause());
      }
    }
    ui_(); poke();
  }
  function ui_() {
    const pl = $s('#fPlay'); $('span', pl).textContent = playing ? '❚❚' : '▶';
    pl.setAttribute('aria-label', playing ? 'Pozastavit (mezerník)' : 'Přehrát (mezerník)');
    root.classList.toggle('is-playing', playing);
    $s('#fBig').setAttribute('aria-label', playing ? 'Pozastavit' : 'Přehrát');
  }
  function next() { if (idx >= segs.length - 1) { finish(); return; } enter(idx + 1, 0); }
  function prev() { const s = cur(); if (segTime() > 2.5 || idx === 0) enter(idx, 0); else enter(idx - 1, 0); }
  function finish() {
    if (finished) return;
    finished = true; tok++; busy = false;
    setPlaying(false); teardown(); stage.clear();
    scene.style.display = 'none'; stageEl.classList.add('m-none'); lyr.classList.remove('in');
    root.classList.add('is-done'); $s('#fDone').hidden = false;
    $s('#fDone .btn').focus({ preventScroll: true });
    cancelAnimationFrame(raf);
    const last = segs[segs.length - 1]; lastTl = -1; idx = segs.length - 1; base = last.dur; paintTl();
  }
  /** Skok na globální čas (sekundy od začátku filmu). */
  function seek(g) {
    g = Math.max(0, Math.min(total - 0.05, g));
    const j = segs.findIndex((s) => g < s.at + s.dur);
    const off = g - segs[j].at;
    if (j === idx && !busy && !finished) {
      const s = cur();
      base = off; t0 = performance.now(); lastTl = -1;
      if (s.type === 'sv') { stage.clearSub(); if (hasAudio) voice.currentTime = Math.min(off, wDur - 0.15); }
      else if (s.type === 'hymn') { if (hv) hv.currentTime = off; }
      else sceneAnims.forEach((a) => { a.currentTime = off * 1000; });
      paintTl();
    } else enter(j, off);
  }
  function seekScene(i, off = 0) { enter(Math.max(0, Math.min(segs.length - 1, i)), off); }

  // ---------------- otevření / zavření
  function open({ autostart = false, opener: op } = {}) {
    if (!root.hidden) { if (autostart && !started) go(); return; }
    opener = op || document.activeElement;
    root.hidden = false; document.documentElement.classList.add('film-open');
    window.dispatchEvent(new CustomEvent('film:opened'));
    root.focus({ preventScroll: true });
    $s('#fStart').hidden = false; root.classList.remove('is-done'); $s('#fDone').hidden = true;
    started = false; idx = -1; finished = false; lastTl = -1;
    syncVol(); poke();
    if (autostart) go(); else $s('.f-go').focus({ preventScroll: true });
  }
  async function go() {
    unlock();
    started = true; $s('#fStart').hidden = true;
    claim('dokument', () => { if (playing) setPlaying(false); });
    try { if (!document.fullscreenElement && root.requestFullscreen) await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* nevadí */ }
    playing = true; ui_();
    await enter(0, 0);
    started = true;
  }
  function close(href, silent = false) {
    if (root.hidden) return;
    tok++; cancelAnimationFrame(raf); playing = false; busy = false;
    teardown(); stage.clear(); setGrain(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    root.hidden = true; document.documentElement.classList.remove('film-open');
    root.classList.remove('need-tap', 'is-done', 'cut');
    if (!silent) window.dispatchEvent(new CustomEvent('film:closed', { detail: { href } }));
    try { opener?.focus?.({ preventScroll: true }); } catch { /* nic */ }
  }
  function again() { $s('#fDone').hidden = true; finished = false; playing = true; enter(0, 0); }

  // ---------------- ovládací prvky, auto-skrytí
  function poke() {
    ui.classList.add('show'); clearTimeout(hideT);
    if (playing) hideT = setTimeout(() => ui.classList.remove('show'), 3200);
  }
  let wasShown = true;
  root.addEventListener('pointermove', poke);
  root.addEventListener('pointerdown', (e) => { wasShown = ui.classList.contains('show') || e.pointerType === 'mouse'; poke(); });
  root.addEventListener('focusin', poke);
  const volEl = $s('#fVol'), muteEl = $s('#fMute');
  function syncVol() {
    volEl.value = Math.round(getVolume() * 100); muteEl.setAttribute('aria-pressed', isMuted());
    $('span', muteEl).textContent = isMuted() || getVolume() === 0 ? '✕' : '♪';
    if (hv) { hv.volume = getVolume(); hv.muted = isMuted(); }
  }
  volEl.addEventListener('input', () => setVolume(volEl.value / 100));
  onVolume(syncVol);
  // titulky: CZ (výchozí) → EN (anglický originál dabingu) → vypnuto → CZ
  const syncCc = () => {
    const m = subMode(); cc = m !== 'off';
    const b = $s('#fCc'); b.setAttribute('aria-pressed', cc); b.setAttribute('aria-label', `Titulky: ${m === 'cs' ? 'česky' : m === 'en' ? 'anglicky' : 'vypnuto'} (C přepíná)`);
    $('span', b).textContent = m === 'off' ? 'CC' : SUB_LABEL[m];
    root.classList.toggle('no-cc', !cc); if (!cc) { stage.clearSub(); lyr.classList.remove('in'); }
  };
  const toggleCc = () => { const m = subMode(); setSubMode(m === 'cs' ? 'en' : m === 'en' ? 'off' : 'cs'); };
  window.addEventListener('submode', syncCc);
  syncCc();
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); };
  const toggle = () => { if (!started) { go(); return; } if (finished) return; setPlaying(!playing); };

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    const a = b?.dataset.a;
    if (a) {
      if (a === 'close') { e.preventDefault(); close(b.getAttribute('href') || ''); return; }
      if (a === 'go') go();
      else if (a === 'play') toggle();
      else if (a === 'prev') prev();
      else if (a === 'next') next();
      else if (a === 'back') seek(globalT() - 10);
      else if (a === 'fwd') seek(globalT() + 10);
      else if (a === 'mute') setMuted(!isMuted());
      else if (a === 'cc') toggleCc();
      else if (a === 'fs') toggleFs();
      else if (a === 'again') again();
      return;
    }
    if (e.target.closest('.f-tl, .f-ctl, .f-start, .f-done')) return;
    // klepnutí na obraz: když byly ovládací prvky skryté, jen je ukáže; jinak pauza / přehrání
    if (!started || finished) return;
    if (root.classList.contains('need-tap')) { setPlaying(true); return; }
    if (!wasShown) return; // dotyk na skrytý ovladač jen ukáže ovládání
    setPlaying(!playing);
  });
  const tl = $s('#fTl');
  const tlSeek = (e) => { const r = tl.getBoundingClientRect(); if (!started) return; if (finished) { finished = false; $s('#fDone').hidden = true; root.classList.remove('is-done'); } seek(((e.clientX - r.left) / r.width) * total); };
  let drag = false;
  tl.addEventListener('pointerdown', (e) => { drag = true; tl.setPointerCapture?.(e.pointerId); tlSeek(e); });
  tl.addEventListener('pointermove', (e) => { if (drag) tlSeek(e); });
  tl.addEventListener('pointerup', () => { drag = false; });
  tl.addEventListener('pointercancel', () => { drag = false; });
  root.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    const k = e.key;
    const inRange = e.target.matches?.('input[type=range]');
    if (k === 'Tab') { // jednoduchá pasti fokusu
      const f = $$('button:not([hidden]), a[href], input, [tabindex="0"]', root).filter((x) => x.offsetParent !== null || x === document.activeElement);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (k === 'Escape') { e.preventDefault(); close(); return; } // v celé obrazovce první Esc zachytí prohlížeč, druhý zavře film
    if (inRange && (k === 'ArrowUp' || k === 'ArrowDown')) return;
    if (k === ' ' || k === 'k') { if (e.target.closest('button, a')) { if (k === ' ') return; } e.preventDefault(); toggle(); }
    else if (k === 'ArrowRight') { e.preventDefault(); if (!started) return; e.shiftKey ? next() : seek(globalT() + 10); }
    else if (k === 'ArrowLeft') { e.preventDefault(); if (!started) return; e.shiftKey ? prev() : seek(globalT() - 10); }
    else if (k === 'PageDown' || k === 'n') { e.preventDefault(); started && next(); }
    else if (k === 'PageUp' || k === 'p') { e.preventDefault(); started && prev(); }
    else if (k === 'ArrowUp') { e.preventDefault(); setVolume(getVolume() + 0.1); }
    else if (k === 'ArrowDown') { e.preventDefault(); setVolume(getVolume() - 0.1); }
    else if (k === 'c' || k === 'C') toggleCc();
    else if (k === 'm' || k === 'M') setMuted(!isMuted());
    else if (k === 'f' || k === 'F') toggleFs();
    poke();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
  document.addEventListener('fullscreenchange', () => { const b = $s('#fFs'); b.setAttribute('aria-pressed', !!document.fullscreenElement); });

  const A = {
    open, close, seek, seekScene, segs, chapters, total,
    get idx() { return idx; }, get playing() { return playing; }, get busy() { return busy; }, get finished() { return finished; }, get started() { return started; },
    next, prev, toggle, go,
    segTime, globalT,
  };
  window.__film = A;
  return A;
}

// Společná „scéna“ svědectví: portrét nebo živý portrét (video ve smyčce), dýchání, světlo, zrno, vinětace,
// dolní titulek (jmenovka) a titulky po větách. Používá ji přehrávač v oddílu Svědectví i celoobrazovkový film.
import STAV from '../../data/svedkove-stav.json';
import { img, small } from './img.js';
import { $, esc, reduced } from './util.js';

const SIDE = { spojenci: 'spojenec', 'nepřátelé': 'nepřítel', 'neutrální': 'neutrální', nadhled: 'mocný Faerûnu' };
export const sideLabel = (w) => SIDE[w.skupina] || 'spojenec';
export const isFoe = (w) => w.strana === 'nepřítel';
export const isPast = (w) => !!w.stav && w.stav !== 'žije';
export const stavInfo = (w) => STAV[w.id] || null;
/** „† 1377 DR“ nebo „zmizel 1385 DR“; pro živé prázdný řetězec. */
export function stavShort(w) {
  if (!isPast(w)) return '';
  const r = STAV[w.id]?.rok;
  return `${w.stav === 'zmizel' ? 'zmizel' : '†'}${r ? ` ${r} DR` : ''}`;
}
export const stavTitle = (w) => w.stav_titulek || (w.stav === 'zmizel' ? 'zmizel beze stopy' : '† padl');
export const groupOf = (w) => (w.skupina === 'spojenci' ? 'spojenci' : w.skupina === 'nepřátelé' ? 'nepratele' : 'mocni');

export const STAGE_HTML = `
  <div class="w-layer"></div><div class="w-layer"></div>
  <div class="w-light" aria-hidden="true"></div>
  <canvas class="w-grain" aria-hidden="true"></canvas>
  <div class="w-vig" aria-hidden="true"></div>
  <div class="w-bars" aria-hidden="true"></div>
  <div class="w-lower"><span class="w-side"></span><h3 class="w-name"></h3><p class="w-role"></p><p class="w-vaz"></p></div>
  <div class="w-sub" aria-live="polite"><p></p></div>`;

/** Vytvoří scénu uvnitř kořenového elementu (musí v sobě mít STAGE_HTML). */
export function createStage(root) {
  const layers = [...root.querySelectorAll('.w-layer')];
  const lower = $('.w-lower', root);
  const subP = $('.w-sub p', root);
  let front = 0, kb = null, lastSent = -9, video = null, token = 0;

  function layerHtml(w, withVideo) {
    const pos = w.fokus || '50% 30%';
    return `<div class="w-bg" style="background-image:url('${small(w.portret)}')"></div>
      <div class="w-img"><div class="w-breath">${img(w.portret, { alt: `Portrét: ${w.jmeno}`, sizes: '100vw', eager: true, pos })}</div></div>${withVideo ? '<div class="w-vwrap"></div>' : ''}`;
  }
  /** Přepne na svědka. Vrací { video, layer, img }. Video se jen připraví (spouští se zvenku). */
  function setWitness(w, { useVideo = true, video: src = '' } = {}) {
    ++token;
    cleanup();
    const wantVideo = !!src && useVideo && !reduced();
    const next = layers[1 - front];
    next.className = 'w-layer';
    next.innerHTML = layerHtml(w, wantVideo);
    if (wantVideo) {
      video = document.createElement('video');
      video.className = 'w-video'; video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
      video.setAttribute('playsinline', ''); video.setAttribute('webkit-playsinline', ''); video.setAttribute('muted', ''); video.setAttribute('aria-hidden', 'true');
      video.disableRemotePlayback = true;
      video.src = src;
      video.style.objectPosition = w.fokus || '50% 30%';
      video.addEventListener('playing', () => next.classList.add('has-video'), { once: true });
      $('.w-vwrap', next).appendChild(video);
      video.load();
    }
    next.classList.add('on'); layers[front].classList.remove('on'); front = 1 - front;
    lower.classList.remove('in');
    lower.classList.toggle('foe', isFoe(w));
    lower.classList.toggle('past', isPast(w));
    root.classList.toggle('past', isPast(w));
    $('.w-side', lower).textContent = sideLabel(w);
    $('.w-name', lower).textContent = w.jmeno;
    $('.w-role', lower).innerHTML = `${esc(w.role)}${isPast(w) ? ` <span class="w-dead"><b>${esc(stavShort(w))}</b> ${esc(stavTitle(w).replace(/^†\s*/, ''))} · hlas z minulosti</span>` : ''}`;
    $('.w-vaz', lower).textContent = w.vazba || '';
    clearSub();
    return { video, layer: next, img: $('.w-breath img', next) };
  }
  function cleanup() {
    kb?.cancel(); kb = null;
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video = null; }
  }
  function ken(target, dur, fokus = '50% 30%') {
    kb?.cancel(); kb = null;
    if (reduced() || !target) return;
    target.style.transformOrigin = fokus;
    kb = target.animate([
      { transform: 'scale(1.03) translate(0,0)' },
      { transform: 'scale(1.1) translate(-0.6%, -0.4%)' },
    ], { duration: Math.max(8000, dur * 1000 + 2500), easing: 'cubic-bezier(.33,.0,.3,1)', fill: 'forwards' });
  }
  function setSub(i, w) {
    if (i === lastSent) return; lastSent = i;
    subP.classList.remove('in');
    setTimeout(() => { if (lastSent !== i) return; subP.textContent = i >= 0 && w ? w.text[i] : ''; if (i >= 0) subP.classList.add('in'); }, i <= 0 ? 0 : 240);
  }
  function clearSub() { lastSent = -9; subP.textContent = ''; subP.classList.remove('in'); }
  function freeze(on) { // pauza vizuálu
    root.classList.toggle('paused', on);
    if (on) { kb?.pause(); video?.pause(); } else { kb?.play(); video?.play().catch(() => {}); }
  }
  function playVideo() { return video?.play().catch(() => {}); }
  function clear() { cleanup(); layers.forEach((l) => { l.className = 'w-layer'; l.innerHTML = ''; }); lower.classList.remove('in'); clearSub(); }
  return { setWitness, ken, setSub, clearSub, freeze, playVideo, clear, lower, get video() { return video; }, get token() { return token; } };
}

/** Zrno (canvas) v kořenu scény; `active()` říká, jestli se má animovat. Vrací funkci pro zapnutí/vypnutí. */
export function grain(root) {
  const c = $('.w-grain', root); if (!c) return () => {};
  if (reduced()) { c.remove(); return () => {}; }
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
  return (v) => { if (v && !on) { on = true; requestAnimationFrame(f); } else if (!v) on = false; };
}

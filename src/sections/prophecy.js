// 7. Alaundovo proroctví: tři kapitoly, verše se odhalují při scrollu, u známých dvojverší „komu patří“.
// Iterace 8: hlas „Alaundo“ se nese stránkou. Kapitoly hrají za sebou (I → II → III), verš, který zní, se rozsvítí
// a stránka k němu jemně doroluje (rolování uživatele automatické rolování na chvíli pozastaví), klik na verš = skok hlasu.
// Přichází-li čtenář kliknutím odjinud, hlas hned hraje (gesto už proběhlo); při přímém otevření adresy nebo zablokovaném
// přehrávání se ukáže jedno tlačítko „Vyslechnout proroctví“. Hraje přes sdílený <audio> (lib/audio.js), odchod = ztišení.
import { D } from '../lib/data.js';
import { img, small, largest } from '../lib/img.js';
import { $, $$, esc, settleScroll, reduced } from '../lib/util.js';
import { voice, load as loadVoice, unlock, claim, fadeOut, getVolume, setVolume, isMuted, setMuted, onVolume, audioOwner } from '../lib/audio.js';
import { versePath } from '../lib/router.js';
import { openLightbox } from '../lib/lightbox.js';

const NAMES = ['první', 'druhá', 'třetí'];
const ROM = ['I', 'II', 'III'];
// Verše třetí kapitoly, které kronika výslovně označuje za naplněné ve finále 1. 8. 2026: Ho × Yamoh (3-6, 3-7)
// a Elminster × Sar Saratar (3-12). Podle upřesnění autora se ty souboje dohrály v bitvě o Anauroch,
// souběžně s finále na Pyramidě času (vyprávění je v kapitole „Thultanthar a Pyramida času“).
const FIN_CH = 'ch-thultanthar-a-pyramida-casu';
const FUL = { '3-6': 'b-bitva-v-anaurochu', '3-7': 'b-bitva-v-anaurochu', '3-12': 'b-bitva-v-anaurochu' };
const FUL_LABEL = 'Bitva v Anaurochu, 1. 8. 2026';
/** Které kapitoly vyprávění odkazují na který verš (odkazy (p:kapitola-verš) v textech kapitol). */
function refsOf() {
  const m = {};
  for (const [cid, blocks] of Object.entries(D.vypraveni?.chapters || {})) {
    for (const mm of JSON.stringify(blocks).matchAll(/\]\(p:(\d)-(\d+)\)/g)) (m[`${mm[1]}-${mm[2]}`] ||= new Set()).add(cid);
  }
  return m;
}
const chTitle = (id) => D.chById?.[id]?.title || '';
const lines = (v) => v.t.flatMap((l) => String(l).split(/\s*\|\s*/));
function linkRow(key) {
  const refs = [...(refsOf.cache[key] || [])];
  const ful = FUL[key];
  if (!ful && !refs.length) return '';
  const others = ful ? [...new Set([FIN_CH, ...refs])] : refs;
  return `<div class="pr-link">${ful ? `<a class="ful" href="#${ful}">✦ Naplnilo se · ${esc(FUL_LABEL)} ▸</a>` : ''}${!ful ? others.map((c) => `<a href="#${c}">V kronice · ${esc(chTitle(c))} ▸</a>`).join('') : ''}${ful && others.length ? `<span class="ref">Výklad: ${others.map((c) => `<a href="#${c}">${esc(chTitle(c))}</a>`).join(', ')}</span>` : ''}</div>`;
}

export function renderProphecy() {
  const el = $('#proroctvi');
  refsOf.cache = refsOf();
  const P = D.prophecy;
  const A = audioData();
  const known = P.chapters.reduce((n, c) => n + c.verses.filter((v) => v.who).length, 0);
  el.innerHTML = `<header class="sec-head"><p class="kicker">Proroctví</p><h1 id="proroctvi-h" tabindex="-1">Alaundovo proroctví</h1>
    <p class="lead">${esc(P.intro)}</p>
    ${A ? `<div class="pp-cta" id="ppCta"><button class="btn red pp-go" type="button" id="ppStart"><span aria-hidden="true">▶</span> Vyslechnout proroctví</button><p>Čte Alaundo · ${Math.round(A.total / 60)} minut · tři kapitoly za sebou, verš, který zní, se rozsvítí</p></div>` : ''}
    <div class="orn">✦</div></header>
    <div class="pr-grid wrap">
      <div class="pr-art" aria-hidden="true">${P.chapters.map((c, i) => `<div class="pr-pic${i === 0 ? ' on' : ''}" data-ch="${i}">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '(max-width:900px) 100vw, 40vw', pos: '50% 30%' })}</div>`).join('')}<div class="pr-art-shade"></div><div class="pr-prog" aria-hidden="true">${ROM.map((r, i) => `<span class="${i === 0 ? 'on' : ''}" data-ch="${i}">${r}</span>`).join('')}</div></div>
      <div class="pr-text">
        <p class="pr-sum"><span><b>Naplnění.</b> Třetí kapitola se podle kroniky naplnila ve finále 1. srpna 2026. Spárované souboje skončily v bitvě o Anauroch, souběžně s finále na Pyramidě času. Verše s doloženým výkladem odkazují na místo, kde se to stalo.</span><a href="#${FIN_CH}">${esc(chTitle(FIN_CH))} ▸</a></p>
        <p class="pr-note ui">U ${known} dvojverší je z her známo, komu patří. Klepněte na <span class="pr-key">✦</span>.</p>
        ${P.chapters.map((c, i) => `<section class="pr-ch" data-ch="${i}" aria-label="Kapitola ${NAMES[i]}">
          <div class="pr-mobpic">${img('ilu/' + (c.img || P.img), { alt: '', sizes: '100vw', pos: '50% 30%' })}</div>
          <p class="pr-rom rv">${ROM[i]}</p><h3 class="pr-k rv">Kapitola ${NAMES[i]}</h3>
          <div class="pr-terc rv" id="pt-${i + 1}" data-ch="${i}" data-u="0"><button class="pv-play" type="button" data-seek="${i}:0" aria-label="Přehrát kapitolu ${NAMES[i]} od začátku"><span aria-hidden="true">▶</span></button>${c.tercet.map((l) => `<p>${esc(l)}</p>`).join('')}</div>
          <div class="pr-orn">✦</div>
          ${c.verses.map((v, j) => `<div class="pr-v rv${v.who ? ' known' : ''}${FUL[`${i + 1}-${j}`] ? ' ful' : ''}" id="pv-${i + 1}-${j}" data-ch="${i}" data-u="${j + 1}">
            <button class="pv-play" type="button" data-seek="${i}:${j + 1}" aria-label="Přehrát od verše ${j + 1} kapitoly ${NAMES[i]}"><span aria-hidden="true">▶</span></button>
            <p data-seek="${i}:${j + 1}">${lines(v).map((l, k) => `<span class="vl" style="--l:${k}">${esc(l)}</span>`).join('')}</p>
            ${v.img ? `<button class="pr-thumb" data-lb="${esc(largest('ilu/' + v.img))}" data-cap="${esc(v.cap || '')}" aria-label="Obraz k verši: ${esc(v.cap || '')}"><img src="${small('ilu/' + v.img)}" alt="" loading="lazy" decoding="async"></button>` : ''}
            ${v.who ? `<button class="pr-who" aria-expanded="false" aria-controls="prw-${i}-${j}">✦ <span>Komu patří</span></button><p class="pr-ans" id="prw-${i}-${j}" hidden><b>${esc(v.who)}</b><small>${esc(v.src)}</small></p>` : ''}
            ${linkRow(`${i + 1}-${j}`)}
          </div>`).join('')}
          <div class="pr-orn">✦</div>
        </section>`).join('')}
      </div>
    </div>
    ${A ? `<div class="pp" id="pp" role="region" aria-label="Hlas proroctví" hidden>
      <button class="pp-b pp-play" type="button" id="ppPlay" aria-label="Přehrát"><span aria-hidden="true">▶</span></button>
      <div class="pp-info"><b id="ppNow" aria-live="off">Kapitola první</b><span>čte Alaundo</span></div>
      <div class="pp-ch" role="group" aria-label="Kapitola">${ROM.map((r, i) => `<button class="pp-b" type="button" data-pch="${i}" aria-pressed="${i === 0}" aria-label="Kapitola ${NAMES[i]}">${r}</button>`).join('')}</div>
      <div class="pp-prog" id="ppProg" role="slider" tabindex="0" aria-label="Průběh kapitoly" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00"><i id="ppBar"></i></div>
      <span class="pp-time" id="ppTime">0:00 / 0:00</span>
      <button class="pp-b pp-back" type="button" id="ppFollow" hidden>K verši</button>
      <button class="pp-b" type="button" id="ppMute" aria-pressed="false" aria-label="Ztlumit"><span aria-hidden="true">♪</span></button>
      <input class="pp-vol" id="ppVol" type="range" min="0" max="100" step="5" aria-label="Hlasitost">
    </div>` : ''}`;
  el.addEventListener('click', (e) => {
    const sk = e.target.closest('[data-seek]');
    if (sk && !e.target.closest('a, .pr-who, .pr-thumb')) { const [c, u] = sk.dataset.seek.split(':').map(Number); player?.seekUnit(c, u); return; }
    const w = e.target.closest('.pr-who');
    if (w) { const a = w.nextElementSibling; a.hidden = !a.hidden; w.setAttribute('aria-expanded', !a.hidden); w.classList.toggle('on', !a.hidden); return; }
    const t = e.target.closest('.pr-thumb');
    if (t) openLightbox([{ src: t.dataset.lb, cap: t.dataset.cap }]);
  });
  // odkaz na verš (z vyprávění): doskrolovat, zvýraznit, případně otevřít výklad
  window.addEventListener('prophecy:verse', (e) => {
    const v = document.getElementById(e.detail.id); if (!v) return;
    v.classList.add('in', 'hit');
    const w = $('.pr-who', v); if (w && w.getAttribute('aria-expanded') !== 'true') w.click();
    if (e.detail.scroll !== false) settleScroll(v);
    setTimeout(() => v.classList.remove('hit'), 4200);
  });
  // obraz kapitoly vlevo podle toho, kterou kapitolu čtenář právě čte
  const pics = $$('.pr-pic', el);
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { pics.forEach((p) => p.classList.toggle('on', p.dataset.ch === e.target.dataset.ch)); $$('.pr-prog span', el).forEach((p) => p.classList.toggle('on', p.dataset.ch === e.target.dataset.ch)); }
  }, { rootMargin: '-40% 0px -55% 0px' });
  $$('.pr-ch', el).forEach((s) => io.observe(s));
  // verš, který čtenář právě čte, se rozsvítí
  const lit = new IntersectionObserver((ents) => { for (const e of ents) e.target.classList.toggle('lit', e.isIntersecting); }, { rootMargin: '-38% 0px -38% 0px' });
  $$('.pr-v', el).forEach((v) => lit.observe(v));
  if (A) player = createPlayer(el, A);
}

// ======================================================================== hlas proroctví
let player = null;
function audioData() {
  const A = D['proroctvi-audio'];
  if (!A?.chapters?.length) return null;
  return { ...A, total: A.chapters.reduce((n, c) => n + c.duration, 0) };
}
const mmss = (t) => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function createPlayer(el, A) {
  const bar = $('#pp', el), cta = $('#ppCta', el), btn = $('#ppPlay', el), prog = $('#ppProg', el);
  let chi = 0, playing = false, started = false, showCta = true, finished = false, raf = 0, curEl = null, userAt = 0, progAt = 0, pending = null, loadedCh = -1;
  const unitEl = (c, u) => (u === 0 ? document.getElementById(`pt-${c + 1}`) : document.getElementById(`pv-${c + 1}-${u - 1}`));
  const unitAt = (c, t) => { const at = A.chapters[c].at; let u = 0; for (let k = 0; k < at.length; k++) if (t >= at[k] - 0.05) u = k; return u; };
  const label = (c, u) => `Kapitola ${NAMES[c]} · ${u === 0 ? 'úvodní trojverší' : `${u}. verš`}`;
  const mine = () => audioOwner() === 'proroctvi' && voice.src.includes(A.chapters[chi].file);

  function ui() {
    $('span', btn).textContent = playing ? '❚❚' : '▶';
    btn.setAttribute('aria-label', playing ? 'Pozastavit proroctví' : 'Přehrát proroctví');
    $$('[data-pch]', el).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.pch === chi)));
    bar.hidden = !started;
    if (cta) cta.hidden = !showCta;
    el.classList.toggle('pp-on', playing);
    const m = isMuted() || getVolume() === 0;
    $('#ppMute span', el).textContent = m ? '✕' : '♪'; $('#ppMute', el).setAttribute('aria-pressed', String(isMuted()));
    $('#ppMute', el).setAttribute('aria-label', isMuted() ? 'Zapnout zvuk' : 'Ztlumit');
    $('#ppVol', el).value = Math.round(getVolume() * 100);
  }
  onVolume(ui);

  function mark(c, u, scroll = true) {
    const n = unitEl(c, u);
    if (n === curEl) return;
    curEl?.classList.remove('now');
    curEl = n;
    if (!n) return;
    n.classList.add('now', 'in');
    $('#ppNow', el).textContent = label(c, u);
    if (scroll && Date.now() - userAt > 6000) {
      progAt = Date.now();
      const r = n.getBoundingClientRect();
      const y = window.scrollY + r.top - window.innerHeight * 0.4 + r.height / 2;
      window.scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'instant' : 'smooth' });
    }
  }
  function tick() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (!playing) return;
      if (!mine()) { playing = false; ui(); return; }
      const t = voice.currentTime, D0 = A.chapters[chi].duration;
      mark(chi, unitAt(chi, t));
      $('#ppBar', el).style.transform = `scaleX(${Math.min(1, t / D0).toFixed(4)})`;
      $('#ppTime', el).textContent = `${mmss(t)} / ${mmss(D0)}`;
      prog.setAttribute('aria-valuenow', Math.round((t / D0) * 100)); prog.setAttribute('aria-valuetext', `${mmss(t)} z ${mmss(D0)}`);
      $('#ppFollow', el).hidden = Date.now() - userAt > 6000;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  const lost = () => { playing = false; cancelAnimationFrame(raf); ui(); };

  /** Přehraje kapitolu c od času t (sekundy). Vrátí true, když zvuk opravdu hraje. */
  async function play(c = chi, t = null) {
    unlock();
    claim('proroctvi', lost);
    finished = false;
    if (loadedCh !== c || !voice.src.includes(A.chapters[c].file)) {
      chi = c; loadedCh = c;
      await loadVoice(A.chapters[c].file);
      if (t == null) t = 0;
    }
    chi = c;
    if (t != null) { try { voice.currentTime = Math.max(0, t); } catch { /* před načtením */ } }
    voice.onended = () => {
      if (chi < A.chapters.length - 1) play(chi + 1, 0);
      else { playing = false; finished = true; curEl?.classList.remove('now'); curEl = null; $('#ppNow', el).textContent = 'Konec proroctví'; ui(); }
    };
    try {
      await voice.play();
      playing = true; started = true; showCta = false; pending = null; ui(); tick();
      return true;
    } catch {
      playing = false; showCta = true; pending = { c, t: voice.currentTime, blocked: true }; ui();
      return false;
    }
  }
  function pause() { if (mine()) voice.pause(); playing = false; cancelAnimationFrame(raf); ui(); }
  function toggle() { if (playing) pause(); else if (finished) play(0, 0); else play(chi, mine() ? null : (pending?.t ?? lastT)); }
  let lastT = 0;
  function seekUnit(c, u) {
    const t = A.chapters[c].at[u] ?? 0;
    userAt = 0; // výslovný skok: znovu sledovat hlas
    curEl?.classList.remove('now'); curEl = null;
    play(c, t + 0.01);
  }

  // ovládání
  $('#ppStart', el)?.addEventListener('click', () => { const p = pending || { c: chi, t: lastT }; userAt = 0; play(p.c ?? 0, p.t ?? 0); });
  btn.addEventListener('click', toggle);
  $$('[data-pch]', el).forEach((b) => b.addEventListener('click', () => seekUnit(+b.dataset.pch, 0)));
  $('#ppMute', el).addEventListener('click', () => setMuted(!isMuted()));
  $('#ppVol', el).addEventListener('input', (e) => setVolume(e.target.value / 100));
  $('#ppFollow', el).addEventListener('click', () => { userAt = 0; const n = curEl; curEl = null; n?.classList.remove('now'); mark(chi, unitAt(chi, voice.currentTime)); });
  const seekFrac = (f) => { const D0 = A.chapters[chi].duration; if (mine()) voice.currentTime = f * D0; else play(chi, f * D0); };
  prog.addEventListener('click', (e) => { const r = prog.getBoundingClientRect(); seekFrac(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))); });
  prog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault(); e.stopPropagation();
    if (mine()) voice.currentTime = Math.max(0, voice.currentTime + (e.key === 'ArrowRight' ? 5 : -5));
  });
  // rolování uživatele pozastaví automatické dorolování k verši (na 6 s)
  const touched = () => { if (Date.now() - progAt > 900) userAt = Date.now(); };
  ['wheel', 'touchmove'].forEach((ev) => window.addEventListener(ev, () => { if (document.body.dataset.page === 'proroctvi') touched(); }, { passive: true }));
  window.addEventListener('keydown', (e) => { if (document.body.dataset.page === 'proroctvi' && ['PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End', ' '].includes(e.key) && !e.target.closest?.('input, button, [role="slider"]')) touched(); });
  ui();

  return {
    play, pause, seekUnit,
    get playing() { return playing; }, get chapter() { return chi; },
    /** Aktuálně zvýrazněná jednotka (pro testy): {ch, u, t, expected}. */
    state() { const t = voice.currentTime; return { ch: chi, t, now: curEl?.id || null, expected: unitEl(chi, unitAt(chi, t))?.id || null, playing, started, blocked: !!pending?.blocked }; },
    leave() { lastT = mine() ? voice.currentTime : lastT; if (playing && mine()) { playing = false; cancelAnimationFrame(raf); fadeOut(700).then(ui); } else ui(); },
    /** Vstup na stránku: po kliknutí odjinud hned hrát, jinak ukázat tlačítko. */
    async enter(sub, auto) {
      let c = chi, t = lastT, u = null;
      if (sub) { const [k, v] = sub.slice(3).split('-').map(Number); if (A.chapters[k - 1]) { c = k - 1; u = v + 1; t = A.chapters[c].at[u] ?? 0; } }
      else if (finished) { c = 0; t = 0; }
      if (playing && mine() && !sub) return;
      if (auto) { userAt = 0; const ok = await play(c, t); if (ok) return; }
      pending = { c, t, blocked: false }; showCta = true; ui();
      if (u != null && unitEl(c, u)) settleScroll(unitEl(c, u));
    },
  };
}

/** Vstup na stránku /proroctvi[/<kapitola-verš>]. */
export function enter(r, ctx = {}) {
  const act = navigator.userActivation;
  const auto = !ctx.quiet && (!!ctx.gesture || (!!ctx.pop && (!act || act.hasBeenActive)));
  if (r.sub) window.dispatchEvent(new CustomEvent('prophecy:verse', { detail: { id: r.sub, scroll: !player } }));
  return player?.enter(r.sub, auto);
}
export function leave() { player?.leave(); }
window.__prophecy = { get player() { return player; } };
void versePath;

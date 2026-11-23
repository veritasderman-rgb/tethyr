// Iterace 10: FILMOVÝ REŽIM PROROCTVÍ (/proroctvi/film).
// Celoobrazovkový „film“ v prohlížeči (žádné mp4 celého filmu, jen krátké předěly): recitace Alaunda (assets/proroctvi/kap1–3.mp3)
// řídí čas, obraz je slideshow hotových maleb proroctví s pomalou kamerou, prolínáním, vinětací a zrnem. Předěly kapitol jsou
// krátká videa bez textu (public/pfilm/*.mp4) a přes ně hoří nadpis (SVG filtr feTurbulence + feDisplacementMap, jiskry na canvasu).
// Verše nastupují uprostřed obrazu po slovech v rytmu recitace (časy veršů z public/data/proroctvi-audio.json, uvnitř verše
// úměrně délce řádků), slova světla se rozzáří stříbrně, slova tmy ztmavnou do fialově černé. Přes celý film se přetlačují dvě
// záře, Selûne (stříbrná) a Shar (fialově černá), podle obsahu verše; na začátku kapitoly II zatmění; v kapitole I se z jisker
// složí drak, přeletí a rozplyne se. prefers-reduced-motion: bez částic, plamenů a pohybu kamery, jen prolínání.
// Ovládání: mezerník, ←/→ verše, 1/2/3 kapitoly, ↑/↓ hlasitost, M zvuk, C verše zap/vyp, F celá obrazovka, Esc zavřít.
// Zvuk jde přes sdílený <audio> (lib/audio.js, claim 'pfilm'), takže nikdy nehrají dva zvuky přes sebe.
import './../styles/pfilm.css';
import { D, need } from '../lib/data.js';
import { largest, small } from '../lib/img.js';
import { voice, load as loadVoice, unlock, claim, release, getVolume, setVolume, isMuted, setMuted, onVolume } from '../lib/audio.js';
import { $, $$, esc, reduced } from '../lib/util.js';

const ROM = ['I', 'II', 'III'];
const NAMES = ['první', 'druhá', 'třetí'];
// předěly (hotová videa bez textu); kap1 je zkrácené na 0–4 s (drak ze světla vzlétne z vejce a rozplyne se)
const VIDS = {
  uvod: { dur: 6.12, title: 'Alaundovo proroctví', kicker: 'Film', sub: 'čte Alaundo · tři kapitoly', pos: 'top', from: 0.35, to: 5.5 },
  kap1: { dur: 4.0, title: 'Kapitola I', kicker: 'Alaundovo proroctví', pos: 'bottom', from: 0.25, to: 3.55 },
  kap2: { dur: 6.12, title: 'Kapitola II', kicker: 'Alaundovo proroctví', pos: 'center', from: 0.6, to: 5.5 },
  kap3: { dur: 6.12, title: 'Kapitola III', kicker: 'Alaundovo proroctví', pos: 'bottom', from: 0.3, to: 3.05 },   // jen v první půlce
};
// Naplněné verše 3-6, 3-7, 3-12 (souboje v bitvě o Anauroch): malba bitvy z bojového hlášení (world.json, b-bitva-v-anaurochu).
const FUL_IMG = { '2:7': 'ilu/K_032', '2:8': 'ilu/K_032', '2:13': 'ilu/K_032' };
// malby kapitol: předěl kapitoly (D_12–D_14) a druhý předěl k proroctví (P_D2–P_D4)
const CH_IMG = [['ilu/D_12', 'ilu/P_D2'], ['ilu/D_13', 'ilu/P_D3'], ['ilu/D_14', 'ilu/P_D4']];
const INTRO_IMG = 'ilu/P_D1';
const LIGHT = /^(světl|světel|bíl|slun|zář|záři|svít|stříbr|paprs|jas|úsvit|prozáří|den$|dne$|dnem$|Io$|Iov|naděj|osvícen)/i;
const DARK = /^(stín|čern|temn|noc|tma$|tmy$|tmou$|tmě$|zatrac|propast|chaos|pekl|pekel|polykač|zmar|smrt|mrtv|krev$|krví$)/i;
const mmss = (t) => { t = Math.max(0, Math.floor(t || 0)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const rnd = (s) => { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

let api = null, loading = null;
export async function openFilm(opts = {}) {
  unlock();
  if (!api) {
    loading ||= (async () => { await need('images', 'prophecy', 'proroctvi-audio'); api = create(); })();
    try { await loading; } catch (e) { console.error('pfilm', e); loading = null; return; }
  }
  api.open(opts);
}
export function closeFilm() { api?.close(true); }

// ======================================================================== scénář
function buildScript() {
  const P = D.prophecy, A = D['proroctvi-audio'];
  const lines = (arr) => arr.flatMap((l) => String(l).split(/\s*\|\s*/));
  const chapters = P.chapters.map((c, ci) => {
    const au = A.chapters[ci];
    const units = [{ lines: c.tercet.slice(), tercet: true }, ...c.verses.map((v) => ({ lines: lines(v.t), img: v.img ? 'ilu/' + v.img : null }))];
    units.forEach((u, k) => {
      u.at = au.at[k] ?? 0;
      u.end = au.at[k + 1] ?? au.duration;
      const words = u.lines.join(' ').split(/\s+/);
      const L = words.filter((w) => LIGHT.test(w.replace(/^[„(]+/, ''))).length, Dk = words.filter((w) => DARK.test(w.replace(/^[„(]+/, ''))).length;
      u.mood = clamp((L - Dk) / 2, -1, 1);
      if (FUL_IMG[`${ci}:${k}`]) u.img = FUL_IMG[`${ci}:${k}`];
    });
    if (ci === 0) units[0].img = CH_IMG[0][0], units[1].img ||= 'ilu/P_001';   // P_001 = malba k úvodnímu trojverší kapitoly I
    else units[0].img = CH_IMG[ci][0];
    // záběry: běh veršů se stejnou malbou; verš bez malby drží předchozí, po dvou verších se střídá s malbami kapitoly
    let held = null, run = 0, alt = 1;
    units.forEach((u) => {
      if (u.img) { held = u.img; run = 1; u.shot = u.img; return; }
      if (run >= 2) { held = CH_IMG[ci][alt % 2]; alt++; run = 0; }
      run++; u.shot = held;
    });
    return { n: ci, file: au.file, duration: au.duration, units };
  });
  const segs = [];
  const push = (s) => { s.at = segs.length ? segs[segs.length - 1].at + segs[segs.length - 1].dur : 0; segs.push(s); };
  push({ type: 'vid', key: 'uvod', dur: VIDS.uvod.dur, ch: -1 });
  chapters.forEach((c, ci) => {
    push({ type: 'vid', key: `kap${ci + 1}`, dur: VIDS[`kap${ci + 1}`].dur, ch: ci });
    push({ type: 'aud', ch: ci, dur: c.duration });
  });
  const total = segs[segs.length - 1].at + segs[segs.length - 1].dur;
  return { chapters, segs, total };
}

// ======================================================================== film
function create() {
  const { chapters, segs, total } = buildScript();
  const RM = reduced();
  const LITE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  const last = chapters[2].units.slice(-2).flatMap((u) => u.lines).join(' ');
  const root = document.createElement('div');
  root.id = 'pfilm'; root.className = 'pf' + (RM ? ' rm' : '') + (LITE ? ' lite' : '');
  root.hidden = true; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Film: Alaundovo proroctví');
  const marks = chapters.map((c, i) => segs.find((s) => s.type === 'vid' && s.ch === i).at);
  root.innerHTML = `
    <div class="pf-slides" aria-hidden="true"><div class="pf-sl"><img alt=""></div><div class="pf-sl"><img alt=""></div></div>
    <div class="pf-vids" aria-hidden="true">${Object.keys(VIDS).map((k) => `<video data-k="${k}" muted playsinline preload="${k === 'uvod' ? 'auto' : 'metadata'}" poster="pfilm/${k}.webp" src="pfilm/${k}.mp4"></video>`).join('')}</div>
    <div class="pf-mood" aria-hidden="true"><i class="pf-sel"></i><i class="pf-shar"></i></div>
    <div class="pf-eclipse" aria-hidden="true"><i class="pf-moon"></i><i class="pf-disc"></i></div>
    <canvas class="pf-fx" aria-hidden="true"></canvas>
    <div class="pf-vig" aria-hidden="true"></div><div class="pf-grain" aria-hidden="true"></div>
    <div class="pf-title" aria-hidden="true"><p class="pf-tk"></p>
      <svg viewBox="0 0 1600 300" preserveAspectRatio="xMidYMid meet"><defs>
        <filter id="pfBurn" x="-8%" y="-40%" width="116%" height="180%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.05" numOctaves="2" seed="7" result="n"/>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" result="d"/>
          <feGaussianBlur in="d" stdDeviation="9" result="b"/>
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 .25  0 .55 0 0 .05  0 0 .1 0 0  0 0 0 1.2 0" result="glow"/>
          <feMerge><feMergeNode in="glow"/><feMergeNode in="d"/></feMerge>
        </filter>
        <linearGradient id="pfFire" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1600" y2="0">
          <stop class="s0" offset="0" stop-color="#f3d27a"/><stop class="s1" offset="0" stop-color="#fff4cf"/><stop class="s2" offset="0" stop-color="#ff7a1a"/><stop class="s3" offset="0" stop-color="#ff7a1a" stop-opacity="0"/>
        </linearGradient></defs>
        <text x="800" y="190" text-anchor="middle" fill="url(#pfFire)" filter="url(#pfBurn)"></text></svg>
      <p class="pf-ts"></p></div>
    <div class="pf-verse" aria-live="off"></div>
    <p class="pf-sr" aria-live="polite"></p>
    <div class="pf-start" role="group" aria-label="Spuštění filmu">
      <p class="kicker">Film · Alaundovo proroctví</p><h2>Alaundovo proroctví</h2>
      <p>Tři kapitoly, ${Math.round(total / 60)} minut. Čte Alaundo, verše hoří uprostřed obrazu, přes malby proroctví se přetlačuje světlo Selûne a tma Shar.</p>
      <button class="btn red pf-go" type="button" data-a="go"><span aria-hidden="true">▶</span> Spustit</button>
      <p class="pf-keys">Mezerník pauza · ←/→ verše · 1/2/3 kapitoly · C verše · F celá obrazovka · Esc zavřít</p></div>
    <div class="pf-done" hidden><div class="pf-done-in">
      <p class="kicker">Konec proroctví</p><blockquote>${esc(last)}</blockquote><p class="pf-src">Alaundovo proroctví, kapitola třetí</p>
      <nav aria-label="Kam dál"><a class="btn" href="/proroctvi" data-a="close">Zpět na verše</a><a class="btn" href="/pribeh/kniha-5" data-a="close">Příběh – Poslední tažení</a><a class="btn" href="/bitvy/bitva-v-anaurochu" data-a="close">Bitva o Anauroch</a><button class="btn red" type="button" data-a="again">↺ Promítnout znovu</button></nav></div></div>
    <div class="pf-ui">
      <div class="pf-tl" id="pfTl" role="slider" tabindex="0" aria-label="Čas filmu" aria-valuemin="0" aria-valuemax="${Math.round(total)}" aria-valuenow="0"><i class="pf-bar"></i>${marks.map((m, i) => `<b style="left:${(m / total) * 100}%" title="Kapitola ${ROM[i]}" data-r="${ROM[i]}"></b>`).join('')}</div>
      <div class="pf-ctl">
        <button class="pf-b" type="button" data-a="play" aria-label="Přehrát (mezerník)"><span aria-hidden="true">▶</span></button>
        <button class="pf-b" type="button" data-a="prev" aria-label="Předchozí verš (←)"><span aria-hidden="true">⏮</span></button>
        <button class="pf-b" type="button" data-a="next" aria-label="Další verš (→)"><span aria-hidden="true">⏭</span></button>
        <span class="pf-time" aria-hidden="true">0:00 / ${mmss(total)}</span>
        <span class="pf-now"></span>
        <span class="pf-chs" role="group" aria-label="Kapitola">${ROM.map((r, i) => `<button class="pf-b" type="button" data-a="ch" data-ch="${i}" aria-label="Kapitola ${NAMES[i]} (${i + 1})">${r}</button>`).join('')}</span>
        <button class="pf-b" type="button" data-a="mute" aria-pressed="false" aria-label="Ztlumit (M)"><span aria-hidden="true">♪</span></button>
        <input class="pf-vol" type="range" min="0" max="100" step="5" aria-label="Hlasitost">
        <button class="pf-b" type="button" data-a="cc" aria-pressed="true" aria-label="Verše zapnuté (C)"><span aria-hidden="true">Verše</span></button>
        <button class="pf-b" type="button" data-a="fs" aria-pressed="false" aria-label="Celá obrazovka (F)"><span aria-hidden="true">⛶</span></button>
        <button class="pf-b pf-x" type="button" data-a="close" aria-label="Zavřít film (Esc)"><span aria-hidden="true">✕</span></button>
      </div></div>`;
  document.body.appendChild(root);
  const $s = (s) => $(s, root);
  const vids = Object.fromEntries($$('.pf-vids video', root).map((v) => [v.dataset.k, v]));
  const slides = $$('.pf-sl', root), verseEl = $s('.pf-verse'), titleEl = $s('.pf-title'), ui = $s('.pf-ui');
  const svgText = $s('.pf-title text'), turb = $s('#pfBurn feTurbulence'), disp = $s('#pfBurn feDisplacementMap'), stops = $$('#pfFire stop', root);
  const sel = $s('.pf-sel'), shar = $s('.pf-shar'), ecl = $s('.pf-eclipse');

  // ------------------------------------------------------------ stav
  let idx = -1, playing = false, started = false, finished = false, opener = null;
  let base = 0, t0 = 0;           // hodiny pro předěly (video)
  let unitShown = -1, shotShown = null, shotAt = 0, slideI = 0, kb = [];
  let titleOn = null, raf = 0, hideT = 0, cc = true, loadedCh = -1, tok = 0, wasShown = true;
  const seg = () => segs[idx];

  // ------------------------------------------------------------ částice (jiskry, drak) na canvasu
  const cv = $s('.pf-fx'), cx = cv.getContext('2d');
  let W = 0, Hh = 0, dpr = 1;
  const fit = () => { dpr = Math.min(LITE ? 1.25 : 2, window.devicePixelRatio || 1); W = root.clientWidth; Hh = root.clientHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(Hh * dpr); cx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  window.addEventListener('resize', () => { if (!root.hidden) fit(); });
  const sprite = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.25, 'rgba(255,190,90,.85)'); gr.addColorStop(0.6, 'rgba(255,110,20,.25)'); gr.addColorStop(1, 'rgba(255,80,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  })();
  const spriteW = (() => {   // bělejší jiskra pro draka ze světla
    const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d');
    const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,245,1)'); gr.addColorStop(0.3, 'rgba(255,228,160,.7)'); gr.addColorStop(0.7, 'rgba(255,170,60,.18)'); gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
  })();
  let sparks = [];
  function emit(x, y, n, spread = 30, up = 60) {
    if (RM) return;
    n = Math.round(n * (LITE ? 0.45 : 1));
    for (let i = 0; i < n && sparks.length < (LITE ? 220 : 600); i++) {
      sparks.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread * 0.4, vx: (Math.random() - 0.5) * 50, vy: -up * (0.4 + Math.random()), life: 0, max: 0.8 + Math.random() * 1.4, s: 3 + Math.random() * 7 });
    }
  }
  // drak z jisker: body siluety (logo webu, src/assets/draci.svg) navzorkované do mřížky
  const DRAGON = (() => {
    const c = document.createElement('canvas'); const S = 120; c.width = c.height = S; const g = c.getContext('2d');
    g.scale(S / 64, S / 64);
    g.fill(new Path2D('M3 22 L10 17 L15 15 L26 5 L21 16 C24 20 26 26 28 30 C32 34 38 34 42 36 C48 38 52 42 54 48 C55 52 58 53 60 50 L58 47 L63 44 L63 51 C62 57 53 58 49 52 L47 49 L49 56 L54 60 L43 60 L41 52 C36 53 30 51 27 47 L24 45 L17 47 L15 43 L21 40 C21 35 19 30 17 27 L12 27 L5 28 L10 24 Z'));
    g.fill(new Path2D('M27 31 L33 12 L45 1 Q44 8 46.5 12.5 Q50 8.5 55 7 Q53 13 54.5 18.5 Q58 16.5 63 17 Q58 21 57.5 26 Q59 30 61 33 Q52 33 44 35 C38 34 31 33 27 31Z'));
    const d = g.getImageData(0, 0, S, S).data, pts = [];
    const step = LITE ? 3.4 : 2.4;
    const on = (x, y) => x >= 0 && y >= 0 && x < S && y < S && d[(Math.floor(y) * S + Math.floor(x)) * 4 + 3] > 128;
    for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) {
      if (!on(x, y)) continue;
      const edge = !on(x - step, y) || !on(x + step, y) || !on(x, y - step) || !on(x, y + step);
      pts.push([1 - x / S, y / S, y / S < 0.55 && x / S > 0.42, edge]); // zrcadlově: letí doprava; okraj svítí víc (zlatá linka)
    }
    pts.step = step;
    return pts;
  })();
  const DR = { from: 0.8, dur: 8.2 };   // v kapitole I, hned po předělu (sekundy od začátku nahrávky)
  function drawDragon(t) {
    const k = (t - DR.from) / DR.dur;
    if (RM || k <= 0 || k >= 1) return false;
    const T = k * DR.dur, size = Math.min(W * 0.36, Hh * 0.5), cell = (DRAGON.step / 120) * size;
    const cxp = W * (0.3 + 0.42 * ease(clamp((T - 2.0) / 4.2))), cyp = Hh * (0.25 - 0.04 * Math.sin(T * 1.3));
    const flap = Math.sin(T * 5.5) * 0.28;
    cx.globalCompositeOperation = 'lighter';
    DRAGON.forEach(([px, py, wing, edge], i) => {
      const r1 = rnd(i), r2 = rnd(i + 99);
      let tx = cxp + (px - 0.5) * size + (r1 - 0.5) * cell * 0.4, ty = cyp + (py - 0.5) * size + (r2 - 0.5) * cell * 0.4;
      if (wing) ty = cyp + (py - 0.5) * size * (1 - flap) - flap * size * 0.12;
      let x, y, a;
      if (T < 2.2) { // jiskry z runového kruhu dole se slétají do siluety
        const q = ease(clamp((T - r1 * 0.6) / 1.6));
        const sx = W * (0.5 + (r1 - 0.5) * 0.5), sy = Hh * (0.92 + r2 * 0.06);
        x = sx + (tx - sx) * q; y = sy + (ty - sy) * q + Math.sin(q * Math.PI) * -40 * r2; a = 0.25 + 0.75 * q;
      } else if (T < 6.4) { x = tx + Math.sin(T * 9 + i) * 0.8; y = ty; a = 0.85 + 0.15 * Math.sin(T * 13 + i); }
      else { // rozplyne se: jiskry stoupají a hasnou
        const q = clamp((T - 6.4) / 1.8);
        x = tx + (r1 - 0.5) * 120 * q; y = ty - (40 + r2 * 120) * q; a = (1 - q) * (0.9 - 0.4 * r2);
      }
      const s = cell * (edge ? 1.9 + r2 : 1.2 + r2 * 0.6);
      cx.globalAlpha = clamp(a) * (edge ? 0.95 : 0.28);
      cx.drawImage(i % 3 ? spriteW : sprite, x - s / 2, y - s / 2, s, s);
    });
    cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    return true;
  }
  let lastFx = 0;
  function drawFx(now, t, aud) {
    const dt = Math.min(0.05, (now - (lastFx || now)) / 1000); lastFx = now;
    cx.clearRect(0, 0, W, Hh);
    let any = false;
    if (aud && aud.ch === 0) any = drawDragon(t) || any;
    if (sparks.length) {
      any = true;
      cx.globalCompositeOperation = 'lighter';
      sparks = sparks.filter((p) => (p.life += playing ? dt : 0) < p.max);
      for (const p of sparks) {
        if (playing) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 10 * dt; p.vx *= 0.99; }
        cx.globalAlpha = clamp(1 - p.life / p.max); const s = p.s * (1 - 0.5 * p.life / p.max);
        cx.drawImage(sprite, p.x - s / 2, p.y - s / 2, s, s);
      }
      cx.globalAlpha = 1; cx.globalCompositeOperation = 'source-over';
    }
    cv.style.opacity = any ? '1' : '0';
  }

  // ------------------------------------------------------------ hořící nadpis
  function setTitle(key) {
    const V = VIDS[key];
    titleOn = key;
    titleEl.className = `pf-title pos-${V.pos}`;
    $s('.pf-tk').textContent = V.kicker || ''; $s('.pf-ts').textContent = V.sub || '';
    svgText.textContent = V.title;
    svgText.setAttribute('font-size', V.title.length > 14 ? 120 : 170);
  }
  let emitAcc = 0;
  function drawTitle(lt) {   // lt = sekundy od začátku předělu
    const V = VIDS[titleOn]; if (!V) return;
    const T = lt - V.from, D0 = V.to - V.from;
    const on = T > 0 && T < D0;
    titleEl.classList.toggle('on', on);
    if (!on) return;
    const ign = clamp(T / 1.3), out = clamp((T - (D0 - 1.15)) / 1.15);
    const tb = svgText.getBBox?.() || { x: 300, width: 1000, y: 100, height: 120 };
    if (RM) { titleEl.style.opacity = String(Math.min(clamp(T / 0.8), 1 - out)); stops.forEach((s) => s.setAttribute('offset', 1)); return; }
    // čelo plamene jede zleva doprava, za ním zlato, na čele bílý žár a oranžový lem
    const front = tb.x + (tb.width + 120) * ease(ign) - 60;
    const f = clamp(front / 1600);
    stops[0].setAttribute('offset', clamp(f - 0.09)); stops[1].setAttribute('offset', clamp(f - 0.03)); stops[2].setAttribute('offset', f); stops[3].setAttribute('offset', clamp(f + 0.015));
    if (out > 0) { stops[0].setAttribute('stop-color', `rgb(${Math.round(243 - 160 * out)},${Math.round(210 - 160 * out)},${Math.round(122 - 100 * out)})`); }
    else stops[0].setAttribute('stop-color', '#f3d27a');
    const flick = Math.sin(lt * 23) * 1.5 + Math.sin(lt * 7.3) * 2;
    const sc = LITE ? 0 : (ign < 1 ? 26 - 18 * ign : 7 + flick) + out * 70;
    disp.setAttribute('scale', sc.toFixed(1));
    if (!LITE) turb.setAttribute('baseFrequency', `${(0.012 + out * 0.02).toFixed(4)} ${(0.05 + 0.01 * Math.sin(lt * 2)).toFixed(4)}`);
    titleEl.style.opacity = String(1 - out * out);
    // jiskry: na čele při zapálení, při rozpadu z celého nápisu
    const r = $s('.pf-title svg').getBoundingClientRect(), kx = r.width / 1600, ky = r.height / 300;
    if (playing) {
      emitAcc += ign < 1 ? 1 : out > 0 ? 3 : 0.12;
      while (emitAcc >= 1) {
        emitAcc -= 1;
        const x = out > 0 ? tb.x + Math.random() * tb.width : (ign < 1 ? front : tb.x + Math.random() * tb.width);
        emit(r.left + x * kx, r.top + (tb.y + Math.random() * tb.height) * ky, out > 0 ? 3 : 2, 20, out > 0 ? 90 : 50);
      }
    }
  }

  // ------------------------------------------------------------ malby (Ken Burns, prolínání)
  const pick = (key) => (LITE ? small(key) : largest(key));
  function showShot(key, off = 0, durHint = 20) {
    if (shotShown === key && off === 0) return;
    shotShown = key; shotAt = performance.now();
    slideI = 1 - slideI;
    const el = slides[slideI], im = $('img', el), old = slides[1 - slideI];
    const go = () => {
      el.classList.add('on'); old.classList.remove('on');
      if (!RM) {
        const s = rnd(key.length * 7 + key.charCodeAt(key.length - 1));
        const zin = s > 0.4, dx = (s - 0.5) * 6, dy = (rnd(s * 9) - 0.5) * 4;
        const a0 = `scale(${zin ? 1.06 : 1.2}) translate(${-dx}%, ${-dy}%)`, a1 = `scale(${zin ? 1.2 : 1.06}) translate(${dx}%, ${dy}%)`;
        kb = kb.filter((k) => { if (k.el === im) { k.anim.cancel(); return false; } return true; });
        const anim = im.animate([{ transform: a0 }, { transform: a1 }], { duration: Math.max(8, durHint + 3) * 1000, easing: 'linear', fill: 'both' });
        anim.currentTime = off * 1000;
        if (!playing) anim.pause();
        kb.push({ el: im, anim });
        if (kb.length > 3) kb.shift().anim.cancel();
      }
    };
    const src = pick(key);
    if (im.getAttribute('src') === src && im.complete) go();
    else { im.onload = () => { im.onload = null; go(); }; im.onerror = go; im.src = src; }
  }
  const preload = (key) => { if (key) { const i = new Image(); i.src = pick(key); } };

  // ------------------------------------------------------------ verše uprostřed obrazu
  function showVerse(c, u, off = 0) {
    const U = chapters[c].units[u];
    // odchod předchozího verše: jemný rozpad
    $$('.pf-v', verseEl).forEach((v) => { if (v.dataset.k === `${c}:${u}`) return; v.classList.add('out'); setTimeout(() => v.remove(), RM ? 400 : 1100); });
    if ($(`.pf-v[data-k="${c}:${u}"]`, verseEl)) return;
    const dur = Math.max(1.5, U.end - U.at - 0.35);
    const chars = U.lines.map((l) => l.length), sum = chars.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const html = U.lines.map((l, li) => {
      const ls = 0.15 + (acc / sum) * dur * 0.82; acc += chars[li];
      const lw = (chars[li] / sum) * dur * 0.82;
      const words = l.split(/ +/);
      const st = Math.min(0.22, (lw * 0.55) / Math.max(1, words.length));
      return `<span class="pf-l">${words.map((w, wi) => {
        const bare = w.replace(/^[„(]+/, '');
        const cls = LIGHT.test(bare) ? ' lt' : DARK.test(bare) ? ' dk' : '';
        const d = ls + wi * st - off;
        return `<span class="pf-w${cls}" style="--d:${d.toFixed(2)}s;--dx:${((rnd(li * 31 + wi) - 0.5) * 2).toFixed(2)}">${esc(w)}</span>`;
      }).join(' ')}</span>`;
    }).join('');
    const v = document.createElement('p');
    v.className = 'pf-v' + (U.tercet ? ' terc' : '') + (U.tercet && c === 2 ? ' last' : '');
    v.dataset.k = `${c}:${u}`;
    v.innerHTML = html;
    verseEl.appendChild(v);
    $s('.pf-sr').textContent = cc ? U.lines.join(' ') : '';
    $s('.pf-now').textContent = `Kapitola ${ROM[c]} · ${u === 0 ? 'úvodní trojverší' : `${u}. verš`}`;
    // Selûne × Shar: záře podle obsahu verše (a podle kapitoly: III se k závěru projasní)
    const m = U.mood + (c === 2 && u > chapters[2].units.length - 4 ? 0.6 : 0);
    sel.style.opacity = (0.16 + 0.5 * clamp(m)).toFixed(2);
    shar.style.opacity = (0.18 + 0.55 * clamp(-m) + (c === 1 ? 0.12 : 0)).toFixed(2);
    root.style.setProperty('--tilt', `${(m * 8).toFixed(1)}%`);
  }

  // ------------------------------------------------------------ segmenty
  function stopMedia() {
    Object.values(vids).forEach((v) => { v.pause(); v.classList.remove('on'); });
  }
  async function enter(j, off = 0) {
    const my = ++tok;
    finished = false; root.classList.remove('is-done'); $s('.pf-done').hidden = true;
    idx = j; const s = seg();
    stopMedia(); titleOn = null; titleEl.className = 'pf-title'; titleEl.style.opacity = '';
    if (s.type === 'vid') {
      if (voice.src && !voice.paused && claimed()) voice.pause();
      $$('.pf-v', verseEl).forEach((v) => { v.classList.add('out'); setTimeout(() => v.remove(), 900); });
      root.classList.add('in-vid'); ecl.classList.remove('run');
      const v = vids[s.key]; v.classList.add('on');
      const nx = segs[j + 2]?.key || segs[j + 1]?.key; if (nx && vids[nx]) vids[nx].preload = 'auto';
      try { v.currentTime = Math.min(off, s.dur - 0.05); } catch { /* před načtením */ }
      setTitle(s.key);
      base = off; t0 = performance.now();
      if (playing) v.play().catch(() => {});
      // pod předělem se už načítá první malba kapitoly
      if (s.ch >= 0) { const U0 = chapters[s.ch].units[0]; preload(U0.shot); }
      unitShown = -1;
    } else {
      root.classList.remove('in-vid');
      const c = chapters[s.ch];
      claim('pfilm', () => { if (playing) setPlaying(false, true); });
      if (loadedCh !== s.ch || !voice.src.includes(c.file)) { loadedCh = s.ch; await loadVoice(c.file); if (my !== tok) return; }
      try { voice.currentTime = Math.min(off, c.duration - 0.1); } catch { /* nic */ }
      voice.onended = () => { if (idx === j) next(true); };
      unitShown = -1; shotShown = null;
      // zatmění na začátku kapitoly II (Selûne × Shar): CSS animace, posunutá podle času
      ecl.classList.remove('run'); void ecl.offsetWidth;
      if (s.ch === 1 && off < 9 && !RM) { ecl.style.setProperty('--d', `${-off}s`); ecl.classList.add('run'); }
      if (playing) { try { await voice.play(); } catch { setPlaying(false); root.classList.add('need-tap'); } }
    }
    paintTl(true); loop();
  }
  const claimed = () => window.__audio?.owner?.() === 'pfilm';
  function segTime() {
    const s = seg(); if (!s) return 0;
    if (s.type === 'aud') return claimed() || voice.src.includes(chapters[s.ch].file) ? voice.currentTime : 0;
    return playing ? base + (performance.now() - t0) / 1000 : base;
  }
  const globalT = () => (seg() ? seg().at + segTime() : 0);
  function next(auto = false) {
    if (idx >= segs.length - 1) { finish(); return; }
    enter(idx + 1, 0);
    void auto;
  }
  function finish() {
    if (finished) return;
    finished = true; setPlaying(false, true); stopMedia();
    $$('.pf-v', verseEl).forEach((v) => v.remove());
    root.classList.add('is-done'); $s('.pf-done').hidden = false;
    $s('.pf-done a').focus({ preventScroll: true });
    paintTl(true);
  }
  /** Skok na globální čas. */
  function seek(g) {
    g = clamp(g, 0, total - 0.05);
    const j = segs.findIndex((s) => g < s.at + s.dur);
    const off = g - segs[j].at;
    if (j === idx && !finished) {
      const s = seg();
      if (s.type === 'aud') { voice.currentTime = off; unitShown = -1; $$('.pf-v', verseEl).forEach((v) => v.remove()); ecl.classList.remove('run'); }
      else { base = off; t0 = performance.now(); try { vids[s.key].currentTime = off; } catch { /* nic */ } }
      paintTl(true); loop();
    } else enter(j, off);
  }
  /** Verš vpřed/vzad (←/→). V předělu → = přeskočit předěl. */
  function stepVerse(d) {
    if (!started) return;
    const s = seg();
    if (finished) { if (d < 0) seek(total - 3); return; }
    if (s.type === 'vid') { if (d > 0) next(); else if (segTime() > 1.5 || idx === 0) seek(s.at); else seekUnit(segs[idx - 1].ch, chapters[segs[idx - 1].ch].units.length - 1); return; }
    const c = chapters[s.ch], u = unitAt(s.ch, segTime());
    const t = segTime(), U = c.units[u];
    if (d < 0 && t - U.at > 2 && u >= 0) { seekUnit(s.ch, u); return; }
    const nu = u + d;
    if (nu < 0) { seek(segs[idx - 1].at); return; }
    if (nu >= c.units.length) { next(); return; }
    seekUnit(s.ch, nu);
  }
  function seekUnit(c, u) { const s = segs.find((x) => x.type === 'aud' && x.ch === c); seek(s.at + chapters[c].units[u].at + 0.02); }
  function seekChapter(c) { const s = segs.find((x) => x.type === 'vid' && x.ch === c); if (!started) { go(s.at); return; } if (!playing) setPlaying(true); seek(s.at); }
  function unitAt(c, t) { const us = chapters[c].units; let u = 0; for (let k = 0; k < us.length; k++) if (t >= us[k].at - 0.05) u = k; return u; }

  function setPlaying(p, silent = false) {
    const tNow = segTime();
    playing = p;
    const s = seg();
    root.classList.toggle('paused', !p); root.classList.remove('need-tap');
    if (s?.type === 'vid') {
      // čas předělu se počítá z base/t0: při pauze se zastaví, při přehrání běží dál od téhož místa
      base = tNow; t0 = performance.now();
      if (p) vids[s.key].play().catch(() => {}); else vids[s.key].pause();
    } else if (s?.type === 'aud') {
      if (p) { claim('pfilm', () => { if (playing) setPlaying(false, true); }); voice.play().catch(() => { playing = false; root.classList.add('need-tap'); ui_(); }); }
      else if (!silent || claimed()) voice.pause();
    }
    kb.forEach((k) => (p ? k.anim.play() : k.anim.pause()));
    ui_(); poke();
    if (p) loop();
  }
  function ui_() {
    const b = $s('[data-a="play"]'); $('span', b).textContent = playing ? '❚❚' : '▶';
    b.setAttribute('aria-label', playing ? 'Pozastavit (mezerník)' : 'Přehrát (mezerník)');
    root.classList.toggle('is-playing', playing);
  }
  let lastTlAt = 0;
  function paintTl(force) {
    const now = performance.now();
    if (!force && now - lastTlAt < 200) return;
    lastTlAt = now;
    const g = finished ? total : globalT();
    $s('.pf-bar').style.transform = `scaleX(${(g / total).toFixed(4)})`;
    $s('.pf-time').textContent = `${mmss(g)} / ${mmss(total)}`;
    const tl = $s('#pfTl'); tl.setAttribute('aria-valuenow', Math.round(g)); tl.setAttribute('aria-valuetext', `${mmss(g)} z ${mmss(total)}`);
    const s = seg();
    const ch = s ? (s.ch < 0 ? -1 : s.ch) : -1;
    $$('[data-a="ch"]', root).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.ch === ch)));
    if (s?.type === 'vid') $s('.pf-now').textContent = s.ch < 0 ? 'Úvod' : `Kapitola ${ROM[s.ch]} · předěl`;
  }

  // ------------------------------------------------------------ hlavní smyčka
  function loop() {
    cancelAnimationFrame(raf);
    const step = (now) => {
      if (root.hidden) return;
      const s = seg();
      if (s && started && !finished) {
        const t = segTime();
        if (s.type === 'vid') {
          const v = vids[s.key];
          if (playing && Math.abs(v.currentTime - t) > 0.25 && v.readyState >= 2 && t < s.dur - 0.1) { try { v.currentTime = t; } catch { /* nic */ } }
          drawTitle(t);
          if (playing && t >= s.dur) next(true);
        } else {
          const u = unitAt(s.ch, t);
          if (u !== unitShown) {
            const c = chapters[s.ch], U = c.units[u];
            const off = unitShown === -1 ? Math.max(0, t - U.at) : 0;
            unitShown = u;
            if (cc) showVerse(s.ch, u, off);
            else { $s('.pf-now').textContent = `Kapitola ${ROM[s.ch]} · ${u === 0 ? 'úvodní trojverší' : `${u}. verš`}`; showVerseMoodOnly(s.ch, u); }
            // záběr: začátek běhu se stejnou malbou
            let k0 = u; while (k0 > 0 && c.units[k0 - 1].shot === U.shot) k0--;
            let k1 = u; while (k1 < c.units.length - 1 && c.units[k1 + 1].shot === U.shot) k1++;
            const runEnd = c.units[k1].end, runStart = c.units[k0].at;
            if (shotShown !== U.shot) showShot(U.shot, Math.max(0, t - runStart), runEnd - runStart);
            preload(c.units[k1 + 1]?.shot);
          }
          if (playing && claimed() && voice.ended) next(true);
        }
        drawFx(now, t, s.type === 'aud' ? s : null);
        paintTl();
      }
      if (playing || sparks.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function showVerseMoodOnly(c, u) {
    const U = chapters[c].units[u];
    sel.style.opacity = (0.16 + 0.5 * clamp(U.mood)).toFixed(2);
    shar.style.opacity = (0.18 + 0.55 * clamp(-U.mood)).toFixed(2);
  }

  // ------------------------------------------------------------ otevření / zavření
  function open({ autostart = false } = {}) {
    if (!root.hidden) { if (autostart && !started) go(); return; }
    opener = document.activeElement;
    root.hidden = false; document.documentElement.classList.add('film-open');
    fit();
    root.focus({ preventScroll: true });
    started = false; finished = false; idx = -1;
    root.classList.remove('is-done', 'started'); $s('.pf-done').hidden = true; $s('.pf-start').hidden = false;
    showShot(INTRO_IMG, 0, 30);
    syncVol(); poke();
    if (autostart) go(); else $s('.pf-go').focus({ preventScroll: true });
  }
  async function go(at = 0) {
    unlock();
    started = true; root.classList.add('started'); $s('.pf-start').hidden = true;
    claim('pfilm', () => { if (playing) setPlaying(false, true); });
    try { if (!document.fullscreenElement && root.requestFullscreen && !navigator.webdriver) await root.requestFullscreen({ navigationUI: 'hide' }); } catch { /* nevadí */ }
    playing = true; root.classList.remove('paused'); ui_();
    if (at) seek(at); else await enter(0, 0);
    loop();
  }
  function close(silent = false) {
    if (root.hidden) return;
    tok++; cancelAnimationFrame(raf); playing = false; stopMedia();
    if (claimed()) { voice.pause(); voice.onended = null; release('pfilm'); }
    kb.forEach((k) => k.anim.cancel()); kb = []; sparks = [];
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    root.hidden = true; document.documentElement.classList.remove('film-open');
    $$('.pf-v', verseEl).forEach((v) => v.remove()); ecl.classList.remove('run');
    if (!silent) window.dispatchEvent(new CustomEvent('pfilm:closed'));
    try { opener?.focus?.({ preventScroll: true }); } catch { /* nic */ }
  }
  function again() { $s('.pf-done').hidden = true; root.classList.remove('is-done'); finished = false; playing = true; root.classList.remove('paused'); enter(0, 0).then(loop); ui_(); }

  // ------------------------------------------------------------ ovládání
  function poke() {
    ui.classList.add('show'); clearTimeout(hideT);
    if (playing) hideT = setTimeout(() => ui.classList.remove('show'), 3000);
  }
  root.addEventListener('pointermove', poke);
  root.addEventListener('pointerdown', (e) => { wasShown = ui.classList.contains('show') || e.pointerType === 'mouse'; poke(); });
  root.addEventListener('focusin', poke);
  const volEl = $s('.pf-vol'), muteEl = $s('[data-a="mute"]');
  function syncVol() {
    volEl.value = Math.round(getVolume() * 100); muteEl.setAttribute('aria-pressed', String(isMuted()));
    $('span', muteEl).textContent = isMuted() || getVolume() === 0 ? '✕' : '♪';
  }
  volEl.addEventListener('input', () => setVolume(volEl.value / 100));
  onVolume(syncVol);
  function toggleCc() {
    cc = !cc; root.classList.toggle('no-cc', !cc);
    const b = $s('[data-a="cc"]'); b.setAttribute('aria-pressed', String(cc)); b.setAttribute('aria-label', cc ? 'Verše zapnuté (C)' : 'Verše vypnuté (C)');
    if (!cc) { $$('.pf-v', verseEl).forEach((v) => v.remove()); $s('.pf-sr').textContent = ''; }
    else unitShown = -1;
  }
  const toggleFs = () => { if (document.fullscreenElement) document.exitFullscreen?.(); else root.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}); };
  const toggle = () => { if (!started) { go(); return; } if (finished) { again(); return; } setPlaying(!playing); };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); const a = b?.dataset.a;
    if (a) {
      if (a === 'close') {
        e.preventDefault();
        const href = b.getAttribute('href');
        close(true);
        window.dispatchEvent(new CustomEvent('pfilm:closed', { detail: { href } }));
        return;
      }
      if (a === 'go') go();
      else if (a === 'play') toggle();
      else if (a === 'prev') stepVerse(-1);
      else if (a === 'next') stepVerse(1);
      else if (a === 'ch') seekChapter(+b.dataset.ch);
      else if (a === 'mute') setMuted(!isMuted());
      else if (a === 'cc') toggleCc();
      else if (a === 'fs') toggleFs();
      else if (a === 'again') again();
      return;
    }
    if (e.target.closest('.pf-ui, .pf-start, .pf-done')) return;
    if (!started || finished) return;
    if (root.classList.contains('need-tap')) { setPlaying(true); return; }
    if (!wasShown) return;
    setPlaying(!playing);
  });
  const tl = $s('#pfTl');
  let drag = false;
  const tlSeek = (e) => { if (!started) return; const r = tl.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * total); };
  tl.addEventListener('pointerdown', (e) => { drag = true; tl.setPointerCapture?.(e.pointerId); tlSeek(e); });
  tl.addEventListener('pointermove', (e) => { if (drag) tlSeek(e); });
  tl.addEventListener('pointerup', () => { drag = false; });
  tl.addEventListener('pointercancel', () => { drag = false; });
  tl.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); if (started) seek(globalT() + (e.key === 'ArrowRight' ? 10 : -10)); }
  });
  // klávesy na úrovni dokumentu: film je modální, fokus může být i mimo něj (např. po kliknutí do prázdna)
  document.addEventListener('keydown', (e) => {
    if (root.hidden || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!root.contains(e.target) && e.target !== document.body && e.target !== document.documentElement) return;
    const k = e.key, inRange = e.target.matches?.('input[type=range]');
    if (k === 'Tab') {
      const f = $$('button, a[href], input, [tabindex="0"]', root).filter((x) => x.offsetParent !== null && !x.closest('[hidden]'));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      return;
    }
    if (k === 'Escape') { e.preventDefault(); close(); return; }
    if (inRange && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight')) return;
    if (k === ' ' || k === 'k') { if (e.target.closest('button, a') && k === ' ') return; e.preventDefault(); toggle(); }
    else if (k === 'ArrowRight') { e.preventDefault(); stepVerse(1); }
    else if (k === 'ArrowLeft') { e.preventDefault(); stepVerse(-1); }
    else if (k === '1' || k === '2' || k === '3') { e.preventDefault(); seekChapter(+k - 1); }
    else if (k === 'ArrowUp') { e.preventDefault(); setVolume(getVolume() + 0.1); }
    else if (k === 'ArrowDown') { e.preventDefault(); setVolume(getVolume() - 0.1); }
    else if (k === 'c' || k === 'C') toggleCc();
    else if (k === 'm' || k === 'M') setMuted(!isMuted());
    else if (k === 'f' || k === 'F') toggleFs();
    poke();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPlaying(false); });
  document.addEventListener('fullscreenchange', () => $s('[data-a="fs"]').setAttribute('aria-pressed', String(!!document.fullscreenElement)));

  const A = {
    open, close, seek, seekUnit, seekChapter, stepVerse, toggle, go, segs, chapters, total,
    get playing() { return playing; }, get started() { return started; }, get finished() { return finished; },
    /** Pro testy: co je na obraze a co by podle času zvuku mělo být. */
    state() {
      const s = seg(); const t = segTime();
      const v = $$('.pf-v:not(.out)', verseEl).pop();
      return {
        idx, type: s?.type || null, ch: s?.ch ?? null, t, g: globalT(), playing, started, finished,
        shown: v?.dataset.k || null, expected: s?.type === 'aud' ? `${s.ch}:${unitAt(s.ch, t)}` : null,
        verse: v ? v.textContent.replace(/\s+/g, ' ').trim() : '', title: titleEl.classList.contains('on') ? svgText.textContent : '',
        shot: shotShown, rm: RM, sparks: sparks.length, fx: cv.style.opacity === '1', eclipse: ecl.classList.contains('run'),
        owner: window.__audio?.owner?.() || null, src: voice.src, paused: voice.paused,
      };
    },
  };
  window.__pfilm = A;
  return A;
}

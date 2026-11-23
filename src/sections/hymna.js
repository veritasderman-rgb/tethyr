// 11. Hymna družiny „Rauko“: vlastní přehrávač, text po slokách se zvýrazněním řádku, vizuál reagující na hlasitost.
// Zvuk startuje až po kliknutí. Časy řádků jsou v data/hymna.json (skript scripts/build-hymna.py);
// existuje-li public/hymna/rauko_klip.mp4, je hlavním přehrávačem videoklip (text písně pod ním se zvýrazňuje podle videa)
// a vlastní hudební přehrávač zůstává jako záložní možnost.
import media from 'virtual:media';
import HY from '../../data/hymna.json';
import { img } from '../lib/img.js';
import { $, $$, esc, reduced } from '../lib/util.js';

const PAINT = ['K_026', 'K_032', 'K_034', 'K_031', 'K_027', 'K_033', 'K_028'];
const HAS_CLIP = (media.klip || []).includes('rauko_klip.mp4');
const mmss = (t) => { t = Math.max(0, t || 0); return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`; };

export function renderHymna() {
  const el = $('#hymna');
  const secs = HY.sekce;
  el.innerHTML = `<header class="sec-head"><p class="kicker">Hymna</p><h1 id="hymna-h" tabindex="-1">Rauko</h1>
    <p class="lead">Hymna družiny, napsaná ke čtvrtstoletí hry. Poslouchejte nahlas.</p><div class="orn">✦</div></header>
    ${HAS_CLIP ? `<figure class="hy-vid wrap"><video id="hyClip" controls playsinline preload="metadata" poster="hymna/rauko_klip.jpg" aria-label="Videoklip k hymně Rauko"><source src="hymna/rauko_klip.mp4" type="video/mp4"></video><figcaption>Videoklip k hymně · text písně se pod videem zvýrazňuje podle zpěvu, klepnutím na řádek video skočí na to místo</figcaption></figure>` : ''}
    <div class="hy wrap${HAS_CLIP ? ' with-clip' : ''}">
      ${HAS_CLIP ? '<details class="hy-alt"><summary>Jen hudba · záložní přehrávač</summary>' : ''}
      <div class="hy-left">
        <div class="hy-stage" id="hyStage">
          <div class="hy-paint" aria-hidden="true">${PAINT.map((k, i) => `<div class="hy-p${i === 0 ? ' on' : ''}">${img('ilu/' + k, { alt: '', sizes: '(max-width:900px) 100vw, 60vw', eager: i === 0 })}</div>`).join('')}</div>
          <div class="hy-shade" aria-hidden="true"></div>
          <canvas class="hy-cv" id="hyCv" aria-hidden="true"></canvas>
          <figure class="hy-arch" id="hyArch"><div class="hy-arch-i">${img('port/rauko', { alt: 'Rauko Daerond, portrét', sizes: '(max-width:900px) 60vw, 28vw', pos: '38% 18%' })}</div></figure>
          <div class="hy-cur" id="hyCur" aria-live="off"></div>
        </div>
        <div class="hy-ctl" role="group" aria-label="Přehrávač hymny">
          <button class="btn red hy-play" id="hyPlay" aria-label="Přehrát">▶</button>
          <div class="hy-seek"><input type="range" id="hySeek" min="0" max="1000" value="0" step="1" aria-label="Posuv v písni"><span class="hy-time"><b id="hyT">0:00</b> / <i id="hyD">${mmss(HY.delka)}</i></span></div>
          <div class="hy-vol"><button class="btn sm ghost" id="hyMute" aria-pressed="false" aria-label="Ztlumit">♪</button><input type="range" id="hyVol" min="0" max="100" value="85" aria-label="Hlasitost"></div>
        </div>
        <audio id="hyAudio" preload="none" src="assets/hymna/rauko.mp3"></audio>
      </div>
      ${HAS_CLIP ? '</details>' : ''}
      <div class="hy-lyr" id="hyLyr" tabindex="0" aria-label="Text hymny">
        ${secs.map((s, i) => `<section class="hy-sec" data-s="${i}"><h4>${esc(s.label)}${s.note ? ` <span>${esc(s.note)}</span>` : ''}</h4>
          ${s.lines.length ? s.lines.map((l, j) => `<p class="hy-l" data-t="${l.t}" data-k="${i}-${j}" tabindex="-1">${esc(l.x)}</p>`).join('') : `<p class="hy-l hy-solo" data-t="${s.start ?? 0}" data-k="${i}-s"><span aria-hidden="true">♪ ♪ ♪</span><b class="sr">instrumentální část</b></p>`}</section>`).join('')}
        ${HY.presne ? '' : '<p class="small hy-note">Zvýraznění řádků vychází z odhadnutých časů a může se o vteřinu rozcházet se zpěvem.</p>'}
      </div>
    </div>`;

  const audio = $('#hyAudio', el), clip = $('#hyClip', el) || document.createElement('video');
  const stage = $('#hyStage', el), cv = $('#hyCv', el), ctx = cv.getContext('2d');
  const seek = $('#hySeek', el), tEl = $('#hyT', el), dEl = $('#hyD', el), play = $('#hyPlay', el);
  const lyr = $('#hyLyr', el);
  const lines = $$('.hy-l', el).map((p) => ({ p, t: +p.dataset.t, sec: p.closest('.hy-sec') })).sort((a, b) => a.t - b.t);
  let m = HAS_CLIP ? clip : audio; // aktuální zdroj (videoklip / záložní hudba)
  let mode = HAS_CLIP ? 'clip' : 'audio';
  let ac = null, an = null, freq = null, wave = null;
  const srcNodes = new Map();
  let level = 0, avg = 0, rings = [], embers = [], raf = 0, visible = false, curIdx = -2, paintI = 0, paintT = 0, seeking = false;

  const dur = () => (isFinite(m.duration) && m.duration > 0 ? m.duration : HY.delka || 360);
  const playing = () => !m.paused && !m.ended;
  // odchod na jinou stránku: hymna ztichne (skrytá stránka by jinak hrála dál)
  window.addEventListener('page:change', (e) => { if (e.detail.from === 'hymna') { audio.pause(); clip.pause(); } });

  // ---------- WebAudio analyser (vytvoří se až po prvním přehrání, kvůli autoplay politice)
  function setupAudio() {
    if (ac || reduced()) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.82;
      freq = new Uint8Array(an.frequencyBinCount); wave = new Uint8Array(an.fftSize);
      an.connect(ac.destination);
    } catch { ac = null; }
  }
  function attach(node) {
    if (!ac) return;
    if (!srcNodes.has(node)) { try { srcNodes.set(node, ac.createMediaElementSource(node)); } catch { return; } }
    try { srcNodes.get(node).disconnect(); } catch { /* ještě nepřipojeno */ }
    srcNodes.get(node).connect(an);
  }

  // ---------- přehrávání
  function ui() {
    const p = !audio.paused && !audio.ended;
    play.textContent = p ? '❚❚' : '▶'; play.setAttribute('aria-label', p ? 'Pozastavit' : 'Přehrát');
    stage.classList.toggle('playing', p);
  }
  function use(x) { // přepnout zdroj pro zvýraznění textu; druhý zdroj ztichne
    if (m === x) return;
    (x === clip ? audio : clip).pause();
    m = x; mode = x === clip ? 'clip' : 'audio';
    dEl.textContent = mmss(dur()); sync(true);
  }
  async function toggle() { // vlastní (záložní) přehrávač ovládá jen hudbu
    if (m !== audio) use(audio);
    if (playing()) { m.pause(); ui(); return; }
    setupAudio(); ac?.state === 'suspended' && ac.resume().catch(() => {}); attach(m);
    if (m === audio && audio.preload !== 'auto') audio.preload = 'auto';
    try { await m.play(); } catch { /* blokováno */ }
    ui(); tick();
  }
  play.addEventListener('click', toggle);
  [audio, clip].forEach((x) => { x.addEventListener('ended', () => { ui(); }); x.addEventListener('pause', ui); x.addEventListener('play', () => { use(x); ui(); tick(); }); x.addEventListener('loadedmetadata', () => { if (x === m) dEl.textContent = mmss(dur()); }); });
  seek.addEventListener('input', () => { seeking = true; tEl.textContent = mmss(seek.value / 1000 * dur()); });
  seek.addEventListener('change', () => { use(audio); m.currentTime = seek.value / 1000 * dur(); seeking = false; sync(true); });
  const vol = $('#hyVol', el), mute = $('#hyMute', el);
  const setVol = () => { audio.volume = clip.volume = vol.value / 100; };
  vol.addEventListener('input', () => { setVol(); audio.muted = clip.muted = false; mute.setAttribute('aria-pressed', 'false'); });
  mute.addEventListener('click', () => { const v = mute.getAttribute('aria-pressed') !== 'true'; audio.muted = clip.muted = v; mute.setAttribute('aria-pressed', v); });
  setVol();
  el.addEventListener('keydown', (e) => {
    if (e.target.closest('input[type=range]')) return;
    if (e.key === ' ' && e.target.closest('#hyLyr, #hyStage')) { e.preventDefault(); toggle(); }
  });

  // klik na řádek textu = skok na řádek
  lyr.addEventListener('click', (e) => {
    const p = e.target.closest('.hy-l'); if (!p) return;
    m.currentTime = Math.max(0, +p.dataset.t - 0.2); sync(true);
    if (!playing()) { if (m === clip) clip.play().catch(() => {}); else toggle(); }
  });

  if (HAS_CLIP) clip.addEventListener('timeupdate', () => { if (m === clip && !playing()) sync(true); });

  // ---------- text: zvýraznění řádku
  function sync(force) {
    const t = m.currentTime;
    if (!seeking) { seek.value = Math.round(t / dur() * 1000); tEl.textContent = mmss(t); }
    let idx = -1; for (let i = 0; i < lines.length; i++) if (t + 0.05 >= lines[i].t) idx = i; else break;
    if (idx === curIdx && !force) return;
    curIdx = idx;
    lines.forEach((l, i) => { l.p.classList.toggle('on', i === idx); l.p.classList.toggle('done', i < idx); });
    $$('.hy-sec', el).forEach((s) => s.classList.toggle('cur', idx >= 0 && s === lines[idx].sec));
    const cur = idx >= 0 ? lines[idx] : null;
    $('#hyCur', el).textContent = cur && !cur.p.classList.contains('hy-solo') ? cur.p.textContent : '';
    if (cur) {
      const top = cur.p.offsetTop - lyr.clientHeight / 2 + cur.p.offsetHeight / 2;
      lyr.scrollTo({ top: Math.max(0, top), behavior: reduced() || force ? 'auto' : 'smooth' });
    }
  }

  // ---------- vizuál reagující na hlasitost (střídmě)
  function resize() {
    const r = stage.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d);
  }
  new ResizeObserver(resize).observe(stage); resize();
  function measure() {
    if (an && playing()) {
      an.getByteFrequencyData(freq); an.getByteTimeDomainData(wave);
      let s = 0; for (let i = 0; i < wave.length; i++) { const v = (wave[i] - 128) / 128; s += v * v; }
      const rms = Math.sqrt(s / wave.length);
      level += (Math.min(1, rms * 3.2) - level) * 0.35;
    } else if (playing()) { // bez analyseru (reduced motion / selhání): slabý pulz podle času
      level = 0.25 + 0.1 * Math.sin(performance.now() / 380);
    } else level *= 0.9;
    return level;
  }
  function draw(now) {
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const lv = measure();
    const arch = $('#hyArch', el).getBoundingClientRect(), st = stage.getBoundingClientRect(), d = W / st.width;
    const cx = (arch.left - st.left + arch.width / 2) * d, cy = (arch.top - st.top + arch.height * 0.5) * d;
    const R = Math.max(arch.width, arch.height) * 0.5 * d;
    // záře za portrétem
    const g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * (1.5 + lv * 0.7));
    g.addColorStop(0, `rgba(201,165,74,${0.10 + lv * 0.28})`); g.addColorStop(1, 'rgba(201,165,74,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // spektrum po obvodu (nízké sloupky)
    if (freq && playing()) {
      const n = 56; ctx.lineWidth = Math.max(1.5, 2.2 * d); ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const a = Math.PI * 1.04 + (i / (n - 1)) * Math.PI * 0.92; // oblouk nad portrétem
        const v = freq[Math.floor((i / n) * freq.length * 0.55) + 2] / 255;
        const r0 = R * 1.06, r1 = r0 + (6 + v * R * 0.32) * (0.6 + lv);
        ctx.strokeStyle = `rgba(234,223,198,${0.1 + v * 0.45})`;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * 1.12); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 1.12); ctx.stroke();
      }
    }
    // údery: prstence
    if (lv > avg * 1.35 + 0.08 && playing() && (rings[rings.length - 1]?.k ?? 1) > 0.18) rings.push({ k: 0 });
    avg += (lv - avg) * 0.05;
    rings = rings.filter((r) => r.k < 1);
    for (const r of rings) {
      r.k += 0.011; ctx.strokeStyle = `rgba(201,165,74,${(1 - r.k) * 0.4})`; ctx.lineWidth = 1.5 * d;
      ctx.beginPath(); ctx.ellipse(cx, cy, R * (1.05 + r.k * 0.9), R * (1.05 + r.k * 0.9) * 1.1, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // žhavé jiskry
    if (embers.length < 46 && Math.random() < 0.15 + lv * 0.55) embers.push({ x: Math.random() * W, y: H + 6, v: 0.4 + Math.random() * 0.9, s: (0.6 + Math.random() * 1.6) * d, a: 0.3 + Math.random() * 0.6, w: Math.random() * 6 });
    embers = embers.filter((e) => e.y > -10 && e.a > 0.02);
    for (const e of embers) {
      e.y -= e.v * (0.6 + lv * 2.2) * d; e.x += Math.sin((e.y + e.w * 40) / 38) * 0.35 * d; e.a -= 0.0016;
      ctx.fillStyle = `rgba(232,${150 + Math.floor(e.a * 70)},80,${Math.max(0, e.a)})`; ctx.beginPath(); ctx.arc(e.x, e.y, e.s, 0, 7); ctx.fill();
    }
    // portrét jemně „dýchá“ s hlasitostí
    $('#hyArch', el).style.transform = `scale(${(1 + lv * 0.022).toFixed(4)})`;
    // střídání maleb
    if (now - paintT > 11000) { paintT = now; const ps = $$('.hy-p', el); ps[paintI].classList.remove('on'); paintI = (paintI + 1) % ps.length; ps[paintI].classList.add('on'); }
  }
  function tick() {
    cancelAnimationFrame(raf);
    const f = (now) => {
      sync(false);
      if (visible && !reduced() && mode === 'audio') draw(now);
      if (visible || playing()) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
  }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) tick(); else if (!playing()) cancelAnimationFrame(raf); }, { threshold: 0.05 }).observe(stage);
  sync(true); ui();
}

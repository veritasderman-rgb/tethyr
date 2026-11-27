// Hudební podkres kroniky: klidná smyčka pod celým webem.
// - Hraje od prvního doteku/kliknutí/klávesy (prohlížeče jinak zvuk nepustí), tiše, ve smyčce, přes přechody stránek.
// - Ustoupí (plynule ztichne a pozastaví se), jakmile hraje cokoli jiného se zvukem: svědectví, proroctví,
//   hymna, Dokument, film proroctví, 3D mapa. Po 2,5 s ticha se zase pomalu vrátí.
// - Na stránkách s vlastním zvukem (Hymna, 3D mapa, film proroctví) a při otevřeném Dokumentu nehraje vůbec.
// - Vypínač v horní liště (♪), volba se pamatuje (localStorage 'zd-hudba': 'on' | 'off'). Výchozí: zapnuto.
import './audio.js';   // pravidlo „jeden zvuk“: podkres ostatní nepozastavuje (audio.js ho přeskakuje)

const KEY = 'zd-hudba';
const LEVEL = 0.2;                       // hlasitost podkresu (pod čtením)
const QUIET_PAGES = new Set(['hymna', 'm3d', 'pfilm']);
let on = true;
try { on = localStorage.getItem(KEY) !== 'off'; } catch { /* soukromý režim */ }

const au = new Audio();
au.src = '/hudba/kronika.mp3';
au.loop = true; au.preload = 'none';
au.id = 'bgm'; au.dataset.bgm = '1'; au.hidden = true;
au.setAttribute('playsinline', ''); au.setAttribute('aria-hidden', 'true');
au.volume = 0;
const mount = () => { if (!au.isConnected) document.body.appendChild(au); };
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

let gesture = false, want = 0, timer = 0, quietSince = 0;
function fade() {
  clearInterval(timer);
  let last = performance.now();
  timer = setInterval(() => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    // náběh pomalu, ústup rychle
    const d = want - au.volume, rate = d > 0 ? 0.08 : 0.5;
    if (Math.abs(d) <= rate * dt) { au.volume = want; clearInterval(timer); if (want === 0) au.pause(); return; }
    au.volume = Math.max(0, Math.min(1, au.volume + Math.sign(d) * rate * dt));
  }, 50);
}
/** Hraje teď něco jiného se zvukem? */
function busy() {
  for (const m of document.querySelectorAll('audio, video')) if (m !== au && !m.paused && !m.muted && m.volume > 0) return true;
  return false;
}
function quietPage() { return QUIET_PAGES.has(document.body.dataset.page) || document.documentElement.classList.contains('film-open'); }
function tick() {
  const may = on && gesture && !quietPage() && !document.hidden;
  if (!may || busy()) {
    quietSince = 0;
    if (!au.paused && want !== 0) { want = 0; fade(); }
    return;
  }
  if (!quietSince) quietSince = performance.now();
  if (au.paused || want === 0) {
    if (performance.now() - quietSince < 2500 && au.currentTime > 0) return;   // po jiném zvuku chvíli počkat
    want = LEVEL;
    au.play().then(fade).catch(() => { want = 0; });
  }
}
setInterval(tick, 500);
['pointerdown', 'keydown', 'touchend'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (e.target?.closest?.('#bgmBtn')) return;
  if (!gesture) { gesture = true; quietSince = performance.now() - 2500; setTimeout(tick, 60); }
}, { capture: true, passive: true }));
document.addEventListener('visibilitychange', tick);
window.addEventListener('page:change', () => setTimeout(tick, 60));

function paint() {
  const b = document.getElementById('bgmBtn'); if (!b) return;
  b.setAttribute('aria-pressed', String(on));
  b.title = on ? 'Hudba kroniky: zapnutá (klepnutím vypnout)' : 'Hudba kroniky: vypnutá (klepnutím zapnout)';
  b.querySelector('.sr').textContent = on ? 'Vypnout hudbu' : 'Zapnout hudbu';
}
export function setMusic(v) {
  on = !!v; try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* nic */ }
  paint();
  if (!on) { want = 0; fade(); } else { gesture = true; quietSince = performance.now() - 2500; tick(); }
}
export function initMusic() {
  const b = document.getElementById('bgmBtn'); if (!b) return;
  b.addEventListener('click', () => setMusic(!on));
  paint();
}
window.__bgm = { el: au, isOn: () => on, set: setMusic };   // pro testy

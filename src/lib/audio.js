// Sdílený zvuk svědectví (jeden trvalý <audio> element pro celý web).
// Proč jeden element: prohlížeče (hlavně Safari/iOS) povolí přehrávání zvuku jen elementu, který se
// „odemkl“ v rámci uživatelského gesta. Odemykáme proto při PRVNÍM doteku/kliknutí/klávese kdekoli na stránce
// (ne až při kliknutí uvnitř oddílu Svědectví), takže i svědectví otevřené odkazem z Příběhu, z Bitev nebo
// z Družiny hraje se zvukem. Element je v DOM (skrytý), aby šel najít i v testech.
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';

export const voice = new Audio();
voice.preload = 'auto';
voice.setAttribute('playsinline', '');
voice.id = 'voice';
voice.hidden = true;
voice.setAttribute('aria-hidden', 'true');
const mount = () => { if (!voice.isConnected) document.body.appendChild(voice); };
if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

const KEY = 'zd-hlas';
let vol = 0.9, muted = false;
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) { vol = Math.min(1, Math.max(0, +s.v)); muted = !!s.m; } } catch { /* soukromý režim */ }
if (!isFinite(vol)) vol = 0.9;
voice.volume = vol; voice.muted = muted;

const subs = new Set();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: vol, m: muted })); } catch { /* nic */ } subs.forEach((f) => f()); };
export const getVolume = () => vol;
export const isMuted = () => muted;
export function setVolume(v) { vol = Math.min(1, Math.max(0, v)); if (vol > 0) muted = false; voice.volume = vol; voice.muted = muted; save(); }
export function setMuted(m) { muted = !!m; voice.muted = muted; save(); }
/** Odběr změn hlasitosti (aby šlo synchronizovat posuvníky v přehrávači a ve filmu). */
export function onVolume(f) { subs.add(f); return () => subs.delete(f); }

let unlocked = false, unlocking = null;
export const isUnlocked = () => unlocked;
/** Odemkne zvuk (volat z uživatelského gesta). Tichý vzorek se přehraje jen když element zrovna nehraje. */
export function unlock() {
  if (unlocked || unlocking) return unlocking;
  unlocking = (async () => {
    try {
      if (voice.src && !voice.paused) { unlocked = true; return; }   // už něco hraje: gesto stačilo
      const wasSrc = voice.getAttribute('src');
      if (wasSrc) { unlocked = true; return; }                      // nechceme přepsat rozehraný zdroj
      voice.muted = true; voice.src = SILENCE;
      await voice.play();
      voice.pause();
      unlocked = true;
    } catch { /* gesto nestačilo, zkusí se příště */ }
    finally {
      // po odemčení se zdroj vrátí do čistého stavu, ale jen pokud mezitím nikdo nenastavil vlastní
      if (voice.getAttribute('src') === SILENCE) { voice.removeAttribute('src'); voice.load(); }
      voice.muted = muted;
      unlocking = null;
    }
  })();
  return unlocking;
}
['pointerdown', 'touchend', 'keydown', 'click'].forEach((ev) => document.addEventListener(ev, () => { unlock(); }, { capture: true, passive: true }));

/** Nastaví zdroj a vrátí délku (0 když se nenačetla). Neřeší přehrávání. */
export function load(src) {
  voice.pause();
  voice.onended = null;
  voice.src = src; voice.muted = muted; voice.volume = vol;
  voice.load();
  return new Promise((res) => {
    let done = false;
    const fin = () => { if (done) return; done = true; voice.removeEventListener('loadedmetadata', fin); voice.removeEventListener('error', fin); clearTimeout(tm); res(isFinite(voice.duration) ? voice.duration : 0); };
    voice.addEventListener('loadedmetadata', fin); voice.addEventListener('error', fin);
    const tm = setTimeout(fin, 6000);
    if (voice.readyState >= 1) fin();
  });
}
/** Zastaví a uvolní zvuk. */
export function stop() { voice.pause(); voice.onended = null; }

window.__voice = voice; // pro testy a ladění

// ------------------------------------------------------------------ jeden zvuk najednou (iterace 8)
// Sdílený <audio> používají Svědectví, Proroctví i Dokument. Kdo začne hrát, „převezme“ zvuk (claim) a dosavadní
// vlastník dostane zprávu (onLost), aby přepnul svůj přehrávač do pauzy. Hymna a klipy mají vlastní prvky:
// jakmile začne hrát kterýkoli zvučný prvek, ostatní zvučné se pozastaví.
let owner = null, ownerLost = null;
export function claim(name, onLost) {
  if (owner && owner !== name) { const f = ownerLost; owner = null; ownerLost = null; try { f?.(); } catch (e) { console.error(e); } }
  owner = name; ownerLost = onLost;
}
export const audioOwner = () => owner;
export function release(name) { if (owner === name) { owner = null; ownerLost = null; } }
document.addEventListener('play', (e) => {
  const m = e.target;
  if (!(m instanceof HTMLMediaElement) || m.muted) return;
  // film (Dokument) řídí své zvuky sám: jeho klip hymny nesmí film „připravit“ o hlas ani ho pozastavit
  const inFilm = !!m.closest?.('#film');
  for (const x of document.querySelectorAll('audio, video')) if (x !== m && !x.paused && !x.muted && !(inFilm && (x === voice || x.closest('#film')))) x.pause();
  if (m !== voice && owner && !(inFilm && owner === 'dokument')) { const f = ownerLost; owner = null; ownerLost = null; try { f?.(); } catch (er) { console.error(er); } }
}, true);

/** Plynulé ztišení sdíleného hlasu a pauza (odchod ze stránky). */
export function fadeOut(ms = 700) {
  return new Promise((res) => {
    if (voice.paused) { res(); return; }
    const v0 = voice.volume, t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      voice.volume = Math.max(0, v0 * (1 - k));
      if (k < 1 && !voice.paused) requestAnimationFrame(step);
      else { voice.pause(); voice.volume = vol; res(); }
    };
    requestAnimationFrame(step);
  });
}

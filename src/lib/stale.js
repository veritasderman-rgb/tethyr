// Iterace 10: pojistka proti „staré záložce“ po novém nasazení.
// Otevřená stránka drží starý index.js, jehož dynamické importy míří na chunky se starým hashem; po nasazení na Vercelu
// už neexistují (404) a stránka by skončila chybovým stavem. Proto: (1) při selhání načtení kódu nebo dat stránky
// JEDNOU automaticky načteme aktuální adresu znovu (pojistka v sessionStorage proti smyčce), (2) při přechodu mezi
// stránkami nejvýš jednou za 5 minut porovnáme verzi buildu s /version.json; je-li na serveru novější, další
// navigace proběhne jako plné načtení.
/* global __APP_VERSION__ */
export const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
const KEY = 'zd-reload';
const WINDOW = 60 * 1000;   // druhé selhání do minuty po automatickém reloadu = skutečná chyba, ukázat chybový stav

/** Vypadá chyba jako chybějící chunk / síť (a ne chyba v kódu stránky)? */
export function isLoadError(e) {
  const m = String(e?.message || e || '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading chunk|Loading CSS chunk|data\/[\w-]+\.json: (404|5\d\d)|Failed to fetch|NetworkError|Load failed/i.test(m);
}
/** Jednou automaticky načte aktuální adresu znovu. Vrátí true, když reload proběhne (volající už nic nedělá). */
export function reloadOnce(reason) {
  let last = 0;
  try { last = +sessionStorage.getItem(KEY) || 0; } catch { /* soukromý režim */ }
  if (Date.now() - last < WINDOW) return false;
  try { sessionStorage.setItem(KEY, String(Date.now())); } catch { return false; }
  console.warn('Načítám stránku znovu (nová verze webu?):', reason);
  location.reload();
  return true;
}
// Vite při chybě preloadu (CSS/JS chunk) vyhlásí vite:preloadError: místo výjimky zkusíme jednou reload.
window.addEventListener('vite:preloadError', (e) => { if (reloadOnce(e.payload?.message || 'vite:preloadError')) e.preventDefault(); });

// ------------------------------------------------------------------ kontrola verze při navigaci
let checkedAt = 0, stale = false;
export const isStale = () => stale;
export function checkVersion() {
  if (VERSION === 'dev' || stale || Date.now() - checkedAt < 5 * 60 * 1000) return;
  checkedAt = Date.now();
  fetch('/version.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
    if (j?.v && j.v !== VERSION) { stale = true; console.info('Na serveru je novější verze webu, příští přechod načte stránku celou.', VERSION, '→', j.v); }
  }).catch(() => { /* offline: nic */ });
}
// první kontrola chvíli po startu (ne hned, ať nezdržuje načtení)
setTimeout(() => { checkedAt = 0; checkVersion(); }, 8000);

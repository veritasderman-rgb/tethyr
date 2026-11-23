// Drobné pomůcky sdílené všemi oddíly.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
export function h(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
export const plural = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;
export function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
// Jednopísmenné předložky a spojky na konci řádku: nahradit mezeru pevnou.
export const nb = (s) => String(s ?? '').replace(/(^|[\s(„])([kKsSvVzZoOuUaAiI])\s+/g, '$1$2 ');
/** Doskroluje na prvek a polohu několikrát dorovná (lazy obrázky nad ním posouvají rozložení), dokud uživatel sám neposkroluje. */
export function settleScroll(el, { smooth = false, key = () => true, now = true } = {}) {
  const go = (b) => { const y = el.getBoundingClientRect().top + window.scrollY - (document.getElementById('topbar')?.offsetHeight || 0) - 12; window.scrollTo({ top: y, behavior: b ? 'smooth' : 'auto' }); };
  if (now) requestAnimationFrame(() => go(smooth && !reduced()));
  let touched = false;
  const stop = () => { touched = true; };
  window.addEventListener('wheel', stop, { once: true, passive: true });
  window.addEventListener('touchstart', stop, { once: true, passive: true });
  [450, 1000, 1900, 3300].forEach((ms) => setTimeout(() => { if (!touched && key()) go(false); }, ms));
}

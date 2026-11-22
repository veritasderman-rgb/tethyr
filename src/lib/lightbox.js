// Prohlížeč obrázků (šipky, klávesnice, swipe).
import { $, esc } from './util.js';
let items = [], idx = 0, last = null;
const lb = () => $('#lightbox');
function show() {
  const it = items[idx];
  lb().innerHTML = `<div class="lb-stage"><button class="lb-close" aria-label="Zavřít">×</button>
    ${items.length > 1 ? '<button class="lb-nav lb-prev" aria-label="Předchozí">‹</button><button class="lb-nav lb-next" aria-label="Další">›</button>' : ''}
    <img src="${it.src}" alt="${esc(it.alt || it.cap || '')}"></div><div class="lb-cap">${esc(it.cap || '')}${items.length > 1 ? ` <span class="small">· ${idx + 1}/${items.length}</span>` : ''}</div>`;
  $('.lb-close', lb()).onclick = close;
  $('.lb-prev', lb())?.addEventListener('click', () => go(-1));
  $('.lb-next', lb())?.addEventListener('click', () => go(1));
}
function go(d) { idx = (idx + d + items.length) % items.length; show(); }
function key(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); }
let tx = 0;
export function openLightbox(list, i = 0) {
  items = list; idx = i; last = document.activeElement;
  const el = lb(); el.hidden = false; document.body.style.overflow = 'hidden'; show();
  document.addEventListener('keydown', key);
  el.ontouchstart = (e) => { tx = e.touches[0].clientX; };
  el.ontouchend = (e) => { const d = e.changedTouches[0].clientX - tx; if (Math.abs(d) > 50) go(d < 0 ? 1 : -1); };
  setTimeout(() => $('.lb-close', el)?.focus(), 30);
}
export function close() {
  const el = lb(); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = '';
  document.removeEventListener('keydown', key); last?.focus?.();
}
// Šuplík s detailem (postava, bitva…)
let lastD = null;
function dkey(e) { if (e.key === 'Escape') closeDrawer(); }
export function openDrawer(html, onReady) {
  const el = $('#drawer'); lastD = document.activeElement;
  el.innerHTML = `<div class="dr-panel" role="dialog" aria-modal="true"><button class="dr-close" aria-label="Zavřít">×</button>${html}</div>`;
  el.hidden = false; document.body.style.overflow = 'hidden';
  el.onclick = (e) => { if (e.target === el) closeDrawer(); };
  $('.dr-close', el).onclick = closeDrawer;
  document.addEventListener('keydown', dkey);
  onReady?.(el.firstElementChild);
  setTimeout(() => $('.dr-close', el)?.focus(), 30);
}
export function closeDrawer() {
  const el = $('#drawer'); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = '';
  document.removeEventListener('keydown', dkey); lastD?.focus?.();
}

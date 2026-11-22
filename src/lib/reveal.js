// Odhalování prvků při scrollu (.rv → .in) a jednoduchý parallax.
import { reduced } from './util.js';
let io;
export function observe(root = document) {
  const els = root.querySelectorAll('.rv:not(.in)');
  if (reduced() || !('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  io ||= new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  els.forEach((e) => io.observe(e));
}
// Parallax: prvky s data-par="0.2" se posouvají proti scrollu (rAF, jen když jsou vidět).
const par = new Set();
let ticking = false;
function tick() {
  ticking = false;
  const vh = window.innerHeight;
  for (const el of par) {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) continue;
    const k = parseFloat(el.dataset.par) || 0.15;
    const c = (r.top + r.height / 2 - vh / 2);
    el.style.transform = `translate3d(0, ${(-c * k).toFixed(1)}px, 0) scale(${el.dataset.scale || 1.12})`;
  }
}
export function parallax(root = document) {
  if (reduced()) return;
  root.querySelectorAll('[data-par]').forEach((e) => par.add(e));
  tick();
}
window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
window.addEventListener('resize', () => requestAnimationFrame(tick));

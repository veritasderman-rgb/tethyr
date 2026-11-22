// Střídmé částice popela a prachu na tmavých plátnech (canvas). Běží jen když je plátno vidět.
import { reduced } from './util.js';
export function ash(host, { count = 46, color = '234,223,198', ember = 0.18 } = {}) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'ash';
  c.setAttribute('aria-hidden', 'true');
  host.appendChild(c);
  const ctx = c.getContext('2d');
  let w = 0, hgt = 0, dpr = 1, run = false, raf = 0;
  const P = [];
  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = c.clientWidth; hgt = c.clientHeight;
    c.width = w * dpr; c.height = hgt * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn(p, init) {
    p.x = Math.random() * w; p.y = init ? Math.random() * hgt : hgt + 10;
    p.r = Math.random() * 1.6 + 0.4; p.vy = -(Math.random() * 0.35 + 0.08); p.vx = (Math.random() - 0.5) * 0.18;
    p.a = Math.random() * 0.45 + 0.1; p.ph = Math.random() * 6.28; p.em = Math.random() < ember;
    return p;
  }
  function frame(t) {
    ctx.clearRect(0, 0, w, hgt);
    for (const p of P) {
      p.x += p.vx + Math.sin(t / 2400 + p.ph) * 0.15; p.y += p.vy;
      if (p.y < -10 || p.x < -10 || p.x > w + 10) spawn(p, false);
      const fl = p.em ? 0.6 + 0.4 * Math.sin(t / 300 + p.ph) : 1;
      ctx.fillStyle = p.em ? `rgba(214,120,60,${p.a * fl})` : `rgba(${color},${p.a * 0.7})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    if (run) raf = requestAnimationFrame(frame);
  }
  size();
  for (let i = 0; i < count; i++) P.push(spawn({}, true));
  new ResizeObserver(size).observe(c);
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !run) { run = true; raf = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && run) { run = false; cancelAnimationFrame(raf); }
  }).observe(host);
}

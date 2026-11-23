// Střídmé částice na tmavých plátnech (canvas): popel, jiskry s ocáskem a prach ve světle. Běží jen když je plátno vidět.
import { reduced } from './util.js';
export function ash(host, { count = 46, color = '234,223,198', ember = 0.18, sparks = 0, dust = 0 } = {}) {
  if (reduced()) return;
  const c = document.createElement('canvas');
  c.className = 'ash';
  c.setAttribute('aria-hidden', 'true');
  host.appendChild(c);
  const ctx = c.getContext('2d');
  let w = 0, hgt = 0, dpr = 1, run = false, raf = 0;
  const P = [], S = [], U = [];
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
  // jiskra: rychle stoupá z dolní třetiny, kolísá, hasne
  function spark(p, init) {
    p.x = w * (0.1 + Math.random() * 0.85); p.y = hgt * (init ? 0.3 + Math.random() * 0.7 : 1.02);
    p.vx = (Math.random() - 0.3) * 0.5; p.vy = -(Math.random() * 1.1 + 0.45);
    p.life = 0; p.max = 160 + Math.random() * 200; p.r = Math.random() * 1.1 + 0.6; p.ph = Math.random() * 6.28;
    return p;
  }
  // prach: pomalu plave šikmo ve světelném paprsku, mizí a objevuje se
  function mote(p) {
    p.x = Math.random() * w; p.y = Math.random() * hgt * 0.8; p.vx = 0.05 + Math.random() * 0.12; p.vy = 0.03 + Math.random() * 0.08;
    p.r = Math.random() * 1.4 + 0.5; p.ph = Math.random() * 6.28; p.sp = 0.0006 + Math.random() * 0.0012;
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
    for (const p of U) {
      p.x += p.vx; p.y += p.vy + Math.sin(t / 1700 + p.ph) * 0.05;
      if (p.x > w + 8 || p.y > hgt + 8) mote(p);
      const a = Math.max(0, Math.sin(t * p.sp + p.ph)) * 0.5;
      ctx.fillStyle = `rgba(255,236,190,${a})`; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    for (const p of S) {
      p.life++; p.x += p.vx + Math.sin(t / 380 + p.ph) * 0.35; p.y += p.vy; p.vy *= 0.9992;
      if (p.life > p.max || p.y < -12) { spark(p, false); continue; }
      const k = 1 - p.life / p.max, fl = 0.7 + 0.3 * Math.sin(t / 70 + p.ph);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
      g.addColorStop(0, `rgba(255,190,110,${0.85 * k * fl})`); g.addColorStop(1, 'rgba(214,90,40,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, 6.283); ctx.fill();
      ctx.strokeStyle = `rgba(255,214,150,${0.5 * k})`; ctx.lineWidth = p.r * 0.7;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 7, p.y - p.vy * 7); ctx.stroke();
    }
    if (run) raf = requestAnimationFrame(frame);
  }
  size();
  for (let i = 0; i < count; i++) P.push(spawn({}, true));
  for (let i = 0; i < sparks; i++) S.push(spark({}, true));
  for (let i = 0; i < dust; i++) U.push(mote({}));
  new ResizeObserver(size).observe(c);
  const go = (on) => { if (on && !run) { run = true; raf = requestAnimationFrame(frame); } else if (!on && run) { run = false; cancelAnimationFrame(raf); } };
  let vis = false;
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; go(vis && !document.hidden); }).observe(host);
  document.addEventListener('visibilitychange', () => go(vis && !document.hidden));
}

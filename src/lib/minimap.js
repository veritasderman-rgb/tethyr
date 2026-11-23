// Výřez mapy Torilu s úsekem trasy družiny (indexy do D.map.route). Používá Příběh (mapka u kapitoly)
// a režim „dokument“ ve svědectvích (střih na mapu jen s úsekem jedné kapitoly, ne celou knihou).
import { D } from './data.js';
import { esc } from './util.js';

const MW = 2576, MH = 884;

/** Vrátí { svg, names } nebo null, když úsek nemá body na mapě. opts: aspect, pad, minW, cls, dim, label */
export function routeSvg(idx, { aspect = 2.2, pad = 70, minW = 520, cls = 'mc', dim = 0.42, label = true } = {}) {
  const pts = (idx || []).map((i) => D.map.route[i]).filter((r) => r && r.x != null);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad;
  let y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  let w = Math.max(minW, x1 - x0), h = y1 - y0;
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  if (w > MW) { w = MW; h = Math.min(MH, w / aspect); }
  if (h > MH) { h = MH; }
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  x0 = Math.max(0, Math.min(MW - w, cx - w / 2)); y0 = Math.max(0, Math.min(MH - h, cy - h / 2));
  const sc = w / 1000;
  // úsek přes celý svět se do poměru stran nevejde: radši celý s okraji než oříznutý
  const par = Math.abs(w / h - aspect) > 0.05 ? 'xMidYMid meet' : 'xMidYMid slice';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  const names = [...new Set(pts.map((p) => p.place))];
  const seen = new Set();
  const labels = label ? pts.filter((p) => !seen.has(p.place) && seen.add(p.place)).map((p) => {
    const right = p.x < x0 + w * 0.72;
    return `<text x="${(p.x + (right ? 9 : -9) * sc).toFixed(1)}" y="${(p.y - 7 * sc).toFixed(1)}" text-anchor="${right ? 'start' : 'end'}" class="${cls}-lab" style="font-size:${(15 * sc).toFixed(1)}px;stroke-width:${(3.5 * sc).toFixed(1)}px">${esc(p.place)}</text>`;
  }).join('') : '';
  const svg = `<svg class="${cls}-svg" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}" preserveAspectRatio="${par}" role="img" aria-label="Trasa družiny: ${esc(names.join(', '))}">
    <image href="img/map/toril-2576.webp" x="0" y="0" width="${MW}" height="${MH}"/>
    <rect x="0" y="0" width="${MW}" height="${MH}" fill="rgba(16,14,11,${dim})"/>
    ${pts.length > 1 ? `<path d="${d}" class="${cls}-route" pathLength="1" style="stroke-width:${(2.6 * sc).toFixed(1)}px"/>` : ''}
    ${pts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${((i === 0 || i === pts.length - 1 ? 6 : 4) * sc).toFixed(1)}" class="${cls}-pt" style="animation-delay:${(0.3 + (i / pts.length) * 2.4).toFixed(2)}s"/>`).join('')}
    ${labels}
  </svg>`;
  return { svg, names, era: pts[0].era, box: { w, h, rw: Math.max(...xs) - Math.min(...xs), rh: Math.max(...ys) - Math.min(...ys) } };
}

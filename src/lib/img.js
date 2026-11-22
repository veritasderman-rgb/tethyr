// Obrázky WebP ve více šířkách (vyrábí scripts/build-data.py do public/img/<klíč>-<šířka>.webp).
import { D } from './data.js';
import { esc } from './util.js';

export function srcset(key) {
  const d = D.images?.[key];
  if (!d) return { src: `img/${key}-1280.webp`, set: '' };
  const [w0, , widths] = d;
  const set = widths.map((w) => `img/${key}-${w}.webp ${Math.min(w, w0)}w`).join(', ');
  const mid = widths[Math.min(1, widths.length - 1)];
  return { src: `img/${key}-${mid}.webp`, set };
}
export function ratio(key) {
  const d = D.images?.[key];
  return d ? d[0] / d[1] : 16 / 9;
}
export function largest(key) {
  const d = D.images?.[key];
  return d ? `img/${key}-${d[2][d[2].length - 1]}.webp` : `img/${key}-1280.webp`;
}
export function small(key) {
  const d = D.images?.[key];
  return d ? `img/${key}-${d[2][0]}.webp` : `img/${key}-640.webp`;
}
/** <img> s lazy načítáním a srcset. opts: alt, sizes, cls, eager, pos (object-position) */
export function img(key, { alt = '', sizes = '100vw', cls = '', eager = false, pos = '' } = {}) {
  const { src, set } = srcset(key);
  const st = pos ? ` style="object-position:${esc(pos)}"` : '';
  return `<img class="${cls}" src="${src}"${set ? ` srcset="${set}" sizes="${sizes}"` : ''} alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"${st} onload="this.classList.add('ok')">`;
}

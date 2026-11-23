// Logo webu: heraldický drak se vztyčeným křídlem (iterace 10) (vlastní originální kresba, src/assets/draci.svg), zlatá linka přes currentColor.
// Jediný zdroj: stejný soubor čte build ikon (scripts/build-icons.py → favicon, apple-touch-icon) i vite.config.js
// (dosazení do statického index.html), takže horní lišta, menu, favicon a náhled sdílení ukazují totéž.
// Znak Chrámu Západního úsvitu se na webu používá jen tam, kde jde přímo o chrám.
import raw from '../assets/draci.svg?raw';

export const LOGO_LABEL = 'Západní draci';
/** Inline SVG loga. `size` v px (výška i šířka), `cls` přidá třídy. */
export function logoSvg(size = 28, cls = '') {
  return raw.trim().replace('<svg ', `<svg class="logo ${cls}" width="${size}" height="${size}" role="img" aria-label="${LOGO_LABEL}" focusable="false" `);
}

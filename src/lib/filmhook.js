// Režim Dokument jako adresa /dokument: kód filmu (sections/film.js) se načte až při prvním otevření.
// Router volá open() při vstupu na /dokument a close() při odchodu z ní (zpět, jiný odkaz).
// Když film zavře uživatel (Esc, Zavřít), vrátí se adresa tam, odkud přišel (zpět v historii), nebo na úvod.
import { navigate, legacy } from './router.js';

let mod = null, isOpen = false;
const get = () => (mod ||= import('../sections/film.js'));
export const filmHooks = {
  async open(opts) { isOpen = true; const m = await get(); if (isOpen) m.openFilm(opts); },
  close() { if (!isOpen) return; isOpen = false; mod?.then((m) => m.closeFilm(true)); },
};
window.addEventListener('film:closed', (e) => {
  if (!isOpen) return;
  isOpen = false;
  const href = e.detail?.href;
  if (href) { navigate(href.startsWith('#') ? (legacy(href) || '/') : href, { replace: true }); return; }
  if (location.pathname.replace(/\/+$/, '') !== '/dokument') return;
  if (history.state?.app) history.back(); else navigate('/', { replace: true });
});
// ladění a testy
window.__openFilm = (o) => navigate('/dokument', { gesture: true, ...o });

// Film proroctví (/proroctvi/film, iterace 10): sections/pfilm.js se načte až při prvním otevření.
let pmod = null, pOpen = false;
const pget = () => (pmod ||= import('../sections/pfilm.js'));
export const pfilmHooks = {
  async open(opts) { pOpen = true; const m = await pget(); if (pOpen) m.openFilm(opts); },
  close() { if (!pOpen) return; pOpen = false; pmod?.then((m) => m.closeFilm()); },
};
window.addEventListener('pfilm:closed', (e) => {
  if (!pOpen) return;
  pOpen = false;
  const href = e.detail?.href;
  if (href) { navigate(href, { replace: true }); return; }
  if (location.pathname.replace(/\/+$/, '') !== '/proroctvi/film') return;
  if (history.state?.app) history.back(); else navigate('/proroctvi', { replace: true });
});
window.__openPfilm = () => navigate('/proroctvi/film', { gesture: true });

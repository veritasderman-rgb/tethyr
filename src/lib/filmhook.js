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

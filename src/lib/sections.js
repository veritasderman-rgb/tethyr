// Stránky webu (iterace 8): každá položka menu je samostatná stránka s vlastní adresou (viz router.js).
// Kód stránky se načítá dynamickým importem a data stránky až při prvním vstupu (need). Vykresluje se jednou,
// při dalším vstupu se jen zavolá enter() s parametry z adresy.
import { need } from './data.js';
import { observe, parallax } from './reveal.js';
import { decorate } from './chrome.js';

const REG = {};
/**
 * Zaregistruje stránku: id elementu <section>, funkce, která vrátí modul ({render, enter?, leave?}), a data.
 * enter(route, ctx) dostane rozebranou adresu (route.sub, route.query, route.hash) a ctx {gesture, pop, state}.
 */
export function register(id, load, needs = []) { REG[id] = { id, load, needs, done: null, mod: null }; }
export const sections = () => Object.keys(REG);
export const moduleOf = (id) => REG[id]?.mod || null;

/** Načte kód a data stránky a vykreslí ji (jednou). Vrátí slib s modulem stránky. */
export function ensure(id) {
  const r = REG[id];
  if (!r) return Promise.resolve(null);
  return (r.done ||= Promise.all([r.load(), need(...r.needs)]).then(([mod]) => {
    r.mod = mod;
    const el = document.getElementById(id);
    try { mod.render?.(); decorate(id, el); } catch (e) { console.error('vykreslení stránky', id, e); }
    el?.setAttribute('data-ready', '');
    if (el) { observe(el); parallax(el); }
    return mod;
  }).catch((e) => { console.error('stránka', id, e); r.done = null; throw e; }));
}

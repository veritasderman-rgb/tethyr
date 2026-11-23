// Oddíly se vykreslují líně: až když se k nim čtenář blíží, nebo když na ně vede odkaz či událost.
import { need } from './data.js';
import { observe, parallax } from './reveal.js';
import { decorate } from './chrome.js';

const REG = {};
/** Zaregistruje oddíl: id elementu <section>, vykreslovací funkce a soubory dat, které potřebuje. */
export function register(id, fn, needs = []) { REG[id] = { id, fn, needs, done: null }; }
export const sections = () => Object.keys(REG);

/** Vykreslí oddíl (jednou) a vrátí slib, který se splní po vykreslení. */
export function ensure(id) {
  const r = REG[id];
  if (!r) return Promise.resolve();
  return (r.done ||= need(...r.needs).then(() => {
    const el = document.getElementById(id);
    try { r.fn(); decorate(id, el); } catch (e) { console.error(r.fn.name, e); }
    el?.setAttribute('data-ready', '');
    if (el) { observe(el); parallax(el); }
  }).catch((e) => { console.error('data pro oddíl', id, e); r.done = null; }));
}

// události mezi oddíly: nejdřív se vykreslí cílový oddíl, pak se událost pošle
const TARGET = { witness: 'svedectvi', map: 'mapa', registry: 'lexikon', lexikon: 'lexikon', party: 'druzina', prophecy: 'proroctvi', story: 'pribeh' };
export function emit(name, detail = {}) {
  const sec = TARGET[name.split(':')[0]];
  return (sec ? ensure(sec) : Promise.resolve()).then(() => window.dispatchEvent(new CustomEvent(name, { detail })));
}

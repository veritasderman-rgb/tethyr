// Načítání dat webu po částech (public/data/*.json, generuje scripts/build-data.py).
// Každý oddíl si řekne, co potřebuje (need), a soubor se stáhne jen jednou.
export const D = {};
const P = {};

function derive(f) {
  if (f === 'sessions') D.sesById = Object.fromEntries(D.sessions.map((s) => [s.id, s]));
  if (f === 'world') D.battleById = Object.fromEntries(D.world.battles.map((b) => [b.id, b]));
  if (f === 'characters') D.charById = Object.fromEntries(D.characters.map((c) => [c.id, c]));
  if (f === 'svedectvi') {
    D.witById = Object.fromEntries(D.svedectvi.map((w) => [w.id, w]));
    // svědectví podle sezení / bitvy (pro „střihy“ v příběhu a odkazy u bitev)
    D.witBySrc = {};
    for (const w of D.svedectvi) for (const z of w.zdroje || []) (D.witBySrc[z] ||= []).push(w.id);
  }
  if (f === 'books') D.chById = Object.fromEntries(D.books.flatMap((b) => b.chapters.map((c, i) => [c.id, { ...c, book: b.key, i }])));
}

function load(f) {
  return (P[f] ||= fetch(`data/${f}.json`).then((r) => {
    if (!r.ok) throw new Error(`data/${f}.json: ${r.status}`);
    return r.json();
  }).then((j) => { D[f] = j; derive(f); }).catch((e) => { delete P[f]; throw e; }));
}

/** Zajistí, že jsou načtené dané soubory dat. */
export function need(...files) {
  return Promise.all(files.map(load)).then(() => D);
}

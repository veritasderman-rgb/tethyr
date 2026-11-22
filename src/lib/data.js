// Načtení dat webu (public/data/*.json, generuje scripts/build-data.py).
const FILES = ['sessions', 'books', 'characters', 'npcs', 'world', 'map', 'prophecy', 'timeline', 'gallery', 'svedectvi', 'images'];
export const D = {};
export async function loadAll() {
  const res = await Promise.all(FILES.map((f) => fetch(`data/${f}.json`).then((r) => {
    if (!r.ok) throw new Error(`data/${f}.json: ${r.status}`);
    return r.json();
  })));
  FILES.forEach((f, i) => { D[f] = res[i]; });
  D.sesById = Object.fromEntries(D.sessions.map((s) => [s.id, s]));
  D.battleById = Object.fromEntries(D.world.battles.map((b) => [b.id, b]));
  D.charById = Object.fromEntries(D.characters.map((c) => [c.id, c]));
  D.witById = Object.fromEntries(D.svedectvi.map((w) => [w.id, w]));
  // svědectví podle sezení / bitvy (pro „střihy“ v příběhu a odkazy u bitev)
  D.witBySrc = {};
  for (const w of D.svedectvi) for (const z of w.zdroje || []) (D.witBySrc[z] ||= []).push(w.id);
  return D;
}

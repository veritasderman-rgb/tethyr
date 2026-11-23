// Jednotný „rám“ oddílů: číslování oddílů (Oddíl I–XI), slavnostní předěly, odhalování nadpisů.
// Oddíly se vykreslují líně, proto se rám přidává po vykreslení každého z nich (viz sections.js).
const ORDER = ['pribeh', 'druzina', 'svedectvi', 'bitvy', 'mapa', 'm3d', 'proroctvi', 'osa', 'lexikon', 'stul', 'hymna', 'podekovani'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
export const SECTION_LABEL = { uvod: 'Úvod', pribeh: 'Příběh', mapa: 'Mapa', svedectvi: 'Svědectví', druzina: 'Družina', bitvy: 'Bitvy', proroctvi: 'Proroctví', osa: 'Časová osa', lexikon: 'Lexikon', stul: 'U stolu', hymna: 'Hymna', podekovani: 'Poděkování' };

export function decorate(id, el) {
  const i = ORDER.indexOf(id);
  const head = el?.querySelector(':scope > .sec-head');
  if (i < 0 || !head || head.dataset.dec) return;
  head.dataset.dec = '1';
  void ROMAN; // číslování oddílů (Oddíl I–XI) patřilo k jednostránkové verzi; od iterace 8 je každá stránka samostatná
  head.querySelector('.kicker')?.classList.add('rv', 'd1');
  head.querySelector('h2')?.classList.add('rv', 'd1');
  head.querySelectorAll('.lead, .st-meta, .st-cont').forEach((n) => n.classList.add('rv', 'd2'));
  head.querySelector('.orn')?.classList.add('rv', 'd3');
}

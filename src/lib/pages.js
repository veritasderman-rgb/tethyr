// Čistá data stránek (bez importů): pořadí menu, popisky a krátké popisy. Používá je router (src/lib/router.js)
// i vite.config.js, který z nich při buildu vyrábí statické kopie index.html s vlastním náhledem pro sdílení.
export const SITE = 'Západní draci';
export const ROM = ['I', 'II', 'III', 'IV', 'V'];
export const ROM_NAME = { I: 'první', II: 'druhá', III: 'třetí', IV: 'čtvrtá', V: 'pátá' };

/** Stránky v pořadí menu (pořadí určuje i přechod „Dál“). */
export const PAGES = [
  { id: 'uvod', path: '/', label: 'Úvod', sub: 'Titul, počítadla a vstupy', desc: 'Kronika jedné kampaně Forgotten Realms: Tethyrská královská družina, ve hře 1372–1385 DR, u stolu 2003–2026.' },
  { id: 'pribeh', path: '/pribeh', label: 'Příběh', sub: 'Pět knih, 36 kapitol', desc: 'Třiadvacet let hry převyprávěných v pěti knihách a třiceti šesti kapitolách.' },
  { id: 'druzina', path: '/druzina', label: 'Družina', sub: 'Hráčské postavy a hráči', desc: 'Hráčské postavy Tethyrské královské družiny, kdo je hrál a jak se jim vedlo.' },
  { id: 'svedectvi', path: '/svedectvi', label: 'Svědectví', sub: 'Hlasy přátel i nepřátel', desc: 'Spojenci, nepřátelé a mocní Faerûnu vzpomínají na družinu.' },
  { id: 'bitvy', path: '/bitvy', label: 'Bitvy', sub: 'Bojová hlášení', desc: 'Velké bitvy kampaně jako depeše z bojiště.' },
  { id: 'mapa', path: '/mapa', label: 'Mapa', sub: '2D tažení v čase · 3D Faerûn', desc: 'Interaktivní mapa Torilu s trasou družiny po knihách.' },
  { id: 'proroctvi', path: '/proroctvi', label: 'Proroctví', sub: 'Alaundovo proroctví, čte Alaundo', desc: 'Alaundovo proroctví ve třech kapitolách, namluvené hlasem Alaunda.' },
  { id: 'osa', path: '/osa', label: 'Časová osa', sub: 'U stolu a ve hře', desc: 'Dvojí čas kampaně: léta u stolu a léta ve hře.' },
  { id: 'lexikon', path: '/lexikon', label: 'Lexikon', sub: 'Osoby, místa, frakce, pojmy', desc: 'Osoby, místa, frakce a pojmy z kroniky.' },
  { id: 'stul', path: '/u-stolu', label: 'U stolu', sub: 'Fotky a jak se hrálo', desc: 'Fotky od stolu a jak se hrálo.' },
  { id: 'hymna', path: '/hymna', label: 'Hymna', sub: 'Píseň „Rauko“ s klipem', desc: 'Hymna družiny „Rauko“ s videoklipem a textem.' },
  { id: 'dokument', path: '/dokument', label: 'Dokument', sub: 'Celoobrazovkový film', desc: 'Celoobrazovkový dokument o družině, asi 20 minut.' },
  { id: 'podekovani', path: '/podekovani', label: 'Poděkování', sub: 'Pánu jeskyně', desc: 'Poděkování Pánu jeskyně od všech vděčných hráčů.' },
];

// vnořené stránky mimo menu
export const EXTRA = { m3d: { id: 'm3d', path: '/mapa/3d', label: '3D mapa', parent: 'mapa', desc: '3D mapa Faerûnu a Kara-Turu s místy kampaně.' }, nenalezeno: { id: 'nenalezeno', path: '', label: 'Stránka nenalezena' } };

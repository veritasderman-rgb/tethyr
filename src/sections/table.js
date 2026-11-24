// 10. U stolu: jak se hrálo, kde, plocha a figurky, fotky hráčů a herní plochy.
import { D } from '../lib/data.js';
import { img, small, largest } from '../lib/img.js';
import { $, esc, nb } from '../lib/util.js';
import { openLightbox } from '../lib/lightbox.js';

const CAP = {
  5: '26. dubna 2013. Zleva Zdeněk T., Pepa, Zdeněk K. a Lukáš.',
  6: 'Tomáš, hráč Morderotha.',
  7: 'Zdeněk T., Pán jeskyně, s ohněm.',
  8: 'Tomáš a Venca na chatě v Teplé.',
  10: 'Šablony na šestiúhelníková pole.',
  11: 'Měřítko, podle kterého se hexy na plochu obkreslovaly.',
  12: 'Plocha před malováním.',
  13: 'Plocha ještě bez barev.',
  14: 'Složená plocha v Lázních Kynžvartě.',
  15: 'Lukáš převáží díly plochy.',
  16: 'Figurky na plochu.',
  600: '1. července 2026. Bitevní plocha Anaurochu je sklizená. Hra se dohrála 1. srpna na chatě.',
};
const pad = (n, k = 3) => String(n).padStart(k, '0');
function dtLabel(dt) {
  const m = String(dt || '').match(/(\d{4}):(\d{2}):(\d{2})/);
  return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : '';
}

export function renderTable() {
  const el = $('#stul');
  const where = {};
  for (const s of D.sessions) {
    const w = String(s.where_played || '').split(/,\s*| a /)[0].replace('Ušovice', 'Úšovice').trim();
    if (w) where[w] = (where[w] || 0) + 1;
  }
  const wl = Object.entries(where).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const mx = wl[0]?.[1] || 1;
  const photos = [...D.gallery.foto].sort((a, b) => String(a.dt).localeCompare(String(b.dt)));
  const items = photos.map((p) => ({ key: `foto/${pad(p.n)}`, cap: CAP[p.n] || `U stolu, ${dtLabel(p.dt)}`, n: p.n, year: String(p.dt).slice(0, 4) }));
  const desk = D.gallery.nove.filter((g) => ['stul', 'mapa'].includes(g.kind)).map((g) => ({ key: `nove/n${pad(g.n, 2)}`, cap: g.cap, n: g.n }));
  const all = [...items, ...desk];
  const feat = [5, 7, 14, 16].map((n) => items.find((i) => i.n === n)).filter(Boolean);
  el.innerHTML = `<header class="sec-head"><p class="kicker">U stolu</p><h1 id="stul-h" tabindex="-1">Jak se hrálo</h1>
    <p class="lead">Hra začala roku 2003 s tužkou a papírem v garáži v Lázních Kynžvartě. Skončila po třiadvaceti letech na ručně malované hexové ploše s figurkami z 3D tiskárny.</p><div class="orn">✦</div></header>
    <div class="wrap st-feat">${feat.map((f, i) => `<figure class="st-f f${i} rv d${i % 3}" data-i="${all.indexOf(f)}"><div class="pic">${img(f.key, { alt: f.cap, sizes: '(max-width:760px) 100vw, 50vw' })}</div><figcaption>${esc(f.cap)}</figcaption></figure>`).join('')}</div>
    <div class="wrap-text st-text">
      <h3>Pán jeskyně, hráči a jedna kampaň</h3>
      <p>${nb('Celých třiadvacet let vedl hru jeden Pán jeskyně, Zdeněk T. Hrálo se podle pravidel AD&D druhé edice s vlastními doplňky, jako bylo pravidlo Stres a kuráž nebo bitevní systém. Hrálo se na chatách, v Mariánských Lázních, v Lázních Kynžvartě, u Pána jeskyně doma i u hráčů. V dubnu 2020 se poprvé hrálo po síti.')}</p>
      <div class="st-where"><h5>Kde se hrálo nejčastěji</h5>${wl.map(([k, v]) => `<div class="sw"><span>${esc(k)}</span><i style="width:${(v / mx * 100).toFixed(1)}%"></i><b>${v}</b></div>`).join('')}<p class="small">Podle zápisů sezení v kronice.</p></div>
      <h3>Bitevní systém</h3>
      <p>${nb('Pro velké bitvy si družina napsala vlastní bitevní systém s kartami jednotek. První zkoušky proběhly v létě 2012, v zimě vznikl katalog 29 typů jednotek Aliance a 31 typů jednotek Hordy. Bitva o Rudou pevnost se podle něj hrála čtyři víkendy na jaře a v létě 2013. Z tabulky lodí pak v roce 2015 vznikl námořní bitevní systém, který se poprvé ostře zkoušel na Moři padlých hvězd.')}</p>
      <h3>Stůl, plocha a figurky</h3>
      <p>${nb('O plastické bitevní ploše se rozhodlo 20. března 2023. Pán jeskyně se ptal, jestli do ní jít, když už družina není v pěti, ale ve třech, a ještě ten den se mu po dvou měsících mlčení ozval výrobce z RPG Forge Studio. Plocha stála 10 000 korun a tvoří ji šest desek o metru čtverečním. Lukáš ji 11. května 2024 přivezl od Zábřehu na Moravě.')}</p>
      <p>${nb('Figurky se sháněly od léta 2023. Draky, obry, elementály a démony se tiskly na 3D tiskárně, zmenšené tak, aby se i největší tvor vešel na podstavec 2,5 cm a tím na jedno pole. Jsou křehké a musí se s nimi opatrně. Postupně přibyly lodě, věže, obléhací stroje, jízda, pěchota a letecké jednotky.')}</p>
      <p>${nb('Místo pro plochu našel Lukáš v bytě v Lázních Kynžvartě, který družina užívala od léta 2024 dva roky. Pod plochu se postavil stůl z OSB desek na trámcích, vysoký 75 cm, aby bylo na jednotky vidět shora. V září 2024 dostala plocha podle šablony šestiúhelníková pole, která se na ni ručně domalovávala fixami. Dodělávaly se i barvy, přechody a detaily; podíleli se na tom hlavně Lukáš a Zdeněk T. Hotová byla 6. května 2025.')}</p>
      <p>${nb('Jednotky Aliance se v červnu 2025 skládaly ve sdílené tabulce do legií po tisíci mužích, některé zůstaly jako dvojlegie. Kouzlící jednotky dostaly seznamy kouzel pro 6., 9. a 12. úroveň. Pepa k tomu na jaře 2026 napsal simulátor, který vyhodnocoval střety legií. Na ploše se hrálo od května 2025 do června 2026.')}</p>
    </div>
    <div class="wrap st-grid" role="list" aria-label="Fotky od stolu">${all.map((it, i) => `<button class="st-p" role="listitem" data-i="${i}" aria-label="${esc(it.cap)}"><img src="${small(it.key)}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')"></button>`).join('')}</div>`;
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    openLightbox(all.map((it) => ({ src: largest(it.key), cap: it.cap })), +b.dataset.i);
  });
}

# Iterace

## Iterace 1 – první úplná verze (22. 11. 2026)

### Hotovo
- **Kostra a technika:** Vite + čistý JS, `base: './'`, výstup `dist/`. Písma z `@fontsource`, Leaflet z npm. `scripts/build-data.py` vyrábí z kroniky data (`public/data/*.json`) a obrázky WebP ve dvou až třech šířkách (cca 56 MB, 730 souborů). Čistí jména hráčů a hlásí zakázaný obsah.
- **1. Úvod:** malba obálky s pomalým nájezdem, částice popela, název, oba časy, počítadla (sezení, léta, postavy, bitvy, vedlejší postavy), vstupy do příběhu a do svědectví.
- **2. Příběh:** pět knih jako kapitoly; každá má plátno přes celou obrazovku s parallaxem, perex, hlavní místa a protivníky, souběžné hry (Pět let klidu, Sigilští lovci, Druhá hra, Epilog, 5e). 37 kapitol s vlastním vyprávěním (`data/vypraveni.json`), sezení na časové lince s datem u stolu i ve hře, místem hraní, hráči, malbami, podklady PJ a fotkami (lightbox), rozbalitelnými podrobnostmi (vedlejší postavy s proklikem do rejstříku, lore). Mezi kapitolami střihy na svědectví a v každé knize střih na mapu s kreslenou trasou. Bitvy jsou vložené u sezení, kde se dohrály.
- **3. Mapa:** Leaflet nad mapou Torilu, 66 míst, animovaná trasa po knihách (přehrát, krokovat, posuvník), filtr knih, detail místa (co se tam stalo, sezení, kdo tam žije), místa mimo mapu (sféry).
- **4. Svědectví:** 31 promluv (`data/svedectvi.json`: 12 hráčských postav, 12 spojenců, 6 nepřátel, Turgen jako dovětek), každá 93–129 slov, vlastní způsob mluvy, zdroje v polích `zdroje`. Přehrávač: portrét přes celou obrazovku s pomalým nájezdem k bodu zájmu, dýcháním, pohyblivým světlem, zrnem, vinětací a parallaxem za myší; dolní titulek jméno + role + strana; titulky po větách. Audio/video z `assets/voices` a `assets/video` přes manifest pluginu (bez nich časování podle textu). Ovládání: přehrát/pauza, předchozí/další, ztlumení, filtr přátelé/nepřátelé, výběr osoby, přepis se zdroji, „Přehrát vše jako dokument“ s prolínačkami na malby bitev.
- **5. Družina:** karty hráčských postav s portréty, detail v šuplíku (život ve dvou časech, úrovně, předměty, schopnosti, vztahy, osud, sezení, odkaz na svědectví), další postavy, průvodci a protivníci, tabulka hráčů s pruhy let.
- **6. Bitvy:** 14 bojových hlášení (strany, velitelé, soupisky s rozbalením, průběh, výsledek, malby), odkazy na svědectví obou stran.
- **7. Proroctví:** tři kapitoly, verše se odhalují při scrollu, vlevo malba kapitoly (mění se podle čtené kapitoly), u 29 veršů obraz, u 8 dvojverší „komu patří“ (jen výklady doložené v datech nebo v písních hráčů).
- **8. Časová osa:** vlastní SVG z dat `osa.py` (linky postav s hráči, knihy, události, sezení s proklikem, DR pod lety), přiblížení, malovaná osa v prohlížeči s přiblížením, herní letopočet.
- **9. Rejstřík:** 810 vedlejších postav, hledání bez diakritiky, filtr skupina a strana, odkazy na sezení.
- **10. U stolu:** výběr fotek, jak se hrálo, kde se hrálo nejčastěji (z dat), bitevní systém, plocha a figurky (3D tisk, hexy ručně – Lukáš a Zdeněk T.), mřížka všech fotek a podkladů s lightboxem.
- Responzivita 390 px až desktop, `prefers-reduced-motion`, klávesnice (tlačítka, šipky v přehrávači, Esc), alt texty, lazy-load a `srcset`.
- Ověřeno v Chromiu (Playwright): build, preview, snímky desktop 1440×900 a mobil 390×844 všech oddílů v `/home/claude/webshots/`, konzole bez chyb. Opraveno: `hidden` u lightboxu přebíjený `display: grid` (překrýval celou stránku), přetékání stránky na mobilu (kolize třídy `.pl`), výřez mapy, tmavé linky na ose, předčtení obrázku na mobilu.

### Slabší místa a co zbývá
- Audio a video ke svědectvím zatím nejsou (dodá zadavatel); přehrávač je otestovaný jen v režimu bez médií.
- U nepřátel bez portrétu se jako „tvář“ používají malby scén (Yamoh, Yamun, Thalaxia, Axel, Devrel, Rivalen). Pro filmový dojem by pomohly samostatné portréty; Sar Saratar, Šivan, Zesion jako hlas zatím chybí.
- Vyprávění ke kapitolám je 1–2 odstavce; sezení samotná mají text kroniky. Detailnější převyprávění jednotlivých sezení z textů hráčů (deníky, Zápisky) je práce na další kola.
- Párování vedlejších postav se sezeními je jen podle jmen v textu (159 z 810 postav má proklik na sezení).
- Časová osa: popisky událostí se v hustých letech 2011–2014 při výchozím přiblížení překrývají.
- Mapa: místa mimo mapu (sféry) jsou jen jako tlačítka; trasa mezi nimi a Torilem se nekreslí.
- Výkon: všechna data (~750 kB JSON) se načítají najednou; obrázky jsou lazy. Pro slabší mobily by šlo data dělit.

## Iterace 2 – svědectví NPC s hlasem a videem, hymna, poděkování, 3D mapa (23. 11. 2026)

### Hotovo
- **Svědectví jen NPC, nová sada v2.** `data/svedectvi.json` se generuje skriptem `scripts/import-svedectvi.py` ze `svedectvi_v2.json` (33 NPC: 21 spojenců, neutrální Iryklathagra, 6 nepřátel, 5 hlasů z nadhledu; text přesně, bez zásahu; skript jde spustit znovu, zdroj se během práce měnil a pipeline to snesla). Hráčské postavy nemají promluvu, hlas ani video; v Družině jsou odkazy na svědectví hráčských postav zrušené (a skript je nepustí do dat). Starý odkaz na `khelben` (3D mapa) se přesměruje na Dceru Khelbena Arunsuna.
- **Média:** 33 hlasů + `timing.json` (titulky po větách přesně podle časů), 33 videí „živých portrétů“ jako smyčky (konec prolnutý do začátku, crf 27, ~50 MB assets), portréty z posterů/`_portret.png`. `scripts/build-media.py` kopíruje a překódovává, jde spouštět opakovaně (po nových hlasech znovu `import → build-media → build-data → build`). Přehrávač otestován s audiem i videem (Playwright): video ztlumené ve smyčce, titulky podle časů, ovládání, přeskoky, hluboký odkaz bez autoplaye (tlačítko „Spustit“).
- **Padlí a zmizelí svědkové** (`stav`, `stav_titulek`): studenější a tlumenější obraz, titulek „† padl … · hlas z minulosti“. Řádek „vazba“ pod jménem i pod přehrávačem, odkazy na zdrojová sezení a bitvy.
- **Režim „Přehrát vše jako dokument“** (`data/dokument.json`): knihy I–V, střídání spojenců, nepřátel a hlasů z nadhledu, mezi tím karta knihy, mapa s kreslenou trasou a malby bitev; Elminster je závěr, pak závěrečná karta s odkazy na Hymnu a Poděkování. Opravené chyby z rozdělané práce: po střihu se hlas nespustil (stav „inter“), chybělo CSS střihů (mapa se kreslila černě), tlačítko „Spustit“ zakrývaly letterbox pruhy, výběr svědka posouval stránku mimo přehrávač.
- **Pán jeskyně je Zdeněk T.** (oprava u Lukáše v tabulce hráčů, popisy v Družině i U stolu; Lukáš je hráč Rauka).
- **Hymna:** nová sekce, vlastní přehrávač (play/pauza, posuv, hlasitost), text po slokách se zvýrazněním řádku (klik na řádek skočí), malby bitev a Raukův portrét, vizuál z WebAudio analyseru (záře, prstence, spektrum, jiskry; střídmě, vypnuté při reduced motion). Videoklip se nabídne, jakmile existuje `rauko_klip.mp4` (kód otestovaný na zkušebním klipu). Odkaz z úvodu, z menu i z patičky.
- **Poděkování:** závěrečná sekce s textem přesně podle `podekovani.txt`, klidná sazba, fotka od stolu (26. 4. 2013), odkaz z úvodu a patičky.
- **3D mapa:** `public/mapa3d/` (36 MB), v sekci Mapa výrazný vstup (celoobrazovkový odkaz + náhled v iframu s `allow="fullscreen; autoplay"`, načte se až po kliknutí). Kotvy `#s-…`, `#b-…`, `#svedectvi/<id>`, `#mapa`, `#pribeh` ověřené (router v `main.js`, rozbalí podrobnosti a dorovná polohu po načtení lazy obrázků; stejné dorovnání mají odkazy z menu). Polohy tethyrského shluku opravené i ve 2D mapě (`MAP_FIX`, Castle Tethyr už není v moři).
- **Vercel:** z čistého výpisu repa (bez `/home/claude`) projde `npm ci && npm run build`; data, obrázky, audio i video jsou v repu. Pracovní strom ~144 MB.
- Zdrojová data kroniky se mezitím upravila (Seung Mina z Feng Asay, Sar Sarathal, Rivalen a další); `build-data.py` je převzal.

### Slabší místa a co zbývá
- **Časy zvýraznění hymny** jsou z `timing.json` od zadavatele (ASR s ruční korekcí, úvod jen odhad); skript `build-hymna.py` umí i jednodušší formáty. Videoklip zatím neexistuje (po dodání `rauko_klip.mp4` stačí `build-media.py` a build).
- **Shoda hlasu s textem** se ověřila jen podle počtu vět a časů; po každé úpravě `svedectvi_v2.json` je nutné znovu namluvit změněné promluvy. Poznámky autora k nejistým faktům (Seung Mina ve Feng Asay, Khelben jako živý, Alustriel, Yamoh × Ho…) jsou v `/home/claude/voices/svedectvi_v2_poznamky.md`.
- **3D mapa** je ověřená jen v Chromiu se SwiftShaderem; na reálném telefonu, v Safari a ve Firefoxu netestovaná (těžká na GPU, náhled v iframu načítá ~14 MB modelů a zvuků).
- Zbytky z iterace 1: časová osa se v hustých letech překrývá, místa mimo mapu jsou jen tlačítka, všechna data (~750 kB JSON) se načítají naráz, svědectví nemají přepis ve vlastním odkazu a Safari/iOS (autoplay videa a zvuku, `playsinline`) nebylo testováno.
- Mapa v dokumentu: u knihy I zabírá trasa celý svět, takže střih připomíná spletenec čar; chtělo by zkrácené trasy po tažení.

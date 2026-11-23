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

## Iterace 3 – obsah a vyprávění (23. 11. 2026)

### Hotovo
- **Příběh jako čtení.** Všech 36 kapitol má nové převyprávění o 4–8 odstavcích (celkem asi 10 400 slov) v `data/vypraveni/1.md`–`4.md`. Opírá se o sezení, svět a postavy z dat kroniky a o texty hráčů a Pána jeskyně (Zápisky = Hoův deník, Chrám Západního úsvitu, Pravidla mistra Ho, Tempovi bitevní mágové, Hoova Budoucnost 2012, Budoucnost 2026, Hoův deník – přepis, Alaundovo proroctví, píseň „Soukolí věčnosti“). Citace z textů jsou vysázené jako citace s křestním jménem autora. Zapracovaná upřesnění autora: Ho Yamoha Hokhru přesvědčil k ústupu (zmizel v dračí podobě i se svými lidmi), Sar Saratara rozdrtil Elminster, Rauko svedl finální boj s Rivalenem na vrcholu pyramidy, Seung Minu Ho osvobodil z Feng Asay a stala se jeho ženou, Khelben zmizel a nahradila ho dcera. Při kontrole se opravila i fakta proti datům (Gark a Aerton se navzájem zabili, Hwang a Li-Long stáli po boku družiny, Varion padl do rukou Zesion…).
- `scripts/vypraveni.py` text parsuje a kontroluje: platnost všech odkazů, 4–8 odstavců, zakázaná slova a příjmení, otazníky v odstavcích, autor citace musí být hráč nebo PJ.
- **Čtenářský komfort:** obsah kapitol s postupem čtení (vlevo na širokých obrazovkách, jinak vysouvací list s tlačítkem „Obsah · kap. N“), lišta postupu nahoře, kapitola se označí jako přečtená až po dočtení a chvíli strávené v ní, „Pokračovat ve čtení“ v hlavičce Příběhu i v úvodu (localStorage v try/catch), odhad délky čtení u kapitol a knih, klávesy ←/→ mezi kapitolami, sloupec ~68 znaků s dělením slov, iniciála, citace, marginálie s datem u stolu, ve hře a místem hraní, „Kdo hrál“, úvodní malba kapitoly, galerie (malby, podklady PJ, fotky) s lightboxem, kronika sezení sbalená pod vyprávěním, odkazy na předchozí a další kapitolu.
- **Propojení:** odkazy v textu otevírají svědectví (rovnou s hlasem a videem), místo na 2D mapě s kartou místa a vedle něj ve 3D mapě (`mapa3d/index.html#p=…`), bojové hlášení, verš proroctví (zvýrazní a otevře výklad), kartu postavy. Pod každou kapitolou svědci s portréty, místa, bitvy a mapka s úsekem trasy kapitoly (`CH_ROUTE`).
- **Opravy:** časová osa rozkládá popisky událostí do řádků bez překryvů (test počítá překryvy: 0); střih na mapu v režimu dokument ukazuje jen úsek jedné kapitoly (`dokument.json`, pole `ch`; kniha I = Štíty Apokalypsy), mapky přes celý svět se zobrazí celé místo oříznutí; data se načítají po oddílech (`need`/`ensure`/`emit`), při startu jen úvod a Příběh, ostatní při přiblížení nebo přes odkaz/událost.
- **Hymna:** hlavním přehrávačem je videoklip `public/hymna/rauko_klip.mp4` (z `rauko_klip_v1.mp4`, 1280×720, crf 31, faststart, 39 MB, plakát `rauko_klip.jpg`); text pod ním se zvýrazňuje podle videa a klik na řádek video posune. Vlastní hudební přehrávač zůstal jako záložní ve sbaleném bloku.
- Ověřeno v Chromiu (Playwright, `scripts/shots3.py`): desktop 1440×900 a mobil 390×844, snímky v `/home/claude/webshots/it3/`, testy kláves, obsahu, všech druhů odkazů, pokračování ve čtení, hymny a dokumentu prošly, konzole bez chyb. `npm ci && npm run build` projde z čistého klonu.

### Slabiny a co zbývá
- Vyprávění je u řídce zapsaných kapitol (Námořní tažení, Lovci v Turmishi, Cesta Západních draků) kratší, protože data mlčí; doplnit by šlo jen z dalších textů hráčů (nenafocený pozdější Hoův deník, Turgenův deník, přepisy e-mailů PJ).
- Autorství některých textů je odvozené (Budoucnosti = Zdeněk T., Zápisky a Chrám = Pepa, TBM = Lukáš); texty bez jasného autora (Nemesiáni, kael.txt, avernus.txt, syn.txt) se necitují.
- Repo má s videoklipem asi 182 MB pracovního stromu (nad původním cílem ~150 MB).
- Pořadí trasy v `map.json` je místy klikaté, takže mapky některých kapitol (Shou Lung) mají překřížené čáry.
- Safari/iOS, Firefox a skutečný telefon dál netestované; marginálie a obsah vlevo potřebují šířku aspoň 1180/1280 px, pod ní jsou marginálie nad odstavcem.

## Iterace 4 – svědectví jako dokument a mobil (23. 11. 2026)

### Hotovo
- **Galerie svědectví:** tři skupiny (Spojenci 20, Nepřátelé 7, Mocní Faerûnu 6), jmenovky v dokumentárním stylu, stav živý / padlý / zmizelý; šest padlých nebo zmizelých je ztlumených s křížkem a rokem (`data/svedkove-stav.json`). Přehrávač s videem ve smyčce, hlasem, titulky po větách podle `timing.json`, pauzou, dalším svědkem, ±10 s, hlasitostí a automatickým pokračováním ve zvoleném střihu (nabídka dalšího svědka 4 s).
- **Zvuk po kliknutí:** sdílený `<audio>` v DOM odemčený prvním gestem; ověřeno skutečným klikem, že svědectví otevřené odkazem z Příběhu a Bitev hraje se zvukem (desktop i mobil). Dříve se test mýlil, protože prvek nebyl v DOM.
- **Režim Dokument:** celoobrazovkový film, 14:22 bez hymny a 20:22 s ní (úvod, pět knih, finále Rivalen + Elminster, závěrečná karta, poděkování Pánu jeskyně, klip hymny). Mapa s trasou, malby s pomalou kamerou, svědci (přítel i nepřítel), mezititulek s rokem. Mezerník, šipky, Esc, časová osa s kapitolami, titulky zap/vyp. Celý průchod zrychleně přes konce segmentů prošel na obou rozlišeních bez slepé uličky a s čistou konzolí.
- **Mobil 390×844:** spodní lišta, hamburger pro zbytek, `100dvh`, bezpečné okraje, dotykové cíle ≥ 44 px (kontrola ve `shots4.py`), žádné přetékání ve všech 12 oddílech. Oříznutí tváří na úzkých displejích opravené úpravou `fokus` (Thalaxia, Hasagi, Mitsurugy, Alusair).
- Hráčské postavy bez svědectví, hlasu a videa (`test-players.py`); žádné placené generátory.

### Slabiny
1. **Kniha III nemá nepřátelského svědka**, protože data k ní žádného nepřítele nevážou (Turfin + Isis).
2. **Nezkoušeno v Safari/iOS, Firefoxu a na skutečném telefonu.** Zvuk klipu hymny na iOS může zablokovat systém (je záložní překryv s klepnutím); odemykání audia je ověřené jen v Chromiu.
3. **Těžké soubory:** klip hymny (39 MB) a 3D mapa; film klip předčítá i na mobilních datech, repo je dál nad 180 MB.
4. **Časová osa na mobilu:** linky postav mají neviditelnou dotykovou plochu 44 px, ale sousední linky se překrývají, takže zásah je přesný jen přibližně; popisky mají 18 px.
5. **Ořez tváře na výšku závisí na ručním `fokus`** v datech; u nových svědků je nutné ho nastavit. Drobnost: horní popisek „Trasa:“ se na mobilu může překrýt s názvem místa na mapě; stará CSS `.w-inter`/`.wi-card` je nepoužitá.

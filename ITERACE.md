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

## Iterace 5 – mapa tažení, 3D Faerûn a váha webu (23. 11. 2026)

### Hotovo
- **2D mapa tažení (přepsaná):** přehrávání cesty v čase (▶/pauza, krok, skok po kapitolách, rychlost 0,5–4×), posuvník let s popisky u stolu 2003–2026 nebo DR a barevným pruhem knih, trasa se kreslí postupně a plynule (dlouhé přesuny obloukem, aby se cesty tam a zpět nepřekrývaly), barva podle knihy, úseky aktuální kapitoly svítí a starší ustoupí, aktuální místo pulzuje, při vstupu do kapitoly titulek a přiblížení na celou kapitolu. Karta místa: co se tam stalo (s odkazem „na trase“), kapitoly Příběhu, bitvy, svědci s portréty, sezení, kdo tam žije, odkaz do 3D mapy; karta bitvy (strany, velitelé, výsledek, svědci, bojové hlášení). Filtry knih, vrstvy (trasa, sídla a místa, bitvy, plány existence, popisky), pohledy Celek / Faerûn / Kara-Tur / Sféry (deset sfér jako sloupec za západním okrajem mapy), shlukování blízkých míst a popisky bez překryvu, klávesnice (mezerník, `,` `.`, `[` `]`, `1`–`6`, `0`, `Esc`).
- **Pořadí trasy podle chronologie sezení** (`ROUTE_REORDER` v `build-data.py`, kapitoly se přepočítají): Shou Lung bez překřížení (Kuo Te' Lung → T'u Lung → Wu Pi Te Shao → Ohňové hory → Tuigan → Khazari → Balanzie → Port; pořadí ze shrnutí s-2006, zbytek tak, aby se čáry nekřížily), návrat 2006–2007 (Údolí a Chrám ze s-2006-12, pak Tyrův chrám a Subotami, pak Maztica), Štíty Apokalypsy, Khôltar/Chult. Překřížení v kapitolách: Shou Lung 2 → 0, Khôltar 1 → 0, Štíty 2 → 1, návrat 1 → 1 (data víc neurčují). Totéž pořadí převzala 3D mapa.
- **Ořez severu v režimu Dokument opravený:** výřez mapy kapitoly se smí rozšířit za okraj podkladu (tmavé pozadí), takže Pevnost Rudé rytířky a Reghedský ledovec (10 px od horního okraje) už nejsou uříznuté; ve filmu je nahoře víc místa pro horní lištu.
- **3D mapa Faerûnu:** **přelet tažením** (✈, `T`, `#prelet`) – autopilot po zastávkách s kamerou za praporem, velké titulky kapitol (kniha, léta, DR, název, místo), filmové pruhy, `Esc` ukončí; rychlost 0,5–4×. Zastávky znají kapitolu, deník i karta místa odkazují zpět do Příběhu (`#ch-…`), nové kotvy `#ch=…`. **Výkon:** pečení statických tvarů do jedné geometrie, vojska jako `InstancedMesh`, dvě úrovně detailu terénu, meče bitev jen do rozumné vzdálenosti (celkový pohled na PC 533 → 205 draw calls, 1,24 M → 0,38 M trojúhelníků; Anauroch zblízka na telefonu až 1171 → 73 draw calls). Další modely z Desetiměstí ve městech, přístavech a trpasličích sídlech (domy, krčma, kovárna, studna, stánky, sýpka, strážnice, jeřáb, sušák ryb, loďky, mlýn). **Načtení na požádání:** na telefonu, při úsporném režimu dat nebo pomalém připojení tlačítko „Načíst 3D mapu“, do té doby se nestáhne ani three.js ani terén (ověřeno v Playwrightu); iframe z kroniky (`?embed=1`) se načte rovnou po klepnutí. Média svědků a obrázky bere z webu (`../assets`, `../img`), žádné kopie.
- **Váha** (`scripts/weight.py`, headless Chromium, bez scrollování; velikost `du -sb` bez node_modules, dist, .git):

  | | před | po |
  |---|---|---|
  | první načtení úvodní stránky (desktop i mobil) | 1,44 MB / 29 požadavků | **0,95 MB** / 28 požadavků |
  | pracovní strom repa | 187,1 MB | **147,8 MB** |
  | `public/mapa3d` | 36,1 MB | 13,9 MB (bez duplicitních médií, bez 10 nepoužitých modelů) |
  | `assets` (hlasy, videa, hymna) | 51,7 MB | 41,4 MB (hlasy 128 → 96 kb/s mono, hymna 186 → 128 kb/s bez obalu) |
  | `public/img` | 58,6 MB | 53,1 MB (malby, podklady, fotky WebP q 68, method 6) |
  | `public/hymna` (klip) | 39,3 MB | 37,9 MB (zvuk AAC 128 kb/s, obraz beze změny) |
  | 3D mapa do připravenosti (PC) | ~4,9 MB | ~4,0 MB |

  Mapka kapitoly v Příběhu stahuje podklad (450 kB) až při přiblížení. Videa svědků zůstala 1280×720, crf 27, bez zvuku (odpovídá zadání). Modely GLB už byly komprimované meshopt a kvantizací.
- Ověřeno v Playwrightu (desktop 1440×900, mobil 390×844, snímky `/home/claude/webshots/it5/`): `scripts/test-it5-map.py` (28 kontrol: přehrávání, kapitoly, karty, vrstvy, překryvy popisků 0, klávesnice), `scripts/test-it5-3d.py` (brána na mobilu, přelet, odkazy do Příběhu, video svědka z `../assets`, žádné HTTP chyby), `shots4.py` (všech 12 oddílů bez přetékání, konzole bez chyb), `test-it4-film.py`, `test-players.py`. `npm ci && npm run build` z čistého klonu projde.

### Slabiny
1. **Výkon 3D mapy je změřený jen v SwiftShaderu** (počty draw calls a trojúhelníků, ne skutečné fps); na skutečném notebooku a telefonu ani v Safari/Firefoxu netestovaná. Plná kvalita na PC stále kreslí 1,1 M trojúhelníků terénu zblízka.
2. **Repo je pod 150 MB jen těsně** (147,8 MB) a historie gitu má dál ~136 MB (staré verze médií); zmenšit by šla jen přepsáním historie. Nejtěžší zůstává klip hymny (38 MB).
3. **Pořadí zastávek uvnitř jednoho sezení** (Shou Lung, návrat 2006–2007) je odvozené ze shrnutí a z geometrie, data ho neurčují; kapitoly Štíty Apokalypsy a návrat mají dál po jednom překřížení.
4. **3D mapa samostatně (mimo web)** už nemá obrázky ani média svědků, protože je bere z `../img` a `../assets`; zdrojová složka `/home/claude/mapa3d` je synchronizovaná, ale sama o sobě neúplná.
5. 2D mapa: na úzkém displeji zabírají ovládací prvky výšku (tři řádky tlačítek nad mapou) a sféry jsou jen sloupec značek bez tras do nich; `test-anchors.py` z iterace 2 neprojde, protože záložní přehrávač hymny je od iterace 3 sbalený.

## Iterace 6 – vizuální kritika a animace (23. 11. 2026)

Snímky před úpravami: `/home/claude/webshots/it6/pred/`, po úpravách: `/home/claude/webshots/it6/po/` (`scripts/shots6.py <složka>`, desktop 1440×900 a mobil 390×844, všech 12 oddílů, u dlouhých více výřezů).

### Kritika před úpravami (co bylo špatně)
1. **Úvod:** titul se dělil s postavami v malbě, kicker splýval s pozadím, šest počítadel pod okrajem obrazovky, vstupy do webu jen tři tlačítka a drobné odkazy; malba se jen pomalu přibližovala, žádné světlo, mlha ani jiskry.
2. **Hierarchie a rytmus:** všech 11 oddílů začínalo stejně (kicker, velký nadpis kapitálkami, kurzivní perex, ornament), bez čísla, bez předělu; tmavé plochy za sebou bez přechodu.
3. **Kontrast:** `--parch-faint` (45 % pergamenu) měl poměr 3,6 : 1, axe-core hlásil **446 porušení AA** (hlavně popisky střihů, data, marginálie), červená `#b3332b` na tmavém 3 : 1.
4. **Družina:** karta měla portrét, jméno a řádek s hráčem; chyběly milníky a osud, kdo vedl hru, jen malým písmem pod tabulkou. Na mobilu jedna portrétová karta zabírala celou obrazovku.
5. **Bitvy:** dlouhá bílá/tmavá šablona obraz – text – dvě tabulky; nic nepřipomínalo hlášení, žádný proklik na mapu, strany a velitelé zapadli v tabulkách.
6. **Proroctví:** verše se odhalovaly jen jako celek, žádné rozsvěcování při čtení, u naplněných veršů nebylo kam jít.
7. **Časová osa na mobilu:** SVG široké 1700 px s překrývajícími se linkami, zásah postavy jen přibližný.
8. **Drobnosti:** favicon jako zploštělý obdélník, žádný náhled pro sdílení, jeden titulek stránky, žádná 404, tisk kapitoly vypsal celý web, patička jen jeden řádek, `role="img"` na SVG s fokusovatelnými potomky.
9. **Nekonzistence:** červená text/pozadí, tři různé velikosti perexu, třída `.pl` použitá pro tabulku hráčů a (při první verzi nových veršů) znovu.

### Opraveno (15 věcí)
1. **Úvod jako film** (`sections/hero.js`, `styles/scenes.css`): nástup po písmenech titulu, léta 2003–2026 jako kreslená linka se žhavou tečkou, mlha ve dvou vrstvách, paprsek světla, paralaxa malby (myš + rolování, rAF jen když je úvod vidět), jiskry s ocáskem a prach ve světle (`lib/ash.js`, canvas, vypne se při skrytí karty i `prefers-reduced-motion`), levý stín pod titulkem. Při dalším načtení ve stejné relaci zkrácený nástup (`sessionStorage`).
2. **Pět vstupů** přímo pod titulkem: Číst příběh / Pustit dokument / Mapa / Svědectví / Hymna (skleněné dlaždice s ikonou a popiskem), počítadla se spouštějí po doběhnutí nástupu.
3. **Typografická škála a tokeny** (`base.css`: `--t-*`, `--space-sec`, `--red-t`), Cardo/Crimson na text, Cinzel jen na tituly, Fira na popisky; jednotná hlavička oddílu.
4. **Číslování oddílů I–XI** s předělem „—— ✦ Oddíl IV ✦ ——“ (`lib/chrome.js`, přidává se po líném vykreslení), záře za nadpisem, zlatá linka na začátku oddílu.
5. **Scroll-driven animace** (`animation-timeline: view()`, `system.css`): nadpisy oddílů, linky předělu, paralaxa obrazu bitev; kde to prohlížeč neumí, zůstává odhalení přes IntersectionObserver; nové varianty `.rv-l/.rv-r/.rv-s`.
6. **Družina:** karta = portrét, jméno, povolání, „Hraje <hráč křestním jménem> · roky“, dva klíčové milníky (první a poslední zapsaný), osud (první věta), „Celý životopis“; detail v dialogu beze změny a bez svědectví. Na mobilu vodorovná kompaktní karta. Panel **Pán jeskyně Zdeněk T.** s odkazem na Poděkování („Všichni vděční hráči“).
7. **Bitvy jako depeše:** obraz s odhalením zleva, přes něj číslo hlášení a název, papírový list „Depeše z bojiště“ (místo, ve hře, u stolu, v kronice), naše strana × druhá strana s „VS“, velitelé a síly, průběh, výsledek s razítkem, tlačítko „Na mapě ▸“ (otevře kartu místa na 2D mapě), svědci obou stran, soupisky jednotek sbalené. Animovaný nástup po částech.
8. **Proroctví:** verše se odhalují po řádcích (rozostření → ostrost), verš, který čtenář čte, se rozsvítí, ukazatel kapitol I–III nad malbou. **Naplněné verše** (3-6, 3-7, 3-12; kronika je ve finále 1. 8. 2026 výslovně označuje za naplněné) mají odkaz „Naplnilo se · Thultanthar a Pyramida času“, ostatní verše odkazují na kapitoly, kde je vyprávění cituje (výpočet z odkazů `(p:…)` v `vypraveni.json`).
9. **Časová osa na mobilu:** karty po letech 2003–2026 (kniha, herní rok, události, kdo hrál, sezení) s vodorovným posunem, `scroll-snap`, lištou let a dotykovými cíli ≥ 44 px; klepnutí na postavu otevře její detail. Desktop zůstává u SVG.
10. **Přístupnost:** kontrast AA (**axe-core: 856 → 0** uzlů na desktopu i mobilu, `scripts/test-it6-a11y.py`), `role="group"` místo `img` u SVG osy, viditelný fokus (na papírových panelech červený), `role="status"` u načítání, `aria-label` u karet, tlačítek svědků a tisku, dotykové cíle ≥ 44 px (`shots4.py` bez malých cílů kromě opravených).
11. **Titulky stránek** podle oddílu a podle čtené kapitoly („Anauroch · Příběh · Západní draci“).
12. **Sdílení:** `og:*` a `twitter:*` meta, popis, `og.jpg` 1200×630 (`scripts/build-icons.py`: malba + titul, lokálně přes Playwright), čtvercový `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`; absolutní URL obrázku se doplní při buildu z `VERCEL_PROJECT_PRODUCTION_URL` (nebo `SITE_URL`).
13. **404:** `public/404.html` (Vercel ji použije sám), ve stylu kroniky, tři cesty zpět.
14. **Tisk kapitoly:** tlačítko „Vytisknout kapitolu“ u každé kapitoly; `@media print` ukáže jen zvolenou kapitolu na bílém papíře s hlavičkou a patičkou, bez galerie, map a ovládání; titulek dokumentu se na čas změní na název kapitoly.
15. **Reduced motion a patička:** při `prefers-reduced-motion` je obsah úvodu, depeší a veršů hned viditelný (opraveno: zpožděné animace s `both`), částice a paralaxa vypnuté; patička s ornamentem a odkazy na všechny oddíly.
Opravy za běhu: třída `.pl` (tabulka hráčů) kolidovala s novými řádky veršů, přejmenováno na `.vl`; boční posuny depeše natahovaly stránku na mobilu (405 px), řešeno `overflow-x: clip`.

### Ověření
`npm run build` projde. Testy po buildu a `npx vite preview --port 4173`: nový `scripts/test-it6.py` (96 kontrol: úvod, systém, Družina, Bitvy včetně prokliku na mapu, Proroctví včetně odkazů na kapitolu, osa na mobilu, metadata, 404, tisk, reduced motion, fokus, konzole), `test-it6-a11y.py` (axe, 0 porušení), a beze změny prošly `test-it4-audio`, `test-it4-witness`, `test-it4-film`, `test-it5-map`, `test-it5-3d`, `test-players`; `shots4.py` bez přetékání. Konzole bez chyb.

### Kritika po úpravách – 5 největších slabin
1. **Nástup úvodu a scroll-driven animace nejsou ověřené v Safari/Firefoxu ani na skutečném telefonu**; Safari < 26 a Firefox použijí zálohu bez plynulého svázání s rolováním. Jiskry a mlha nebyly změřené na slabém mobilu.
2. **Úvod stojí na jediné malbě**; paralaxa je jen posun vrstev stejného obrazu a CSS mlhy. Skutečná hloubka (rozřezané vrstvy popředí / pozadí) potřebuje novou malbu od zadavatele.
3. **Příběh (36 kapitol) zůstal vizuálně nejméně dotčený**: kapitoly jsou stále dlouhý sloupec textu s galerií; chybí vizuální přechod mezi kapitolami uvnitř knihy a větší využití malby ve sloupci.
4. **Depeše nemají kvantitativní „síly“ jako graf**: data mají počty jen u několika bitev a ve volném textu (`—` u většiny), takže strany stojí proti sobě bez měřítka; „Na mapě“ chybí u 6 bitev, které v datech mapy nemají místo.
5. **404 a tisk jsou jen systémové písmo / bez náhledu**: 404 nenačítá Cinzel (hash souborů v `dist`), tisk neobsahuje obrázky a „Kronika sezení“; tisk celé knihy nebo více kapitol najednou není.

## Iterace 7 – příběh jako zážitek, menu, Lexikon, hledání, anglický dabing (23. 11. 2026)

Snímky: `/home/claude/webshots/it7/` (desktop 1440×900 a mobil 390×844: menu, hledání, Lexikon, předěl knihy, hlas svědka, hover karta, Co se změnilo, titulky svědectví).

### Hotovo
- **Upřesnění autora** (`scripts/upresneni.py`, volá ho `build-data.py`, 3D mapa `python3 scripts/upresneni.py`; přednost před zdrojovými daty; vět, které už zdroj obsahuje, se nedotkne):
  souboje Ho × Yamoh a Elminster × Sar Saratar se dohrály v **bitvě o Anauroch** souběžně s finále, Rauko mezitím porazil Rivalena na vrcholu Pyramidy času (vyprávění, sezení, bitvy včetně soupisek, postavy, 3D mapa, proroctví: naplněné verše 3-6, 3-7, 3-12 odkazují na bitvu v Anaurochu, testy upravené); Yamoh **zmizel**, Sar Saratar padl (`data/svedkove-stav.json`).
  Podle `LORE_2026-11-23.md`: **Broskvová zahrada** (nové heslo Lexikonu), Kung Lao padl ve Feng Asay a je v Broskvové zahradě, kde s ním Ho mluvil a u něj přestupoval (titulek „† Feng Asay · Broskvová zahrada“); **Chuang-Li** zrádkyně, nepřítel, padla v souboji s Hoem v Cham Fau (ve svědectví přesunuta mezi Nepřátele); lord Ryden zemřel rukou Chuang-Li, Wang Fei-Hung se astrálně přesunul do Broskvové zahrady, Arduna jediný žijící šedý mnich vedle Hoa, císař Lei Wu-Long v Broskvové zahradě; Seung Mina osvobozená z Feng Asay a Hoova žena; dcera Khelbena bez jména. Vyprávění doplněné v kapitolách Cesta Západních draků a Cham Fau.
- **Hamburger menu na všech šířkách** (`src/lib/menu.js`): vysouvací panel (na mobilu list nad spodní lištou, otevírá ho „Menu“ ve spodní liště; horní hamburger a plovoucí „Obsah“ jsou na mobilu skryté, takže navigace je jedna), všech 13 oddílů, Příběh s rozbalitelnými knihami a 36 kapitolami, 3D mapa, Dokument, pole hledání, „Pokračovat ve čtení“ / „Začít číst“, aktuální oddíl i kapitola zvýrazněné, `role=dialog`, fokus-trap, Esc a klik mimo zavře, fokus se vrátí.
- **Globální hledání** (`src/lib/search.js`, `/`, `Ctrl+K`, tlačítko v liště, pole v menu): 1 582 položek (kapitoly a jejich odstavce, sezení, osoby, místa, frakce, pojmy, bitvy, verše, svědectví) v `public/data/search.json`, které staví `scripts/build-lexikon.py` a web ho stahuje až při prvním hledání; bez diakritiky, skupiny výsledků, zvýraznění, úryvky, ↑/↓/Enter.
- **Lexikon** místo Rejstříku (`src/sections/lexikon.js`, `public/data/lexikon.json`): 833 osob (postavy, svědci a vedlejší postavy sloučené podle jmen a přezdívek), 77 míst (2D i 3D mapa, sféry, Broskvová zahrada), 40 frakcí, 46 pojmů a předmětů; portrét, stav žije/padl/zmizel s upřesněním, strana, vazba na družinu, skupina, kapitoly Příběhu, sezení, tlačítka Svědectví / Karta postavy / 2D / 3D / Bojové hlášení; abecední rejstřík (vč. Č, CH, Ř, Š, Ž), filtry druh/stav/strana/se svědectvím/s portrétem, rychlé hledání, detail jako boční panel (mobil: list). Texty hesel jen z dat. Kotva `#lx/<heslo>`, staré `#rejstrik` vede na Lexikon.
- **Hover karty** (`src/lib/hovercard.js`): `build-lexikon.py` vloží do textu kapitol odkaz `x:` u prvního výskytu jména osoby nebo místa v odstavci (579 odkazů, české tvary, bez jmen hráčů); karta s portrétem, jednou větou, stavem a odkazem do Lexikonu (u svědků i ▶). Funguje i pro ručně psané odkazy na svědky, postavy a místa, s klávesnicí (fokus) a na dotyku (první klepnutí kartu otevře).
- **Příběh vizuálně:** předěl každé knihy (velké číslo knihy, perex 2 věty, u stolu / ve hře / sezení / kapitol, kdo hrál, mini-mapa úseku knihy), přechody mezi kapitolami (pruh malby se scroll-driven pohybem a číslem kapitoly), **vsazené hlasy svědků** uprostřed kapitol (živý portrét – video ve viditelné kartě jen na desktopu bez úsporného režimu, věta z českých titulků, ▶ Přehrát), citace z textů hráčů jako výrazné bloky („Z deníků a textů hráčů“ / „Z textů Pána jeskyně“, křestní jméno), na konci každé knihy **Co se změnilo** (nově v družině, noví hráči, naposledy ve hře, padlí a zmizelí, bitvy s výsledkem, místa poprvé na mapě – vše dopočítané z dat).
- **Řídké kapitoly doplněné** jen z dat (Devrel v Zakhaře, soupiska Pádu Sundabaru, Zia, Elundel Nighteye, Malakai, přechod severské party): žádná kapitola už nemá méně než 160 slov, výjimky `SPARSE` zrušené.
- **Anglický dabing svědectví s českými titulky** (`scripts/update-svedectvi.sh` = `import-svedectvi.py` → `build-media.py` → `build-data.py`, jde spouštět opakovaně): `text` = mluvené anglické věty (bez audio tagů), `titulky` = české titulky, `jazyk: en`; hlasy z `/home/claude/voices3` (mono 96 kb/s, české nahrávky nahrazené), `timing.json` se začátky i konci vět, texty a časy i v 3D mapě. Přehrávač: titulky **CZ (výchozí) / EN / vyp** (galerie i Dokument, klávesa C přepíná CZ → EN → vyp), přepis česky s rozklikávacím anglickým originálem, karty a hledání berou české titulky. Dokument se přepočítal sám z nových délek: **20:14** (bez hymny 14:14).
- **Elminster s videem v celé délce** (`assets/video/elminster_plne.mp4`, příznak `video_plne` v datech, generuje `build-media.py` z `<id>_lipsync.mp4`): v přehrávači i v Dokumentu se video neopakuje, jeho čas řídí čas zvuku (play/pauza/posuv/±10 s/přepnutí svědka, drift nad 0,15 s se dorovná, po konci zůstane poslední snímek); náhled v kartách dál krátká smyčka. Ostatních 32 svědků beze změny.
- Opravy: `settleScroll` posouvá okamžitě (`instant`, dřív ho CSS `scroll-behavior: smooth` zpomalovalo a dorovnání selhávalo) a přestane, když stránkou pohne něco jiného; proklik na svědka dorovná polohu i po líném vykreslení oddílů mezi tím.
- Váha: první načtení 1,17 MB desktop / 0,98 MB mobil; klip hymny překódovaný crf 32 (−6 MB, bez viditelného rozdílu), pracovní strom **145,9 MB**.

### Ověření
`npm run build` projde. Nový `scripts/test-it7.py` (menu, fokus-trap, Esc/klik mimo, zvýraznění oddílu, hledání `/` a Ctrl+K, Lexikon a jeho filtry, upřesnění autora v heslech a ve vyprávění, předěly knih, přechody, hlasy svědků, hover karta, 3 náhodní svědci: nový anglický zvuk a český titulek podle času, přepínač CZ/EN/vyp, přepis, Elminsterovo plné video v synchronu v galerii i v Dokumentu |Δ| < 0,3 s, konzole), dál `test-it6`, `test-it6-a11y` (axe 0 porušení), `test-it4-audio`, `test-it4-witness` (Chuang-Li mezi padlými nepřáteli), `test-it4-film` (C přepíná CZ → EN → vyp), `test-it5-map`, `test-it5-3d` (kontrola videa svědka v 3D mapě je nestabilní – `readyState 0` občas i na stavu před iterací, při opakování projde), `test-players`.

### 5 největších slabin
1. **Jedna dlouhá stránka** (Příběh má přes 130 000 px): navigace, kotvy a dorovnávání polohy jsou křehké; iterace 8 to rozdělí na podstránky.
2. **Párování jmen v Lexikonu a hover kartách je heuristické** (kmeny českých tvarů, sloučení postav a NPC podle jmen); u několika jmen může karta ukázat jiné heslo se stejným tvarem (např. krátká jména), stav „žije“ uvádí jen tam, kde ho data říkají.
3. **Hlasy svědků jsou anglicky, ale videa (kromě Elminstera) jsou šestisekundové smyčky** bez pohybu úst; vsazené hlasy v Příběhu hrají video jen na desktopu.
4. **Netestováno v Safari/iOS, Firefoxu a na skutečném telefonu** (menu, scroll-driven animace, dorovnání videa podle zvuku).
5. **3D mapa má vlastní přehrávač svědectví** bez přepínače titulků (ukazuje české titulky) a bez synchronizace Elminsterova plného videa.

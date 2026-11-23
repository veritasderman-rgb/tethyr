# Západní draci – kronika Tethyrské královské družiny (web)

Soukromý web pro družinu, která v letech 2003–2026 hrála jednu kampaň ve Forgotten Realms (1372–1385 DR). Převypráví tištěnou kroniku ve větším detailu a jádrem jsou **svědectví**: přátelé i nepřátelé družiny vzpomínají do kamery, po vzoru filmu *Prelude to Axanar*.

Statický web (Vite + čistý JavaScript), bez serveru. Nasaditelný na GitHub Pages i Vercel, všechny cesty jsou relativní (`base: './'`).

## Spuštění

```bash
npm install            # jednou
npm run data           # vyrobí public/data/*.json a obrázky WebP (public/img) ze zdrojů kroniky
npm run dev            # vývojový server, http://localhost:5173
npm run build          # produkční build do dist/
npx vite preview       # náhled buildu, http://localhost:4173
```

`npm run data` čte zdroje z `/home/claude/work`, `/home/claude/build`, `/home/claude/port` a `/home/claude/osa` (cesty jdou změnit proměnnými `SRC_WORK`, `SRC_BUILD`, `SRC_PORT`, `SRC_OSA`). Zdroje se jen čtou. Vygenerovaná data i obrázky jsou v repu, takže web jde sestavit i bez zdrojů. Obrázky se převádějí jen tehdy, když chybí nebo je zdroj novější (`--force` převede všechno, `--no-img` jen data).

Snímky obrazovky pro kontrolu: spusťte `npx vite preview --port 4173` a pak `npm run shots` (Python Playwright, snímky do `/home/claude/webshots/`, chyby konzole do `console.txt`).

## Svědectví, hlasy a videa (jen vedlejší postavy, nikdy hráčské)

Pořadí práce, kdykoli se sada svědectví nebo média změní (vše jde spouštět opakovaně):

```bash
python3 scripts/import-svedectvi.py   # /home/claude/voices/svedectvi_v2.json → data/svedectvi.json (text přesně, bez změn)
python3 scripts/build-media.py        # hlasy + timing.json (/home/claude/voices2), videa (/home/claude/vid, smyčka crf 27), hymna → assets/
python3 scripts/build-data.py         # data webu a obrázky; portrét svědka = <id>_portret.png nebo poster z /home/claude/vid
python3 scripts/build-hymna.py        # text a časy hymny → data/hymna.json
npm run build
```

Zdroje: `SRC_SVEDECTVI`, `SRC_VOICES`, `SRC_VID`, `SRC_HYMNA` (proměnné prostředí). Do repa se commitují `assets/voices/<id>.mp3`, `assets/voices/timing.json`, `assets/video/<id>.mp4`, `assets/hymna/*` i `public/img/wit/*`, takže Vercel (`npm ci && npm run build`) žádné zdroje nepotřebuje.

- **Titulky** se synchronizují podle `assets/voices/timing.json` (`{"<id>": {"duration": s, "starts": [s…]}}`, počet časů = počet vět). Nesedí-li počet vět, použije se časování podle délky textu (proto po změně textu vždy znovu namluvit a spustit `build-media.py`).
- **Video** (1280×720, 6 s, bez zvuku) se při převodu upraví na smyčku (konec se prolne do začátku) a hraje ztlumené pod hlasem. Bez videa se použije portrét s pomalým nájezdem, dýcháním, světlem, zrnem a vinětací.
- **Padlí a zmizelí svědkové** (`stav` ≠ `žije`, `stav_titulek`) mají tlumenější barvy a titulek „hlas z minulosti“.
- Svědek bez portrétu dostane ztemnělý výřez mapy kolem domovského místa (`HOME_MAP` v `build-data.py`), dokud nedodáme obraz.
- **Režim dokument** (`data/dokument.json`): knihy I–V, střídání spojenců, nepřátel a hlasů z nadhledu, mezi nimi střihy na mapu s trasou a malby bitev; Elminster je závěr.
- Pole v `data/svedectvi.json`: `id`, `jmeno`, `role`, `strana`, `skupina` (`spojenci`/`nepřátelé`/`neutrální`/`nadhled`), `vazba`, `portret`, `fokus`, `hlas_popis`, `text` (pole vět), `zdroje` (`s-…` sezení, `b-…` bitva, `txt:…` text hráče, `hymna`), případně `stav`, `stav_titulek`.

## Hymna a poděkování

Hymna „Rauko“: hlavním přehrávačem je videoklip `public/hymna/rauko_klip.mp4` (1280×720, H.264 crf 31, faststart, ~39 MB) s plakátem `rauko_klip.jpg`; pod ním se zvýrazňuje text podle videa. Záložní hudební přehrávač: `assets/hymna/rauko.mp3`, text a časy řádků v `data/hymna.json` (z `/home/claude/hymna/rauko.txt`; časy z `timing.json` ve zdrojové složce (`sekce[].radky[].start`, případně pole 47 čísel), jinak z `data/hymna-timing.json` (odhad z automatického přepisu)). Přehrávač má play/pauzu, posuv, hlasitost, zvýraznění řádku a sloky, klik na řádek skočí na řádek; vizuál reaguje na hlasitost (WebAudio analyser). Když ve složce hymny existuje `rauko_klip.mp4`, po `build-media.py` se nabídne „Videoklip“. Poděkování je `data/podekovani.txt` beze změn.

## 3D mapa a kotvy

`public/mapa3d/` je samostatná složka (viz její README). V oddílu Mapa je vstup s odkazem na celou obrazovku a s iframem, který se načte až po kliknutí. Kotvy, které mapa očekává: `#s-…` (sezení), `#b-…` (bitvy), `#svedectvi/<id>` (otevře svědectví), `#mapa`, `#pribeh`; zpracovává je router v `src/main.js` (otevře rozbalené podrobnosti a dorovná polohu, než se dočtou lazy obrázky). Polohy míst v `build-data.py` (`MAP_FIX`) jsou opravené stejně jako v 3D mapě.

## Příběh (vyprávění)

Text kapitol je v `data/vypraveni/1.md`–`4.md`: `## <id kapitoly>`, odstavce oddělené prázdným řádkem, `{s-…}` na konci odstavce = marginálie (datum u stolu a ve hře), citace `> text` + `> — Jméno, zdroj`. Odkazy v textu: `[text](w:svědek)`, `(m:místo z 3D mapy)`, `(b:bitva)`, `(p:kapitola-verš)`, `(c:postava)`, `(s:sezení)`. `build-data.py` texty zkontroluje (platnost odkazů, 4–8 odstavců, zakázaná slova, otazníky, autor citace) a zapíše `public/data/vypraveni.json`. Úsek trasy pro mapku kapitoly je v `CH_ROUTE` v `build-data.py`. Data webu se načítají po oddílech (`src/lib/data.js` `need`, `src/lib/sections.js` `ensure`/`emit`). Kontrola v prohlížeči: `python3 scripts/shots3.py` (snímky a testy odkazů do `/home/claude/webshots/it3/`).

## Struktura

```
index.html               kostra stránky, 12 oddílů
vite.config.js           base './', plugin pro audio/video svědectví
scripts/build-data.py    zdroje → public/data/*.json + WebP obrázky
scripts/shots.py         Playwright snímky desktop/mobil
data/svedectvi.json      promluvy svědků (ručně psané, fakta z dat)
data/vypraveni/*.md      převyprávění 36 kapitol (ručně psané, fakta z dat, citace z textů hráčů; formát a kontrola v scripts/vypraveni.py)
assets/voices, assets/video, assets/hymna   hlasy, videa a hymna (generuje scripts/build-media.py)
public/mapa3d/           samostatná 3D mapa Faerûnu
public/data/             generovaná data webu
public/img/              generované obrázky (ilu = malby, port = portréty, nove = podklady PJ, foto = fotky od stolu, map, osa)
src/main.js              načtení dat, navigace, spuštění oddílů
src/lib/                 data, obrázky (srcset), odhalování, částice, lightbox/šuplík
src/sections/            hero, story, map, witness, party, battles, prophecy, timeline, registry, table, hymna, podekovani
src/styles/              base.css (barvy, písmo, prvky), sections.css (oddíly)
```

Oddíly: Úvod · Příběh · Mapa (Leaflet + vstup do 3D mapy) · Svědectví · Družina · Bitvy · Proroctví · Časová osa · Rejstřík · U stolu · Hymna · Poděkování.

## Obsahová pravidla

Hráči jen křestním jménem (Pepa, Zdeněk K., Zdeněk T., Lukáš, Tomáš, Venca, Vojta, Terka, Jana). Pán jeskyně je Zdeněk T. Hráčské postavy nemají žádné svědectví, hlas ani video. `build-data.py` jména ve zdrojích nahrazuje a hlásí zakázaný obsah. Ho je vždy hladce oholený. Fakta (kdo, kde, kdy, jak to dopadlo) se berou jen z dat kroniky.

Písma jsou lokálně z `@fontsource` (Crimson Text, Cardo, Cinzel, Fira Sans), knihovny (Leaflet) se bundlují, žádné CDN.

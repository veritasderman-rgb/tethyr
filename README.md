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

## Jak přidat audio nebo video ke svědectví

1. Najděte `id` svědka v `data/svedectvi.json` (např. `rauko`, `yamoh-hokhra`).
2. Audio uložte jako `assets/voices/<id>.mp3` (funguje i `.m4a`, `.ogg`, `.wav`).
3. Video uložte jako `assets/video/<id>.mp4` (nebo `.webm`). Přehraje se místo statického portrétu.
4. Volitelně přesné časy titulků: `assets/voices/<id>.json` s polem časů začátku vět v sekundách, např. `[0.4, 3.1, 6.8, …]` (stejný počet jako vět v `text`). Totéž jde zapsat přímo do `data/svedectvi.json` jako pole `casy`.
5. Restartujte `npm run dev`, případně znovu `npm run build`. Plugin ve `vite.config.js` soubory najde, předá webu jejich seznam a při buildu je zkopíruje do `dist/assets/`.

Bez souborů web funguje dál: titulky běží podle délky textu a portrét se pohybuje (pomalý nájezd, dýchání, světlo, zrno). Když existuje audio, titulky se rozloží podle jeho délky (nebo podle `casy`). Když existuje jen video, řídí se jeho zvukem; když existuje video i audio, video běží ztlumené ve smyčce a zvuk jde z audia.

Pole v `data/svedectvi.json`: `id`, `jmeno`, `role`, `strana` (`spojenec` / `nepřítel`), `skupina` (`družina` / `spojenci` / `nepřátelé`), `hrac` (u hráčských postav), `portret` (klíč obrázku, např. `port/ho`, `ilu/P_023`, `nove/n79`), `fokus` (bod zájmu obrazu pro ořez a nájezd), `hlas_popis` (pro výběr hlasu), `text` (pole vět), `zdroje` (id sezení `s-…` nebo bitev `b-…`, o které se promluva opírá). `npm run data` kontroluje délku (90–160 slov) a existenci zdrojů.

## Struktura

```
index.html               kostra stránky, 10 oddílů
vite.config.js           base './', plugin pro audio/video svědectví
scripts/build-data.py    zdroje → public/data/*.json + WebP obrázky
scripts/shots.py         Playwright snímky desktop/mobil
data/svedectvi.json      promluvy svědků (ručně psané, fakta z dat)
data/vypraveni.json      vyprávění ke kapitolám příběhu (ručně psané, fakta z dat)
assets/voices, assets/video   sem patří audio a video ke svědectvím
public/data/             generovaná data webu
public/img/              generované obrázky (ilu = malby, port = portréty, nove = podklady PJ, foto = fotky od stolu, map, osa)
src/main.js              načtení dat, navigace, spuštění oddílů
src/lib/                 data, obrázky (srcset), odhalování, částice, lightbox/šuplík
src/sections/            hero, story, map, witness, party, battles, prophecy, timeline, registry, table
src/styles/              base.css (barvy, písmo, prvky), sections.css (oddíly)
```

Oddíly: Úvod · Příběh (5 knih, kapitoly, sezení, střihy na svědectví a mapu) · Mapa (Leaflet, trasa po knihách) · Svědectví · Družina · Bitvy · Proroctví · Časová osa · Rejstřík · U stolu.

## Obsahová pravidla

Hráči jen křestním jménem (Pepa, Zdeněk K., Zdeněk T., Lukáš, Tomáš, Venca, Vojta, Terka, Jana). `build-data.py` jména ve zdrojích nahrazuje a hlásí zakázaný obsah. Ho je vždy hladce oholený. Fakta (kdo, kde, kdy, jak to dopadlo) se berou jen z dat kroniky.

Písma jsou lokálně z `@fontsource` (Crimson Text, Cardo, Cinzel, Fira Sans), knihovny (Leaflet) se bundlují, žádné CDN.

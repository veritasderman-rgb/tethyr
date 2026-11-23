# Faerûn a Kara-Tur – 3D mapa Západních draků

Samostatná statická složka s interaktivní 3D mapou Faerûnu a Kara-Turu pro web kroniky Tethyrské královské družiny. Nepotřebuje build ani CDN, všechny cesty jsou relativní. Funguje z libovolné podsložky webu (počítá se s `/mapa3d/`).

## Spuštění a vložení do webu

```bash
cd mapa3d && python3 -m http.server 8765      # http://localhost:8765/
```

Přes `file://` mapa nepoběží (načítá data přes `fetch`). Do webu se vloží zkopírováním celé složky do `public/mapa3d/` (Vite ji pak zkopíruje do `dist/mapa3d/` beze změny). Pak:

```html
<a href="mapa3d/index.html" target="_blank">3D mapa přes celou obrazovku</a>
<iframe src="mapa3d/index.html" title="3D mapa Faerûnu" loading="lazy" allow="fullscreen; autoplay"
        style="width:100%;height:80vh;border:0"></iframe>
```

- V iframu se tlačítko „Kronika“ změní na „Samostatně“ (otevře mapu v novém okně). Odkazy do kroniky mají `target="_top"`, takže z iframu přepnou celou stránku.
- Kvalita: `?q=high` / `?q=low` (jinak automaticky: PC plná, dotyková zařízení a malé obrazovky lehká; volba se pamatuje v `localStorage`).
- Načtení na požádání: na dotykovém zařízení, malé obrazovce, při `saveData` nebo pomalém připojení se nejdřív ukáže tlačítko „Načíst 3D mapu“ (do té doby se nestáhne ani three.js, ani terén). `?embed=1` (iframe z kroniky, uživatel už klepl) a `?load=1` bránu přeskočí.
- Média: mapa nemá vlastní kopie obrázků, videí ani hlasů. Bere je z webu kroniky: `../img/…` (malby, portréty), `../assets/video/<id>.mp4` a `../assets/voices/<id>.mp3` (svědci). Samostatně (mimo web) proto poběží bez obrázků a médií svědků.

### Odkazy z mapy do kroniky (očekávané kotvy v `../index.html`)

| kotva | kde v kronice |
|---|---|
| `#s-…` (např. `#s-2011-06-21`, `#s-2026-09-05-epilog`) | sezení (`<li class="ses" id="s-…">` v Příběhu) |
| `#b-…` (např. `#b-bitva-v-anaurochu`) | bojové hlášení v oddílu Bitvy |
| `#svedectvi/<id>` (např. `#svedectvi/finian`) | otevře svědectví (událost `witness:open`) |
| `#mapa`, `#pribeh` | oddíly webu |

### Odkazy do mapy (hash)

`#p=castle-tethyr` (místo), `#b=b-bitva-v-anaurochu` (bitva), `#w=finian` (svědek), `#s=s-2011-06-21` (zastávka/místo s tímto sezením), `#krok=97` (zastávka výpravy, od 1), `#ch=ch-shou-lung-a-velke-tazeni` (první zastávka kapitoly), `#prelet` (spustí přelet tažením), `#era=V` (filtr knihy). Holé `#s-…` a `#b-…` fungují také, takže web může použít stejné kotvy jako u sebe.

## Co mapa umí

- **Terén** od Moře mečů po Kara-Tur odvozený z podkladu `toril-east-west.jpg`: moře a jezera (modré plochy), pobřeží, hory a kopce (hustota tmavé kresby), lesy, pouště, ledovce. Podklad je textura, výšky jsou přehnané. Voda má vlastní shader (mělčiny prosvítají, vlny, pěna u břehu, odlesk slunce), zblízka přibývá kresba stromů a instance stromů v lesích, na nejvyšších štítech sníh, mraky z dálky.
- **Nálada podle knihy** (svítání, mráz, den, bouře, stín, soumrak; ručně i noc) – při přehrávání se mění podle knihy zastávky.
- **66 míst kampaně** se značkou, popiskem a 3D modelem (líně se nahrávají při přiblížení), u měst domy, u šouských míst pagody, u přístavů lodě, podmořská místa jako zářící kopule. **Thultanthar** je samostatný objekt – létající Město stínů nad Anaurochem se stínovou aurou a stínem na poušti.
- **Karta místa**: popis, co se tu stalo (kniha, u stolu, DR), zastávky výpravy, bitvy, svědectví, sezení s odkazy do kroniky, kdo tu žije (NPC z rejstříku), malby kroniky s lightboxem.
- **10 sfér** jako plovoucí ostrovy s portály nad Bezstopým mořem (Sigil s Klecí, Pyramida času, Feng Asay, Avernus…); cesty do sfér vedou obloukem a portálovým paprskem, obrazovka se při nich zbarví do fialova.
- **Výprava družiny** (105 zastávek = trasa z `map.json` + vložené cesty do sfér): přehrávání s kamerou letící za praporem družiny, krokování, posuvník (popisky let u stolu 2003–2026 / DR 1372–1385, přepíná se), barvy knih, filtr knih, **deník výpravy** na pergamenu (sezení, kdo byl u toho, kteří hráči, malby).
- **14 bitev**: zkřížené meče, zblízka šiky a prapory stran (animované), karta se stranami, veliteli, soupiskou, výsledkem a malbou. Bitva v Anaurochu a útok na Thultanthar jsou zvýrazněné.
- **33 svědectví** u domovských míst: živý portrét (smyčka), hlas, titulky po větách podle časování.
- **Drobnosti z kroniky**: draci Aliance nad Anaurochem (11 draků), létací džunka Shou Lungu, elfské létací lodě Zlatý sokol a Endarleaf, královnina létající loď nad Castle Tethyr, lodě na Moři padlých hvězd a piráti z Nelantheru, Austiův odchod na Evermeet (loď mizí na západě), kraken z Jezera páry, runodraci nad Shoonachem, modrá dračice Iryklathagra, kovová loď u Dračího letu, loď v Reghedském ledovci. Každá má kartu s textem z kroniky a odkazem.
- Měření vzdálenosti (místa ze seznamu, klepnutím na popisky nebo dva body v mapě; míle, km, dny pěšky / na koni / lodí / létající lodí), sonda výšky a krajiny po klepnutí, hledání (místa, bitvy, svědci, sezení, drobnosti; bez diakritiky), legenda, myš/dotyk/klávesnice, zvuk, celá obrazovka, načítací obrazovka, `prefers-reduced-motion` (bez průletů a animace trasy), adaptivní rozlišení podle FPS.

## Přelet tažením a výkon (iterace 5)

- **Přelet tažením** (tlačítko ✈, klávesa `T`, odkaz `#prelet`): autopilot po zastávkách, kamera letí za praporem družiny, při vstupu do kapitoly velký titulek (kniha, léta u stolu a DR, název kapitoly, místo), filmové pruhy, skryté ovládání; `Esc` nebo ✕ přelet ukončí. Rychlost 0,5–4× (tlačítko vedle měřítka). Zastávky mají kapitolu Příběhu (`campaign.json` `route[].ch`, `chapters`), deník i karta místa odkazují na kapitolu v kronice (`../index.html#ch-…`).
- **Pořadí trasy** se bere z webu (`public/data/map.json`, přeskládané podle chronologie sezení), sféry se vkládají podle let.
- **Výkon:** statické skupiny tvarů (pagody, pyramidy, meče, džunky, věže Thultantharu) se „pečou“ do jedné geometrie s barvami ve vrcholech, vojska u bitev jsou `InstancedMesh` (jedna geometrie na stranu, pohyb přes matice instancí), terén má dvě úrovně detailu (z dálky každý druhý vrchol, všechny dlaždice najednou, takže bez švů), meče bitev zmizí z velké dálky, modely se dál nahrávají líně podle přiblížení, stromy jsou instance s počtem podle vzdálenosti. Města a přístavy dostaly další modely z Desetiměstí (domy, krčma, kovárna, studna, stánky, sýpka, strážnice, jeřáb, sušák ryb, loďky, trpasličí domy u Ironfang Deep a dolů pod Rudou pevností, mlýn u Mechového kamene); severské zvíře a ledové modely, které do této kampaně nepatří, jsou pryč.
- Měření: `python3 tools/perf.py` (headless Chromium + SwiftShader). Iterace 5: celkový pohled na PC 533 → 205 draw calls a 1,24 M → 0,38 M trojúhelníků, Anauroch zblízka na telefonu až 1171 → 73 draw calls; načtení na PC (bez GPU) ~4 MB.

## Struktura

```
index.html                 kostra a UI
css/map.css                vzhled (barvy a písma webu, písma lokálně v assets/fonts)
js/main.js                 celý engine (ES modul)
js/vendor/three/           three.js 0.170 + OrbitControls, GLTFLoader, meshopt, BufferGeometryUtils (MIT)
data/campaign.json         data kampaně pro mapu (generuje tools/build_data.py)
assets/terrain/            map.jpg (textura), height.bin (Uint16 1288×442), mask.png (les/poušť/hory/led), sea.png, meta.json
assets/models/*.glb        3D modely (z Desetiměstí), index.json
assets/sounds/*.mp3        zvukové smyčky (z Desetiměstí)
assets/fonts/              Cardo, Crimson Text, Fira Sans, Cinzel (woff2, latin + latin-ext)
tools/build_terrain.py     podklad → výšky a masky
tools/build_data.py        data kroniky → campaign.json (média se nekopírují, odkazuje na ../img a ../assets)
tools/perf.py              měření načtení, draw calls a trojúhelníků
tools/extract_assets.py    modely a zvuky z repozitáře desetimesti
tools/shots.py             Playwright snímky (SwiftShader) do /home/claude/webshots/mapa3d/
tools/gallery.html         náhled všech modelů (vývojová pomůcka)
```

Velikost složky ~14 MB (modely 6,8 MB, zvuky 3 MB, terén 1,9 MB). Modely a zvuky se stahují až když jsou potřeba.

Přegenerování: `python3 tools/build_terrain.py && python3 tools/build_data.py` (zdroje se jen čtou; cesty jdou změnit proměnnými `SRC_WORK`, `SRC_WEB`, `SRC_VOICES`, `SRC_VOICES2`, `SRC_VID`). Kontrola: spustit server a `python3 tools/shots.py`.

## Co je převzato z desetimesti

Z repozitáře `desetimesti` (desetimesti.vercel.app): struktura engine (šum, terén v dlaždicích s ořezem mimo záběr, nebe se shaderem a hvězdami, kamera s průlety, ovládání myší/dotykem/klávesnicí WASD-QE-RF, DOM popisky podle vzdálenosti, měření, sonda po klepnutí, škálování rozlišení podle FPS, adaptivní kvalita PC/telefon, režim filmu → teď přehrávání výpravy, deník družiny s pergamenovou kartou a listováním), jednoduché tvary (`humanoid`, `flyer`, `ship`), loader GLB s nahrazením zástupného tvaru, modely (v `models_*.js` jako base64, tady rozbalené do `.glb`; 51 z 63, bez zimní fauny a ledových modelů) a zvukové smyčky ze `sounds.js`. Nahrazeno: zimní sever (sníh, led, počasí d20, kalendář), deník jiné družiny, písně a videa k zimním bestiím (nejsou v datech této kampaně – nepoužité), CDN (three.js i písma jsou lokálně).

## Opravy poloh (georeference)

`tools/build_data.py` posouvá místa, která v `map.json` padla do moře, na nejbližší pevninu; tethyrský shluk je v datech posunutý asi o 100 px na západ. Ručně: **Castle Tethyr 265,570 → 365,568** (tečka „Castle Tethyr“ na podkladu), Ithmong 345,573 → 445,575 a Tyrův chrám 335,588 → 382,586 (oba přibližně). Automaticky: Port, Dračí let, Reghedský ledovec, Mechový kámen, Mořské věže (o pár pixelů). Totéž by stálo za opravu i v `map.json` pro 2D mapu webu. Místa u okraje (Maztica, Evermeet, Anchorome, Zakhara, Malatra) jsou značky směru, ne skutečná poloha.

## Známé slabiny

- Výšky jsou odhad z barev a kresby podkladu: některé okraje lesů a pobřežní pásy se zvedají jako kopce, ostrovy kreslené hnědě (Kozakura) jsou nižší, než by měly. Na prudkých svazích se textura protahuje.
- Podklad má 1 px na jednotku – zblízka je rozmazaný (anglické popisky mapy se rozpijí). Kamera proto u míst nezajíždí úplně dolů.
- Poloha některých míst (Ithmong, Tyrův chrám, Klášter Subotami, Dračí let…) je i po opravě přibližná. Měřítko 2,6 míle na dílek je odhad (±20 %).
- Vazby zastávek na sezení jsou podle data a jména místa; kde zápis chybí, deník ukáže „sezení z téže doby v kraji“ (s tímto označením) nebo nic. Svědci stojí u domovských míst podle ručního přiřazení (Simbul v Aglarondu, Alusair v Cormyru mimo místa kampaně).
- Šiky bitev jsou složené z jednoduchých postaviček (u Bitvy v Anaurochu ~1200 draw calls zblízka); na slabém telefonu může zblízka cukat. Barvy stran jsou podle pořadí stran v datech, ne heraldika.
- Barvy draků Aliance nejsou v datech, jsou jen různé kovové odstíny. Loď u Austiova odchodu je ilustrace (data říkají jen „odešel na Evermeet“).
- Modely z Desetiměstí jsou místy zasněžené (domy, věže) – na jihu působí zimně.
- Měřicí čára je tenká (WebGL linka 1 px), z velké dálky je vidět hlavně text a sloupky.
- Ověřeno jen v Chromiu se SwiftShaderem (Playwright, 1440×900 a 390×844); Safari/iOS a Firefox netestovány. Přehrávání hlasu potřebuje klepnutí (autoplay politika).

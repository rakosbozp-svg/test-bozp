# Vzhled DZP podle vzorů – hlavička, síť s popisky, výplně podle významu, šipka příjezdu

Datum: 13. 11. 2026 · Stav: návrh schválen uživatelem (náhled 13. 11. 2026, „jinak schvaluji“)

## Cíl

Listy DZP z programu (situace, půdorys, schéma) mají vypadat jako dva vzory, které poslal uživatel:

- červený nadpis „GRAFICKÁ ČÁST OPERATIVNÍ KARTY – SITUACE –“;
- tečkovaná síť 10 m s písmeny a čísly;
- pastelové plochy: zeleň, komunikace, šedá zástavba, tmavší řešený objekt se silným obrysem;
- velké černé šipky „směr příjezdu“;
- legenda „Legenda pro dokumentaci zdolávání požárů“.

Okénka vzoru HZS Středočeského kraje zůstávají beze změny: razítko listu (MĚŘÍTKO, NÁZEV, žluté pole s druhem listu, SCHVÁLIL, ZPRACOVAL + datum) i operativní karta. Uživatel rozhodl: „ano, udělej to takhle podle vzoru SČK“.

Evakuační plány se nemění.

## Rozsah

1. Rozvržení listu: pás pro nadpis a popisky sítě nad rámem.
2. Nadpis listu.
3. Síť 10 m: tečkovaná, s popisky sloupců a řádků.
4. Výplně podle významu (předvolby ploch) v editoru i pro Clauda.
5. Nový prvek „směr příjezdu“ (druh `prijezd`) v editoru i pro Clauda.
6. Tučný text.
7. Nadpis legendy.
8. Základní pokyny pro Clauda v aplikaci, jak tyto prvky používat.

Mimo rozsah:

- výkresy DS Kladno (samostatný úkol, kreslí se už v novém vzhledu);
- uživatelský návod;
- změny razítka, karty a severky;
- lomené šipky (jen přímá šipka);
- automatický posun okna starších projektů.

## Návrh

### 1. Rozvržení listu (`js/kresleni/prvky.js`, `rozlozeniListu`)

- Pro listy DZP (ne evakuační plán) se nad rámem vyhradí pás `HLAVICKA_MM = 5`:
  - `ram.y = M + 5`;
  - `ram.h` je o 5 mm menší;
  - šířka rámu, razítko, rozměr papíru a orientace se nemění.
- Starší projekty: obsah se na papíře posune o 5 mm dolů a spodních 5 mm rámu se ořízne. Kdo má výkres až u spodního okraje, použije jednou „Přizpůsobit“. Okno (`v.okno`) se nemigruje.

### 2. Nadpis (`js/kresleni/render.js`)

- Text: `GRAFICKÁ ČÁST {OPERATIVNÍ KARTY | OPERATIVNÍHO PLÁNU} – {NÁZEV LISTU VELKÝMI} –`.
  - Druh dokumentace se bere z nové volby `o.typDokumentu`: `operativni_plan` dává „OPERATIVNÍHO PLÁNU“, cokoli jiného „OPERATIVNÍ KARTY“.
  - Název listu je `o.nazevListu` (velkými písmeny, česky). Když je prázdný, použije se druh listu (SITUACE / PŮDORYS / SCHÉMA).
- Vzhled:
  - červená `#d00000`, tučně, 4,4 mm;
  - vodorovně na střed listu, účaří 6,2 mm nad horní hranou rámu;
  - delší nadpis se zmenší tak, aby se vešel do šířky rámu (`sirkaTextu`), nejvýš na 3 mm.
- Volbu `typDokumentu: projekt.typ` předávají oba volající `renderListu`: editor (`mkO`) a export PDF.

### 3. Síť 10 m s popisky

- Čáry sítě jsou tečkované:
  - barva `#333`, krytí 0,8, šířka 0,2 mm;
  - `stroke-dasharray` 0,25 / 1,05 mm (na papíře);
  - síť zůstává ukotvená na násobky 10 m světových souřadnic jako dnes.
- Popisky jsou mimo rám (neruší kresbu):
  - **Sloupce:** A, B, … Z, AA, AB … nad rámem; střed sloupce, účaří 1,3 mm nad rámem, 3 mm tučně.
  - **Řádky:** 1, 2, 3 … vlevo od rámu, zarovnané doprava 1,2 mm od rámu, 3 mm tučně.
  - **Roh:** „10 m“ v levém horním rohu vně rámu, 2,2 mm.
  - Popíše se jen sloupec nebo řádek, jehož střed leží v rámu (víc než 1 mm od okraje). První takový sloupec je A, první řádek 1.
  - Popisky se kreslí jen se zapnutou sítí (`sit10m`) a když má buňka na papíře aspoň 4 mm (tj. do 1 : 2500).
- Popisky počítá čistá funkce, takže jdou testovat bez SVG.

### 4. Výplně podle významu (`VYPLNE` v `prvky.js`)

Barvy jsou převzaté ze vzorů (převládající barvy obrázků):

| klíč | název | výplň | krytí | obrys | tloušťka obrysu (mm) |
|---|---|---|---|---|---|
| `zelen` | Zeleň | `#94f993` | 1 | `#555555` | 0,18 |
| `komunikace` | Komunikace a zpevněné plochy | `#f6f884` | 1 | `#555555` | 0,18 |
| `objekt` | Řešený objekt | `#c0c0c0` | 1 | `#000000` | 0,7 |
| `okoli` | Okolní zástavba | `#e3e3e3` | 1 | `#555555` | 0,25 |
| `voda` | Vodní plocha | `#a6d8ff` | 1 | `#1e5fd0` | 0,18 |

- Předvolba jen zapíše čtyři hodnoty do prvku (`vypln`, `kryti`, `barva`, `tloustka`). Datový model ani vykreslení se nemění a starší projekty vypadají stejně.
- Platí pro plochu, obdélník a elipsu.
- `vyznamVyplne(p)` vrátí klíč předvolby, pokud se `vypln` prvku shoduje s výplní předvolby (bez ohledu na velikost písmen), jinak `null`. Používá ho panel vlastností (zvýraznění) a `precti_vykres`.
- **Editor:** v panelu vlastností plochy, obdélníku a elipsy je řádek tlačítek „Výplň podle významu“ s barevným vzorkem a názvem. Je jen u DZP, ne v evakuačním plánu.
- **Claude:** `kresli` i `uprav` přijímají klíč `vyznam` (`zelen` | `komunikace` | `objekt` | `okoli` | `voda`, i s diakritikou a mezerami jako „zeleň“ nebo „okolní“).
  - Předvolba nastaví všechny čtyři hodnoty.
  - Výslovně zadané `vypln` / `kryti` / `barva` / `tloustka_mm` v tomtéž zadání mají přednost.
  - Neznámý význam je chyba se seznamem povolených hodnot.
  - V evakuačním plánu je `vyznam` odmítnut.
  - `precti_vykres` hlásí `vyznam` u ploch, které předvolbě odpovídají.

### 5. Směr příjezdu (nový druh `prijezd`)

- **Model:** `{ druh: 'prijezd', body: [[x1, y1], [x2, y2]], sirka: 6, text: 'směr příjezdu', barva: '#000000' }`.
  - `body[0]` je začátek, `body[1]` hrot.
  - `sirka` je šířka dříku v mm na papíře, rozsah 2–30.
  - Výchozí vrstva je `komunikace`.
- **Vykreslení:**
  - Jeden mnohoúhelník v barvě `barva`: dřík šířky `sirka`, hrot široký 2 × `sirka`, dlouhý 1,35 × `sirka`, nejvýš 45 % délky šipky.
  - Text je bílý a tučný, uprostřed dříku, 0,52 × `sirka`. Natočený podél šipky a vždy čitelný: nikdy vzhůru nohama, svislý text se čte zdola nahoru.
  - Když je text delší než dřík, zmenší se, nejvýš na 1,8 mm. Pod tuto velikost se nevykreslí.
- **Editor:**
  - Nástroj „Směr příjezdu“ funguje na dvě kliknutí (odkud → kam) a po druhém kliknutí se sám dokončí.
  - V panelu vlastností jsou pole Text a Šířka šipky (mm).
  - Koncové body jdou táhnout úchyty. Nové body se nepřidávají (šipka má vždy 2 body).
  - V evakuačním plánu se nástroj nenabízí.
- **Zásah myší a obrys:** jako úsečka s tolerancí poloviny šířky šipky.
- **Legenda:** šipka se do legendy nepíše, je popsaná přímo.
- **Claude:**
  - `kresli` přijímá druh `prijezd`: `body` (právě 2 body: odkud a kam, kde je hrot), `text` (výchozí „směr příjezdu“) a `sirka_mm`;
  - v evakuačním plánu je `prijezd` odmítnut;
  - `uprav` mění `body`, `text` a `sirka_mm`;
  - `precti_vykres` šipku vypíše.
- **Očista importu (`ocista.js`):**
  - `sirka` je číslo 2–30, jinak 6;
  - `text` je řetězec;
  - šipka s jiným počtem bodů než 2 se nevykreslí (nespadne).

### 6. Tučný text

- `text.tucne` je boolean, výchozí `false`.
- Vykreslí se jako `font-weight="700"`. Export PDF už tučný řez umí.
- V panelu vlastností textu je zaškrtávátko „Tučně“.
- Claude: klíč `tucne` v `kresli` / `uprav`; `precti_vykres` ho vypíše, když je `true`.
- Očista: jiná hodnota než boolean se změní na `false`.

### 7. Legenda

- Nadpis „Legenda pro dokumentaci zdolávání požárů“: červeně `#d00000`, tučně 2,6 mm, podtržený červenou čarou 0,25 mm.
- Obsah, rozměry řádků, umístění a zmenšování legendy se nemění.

### 8. Pokyny pro Clauda (`pokyny(k)` v `js/ai/nastroje.js`, jen DZP)

Krátký odstavec „Styl DZP“:

- řešený objekt kreslit jako plochu nebo obdélník s `vyznam: 'objekt'`, okolní stavby `okoli`, ulice a zpevněné plochy `komunikace`, zeleň `zelen`;
- názvy ulic a objektu tučně;
- příjezd hasičů šipkou `prijezd` v ulici, hrotem k objektu nebo ke vstupu;
- hlavní vchod značkou DZP-105;
- nic nedomýšlet: co není v podkladu, nekreslit a zeptat se.

## Chyby a okrajové případy

- Poškozený prvek `prijezd` z cizího souboru (méně bodů, NaN) se nevykreslí a nespadne. Platí stávající `prvekBezpecne` a očista.
- Velmi dlouhý název listu se v nadpisu zmenší. Při velmi malém měřítku (buňka sítě pod 4 mm) se popisky sítě vynechají.
- Velké měřítko: v rámu nemusí ležet žádný střed buňky (buňka je větší než rám), pak není žádný popisek. To je v pořádku.

## Testy

**Jednotkové:**
- `rozlozeniListu`: DZP s hlavičkou, evakuační plán beze změny;
- text nadpisu (karta, plán, půdorys s názvem, prázdný název);
- popisky sítě (A, B…, AA, 1, 2…, vynechání krajních polovin, nic bez sítě a při buňce pod 4 mm);
- tečkovaná síť;
- `VYPLNE` a `vyznamVyplne`;
- vykreslení `prijezd`: mnohoúhelník, natočení textu pro šipku nahoru, dolů a doleva, zmenšení textu;
- obrys a zásah šipky;
- očista (`sirka`, `tucne`);
- nástroje Clauda (`vyznam`, `prijezd`, `tucne`, odmítnutí v evakuačním plánu, `precti_vykres`);
- nadpis legendy.

**PDF:** text nadpisu listu a nového nadpisu legendy je v exportovaném PDF.

**E2E editoru:**
- nástroj Směr příjezdu (2 kliknutí → prvek);
- tlačítko „Výplň podle významu“ nastaví hodnoty;
- „Tučně“ přepne text.

Stávající testy, které hledají „LEGENDA ZNAČEK“, se upraví na nový nadpis.

## Dopady a kompatibilita

- Formát projektu zůstává (nová pole jsou volitelná). Starší verze programu nový druh `prijezd` nevykreslí (neznámý druh), ostatní projekt načte.
- Jednosouborová verze, artefakt i webová verze dostanou změnu stejným sestavením (`tools/sestav_jeden_soubor.mjs`, `tools/sestav_web.mjs`).

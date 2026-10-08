# Požární plánovač (DZP)

Webová aplikace pro tvorbu dokumentace zdolávání požárů (operativní karta / plán).
Stav: příprava. Zdrojový kód původního plánovače z ChatGPT zatím není k dispozici.

## Podklady (`podklady/`)
- `VZOR_OPERATIVNI_KARTA.docx` – vzor operativní karty HZS Středočeského kraje
- `Navod_k_vyplneni_operativni_karty_HZS_SCK.pdf` – pravidla vyplnění vzoru
- `Zasady_pro_zpracovani_DZP.rtf` – zásady zpracování DZP (HZS SCK)
- `Graficke_znacky_DZP.pdf` – katalog 109 značek (ČAHD, 11/2011, vektorové)
- `Metodicky_navod_DZP_1996.pdf` – metodika Hanuška 1996 (74 s.)
- `priklady/` – hotové DZP: Litice (situace, DZP FVE s rozhodnutím HZS Pardubického kraje 2025), Doloplazy (OK FVE 1 a 2)

## Chybí dodat
- metodika Hanuška 1996 a „Postup při tvorbě DZP"
- PNG značky E001–E019 a F001–F006
- schválená DZP FVE 2025 a plánek areálu Litice
- ukázka požadovaného výstupu

## Hotovo
- **Značky** (`znacky/`): všech 109 značek z katalogu ČAHD 11/2011 jako PNG (600 dpi, průhledné pozadí) a SVG,
  `katalog.json` (id `DZP-001`…`DZP-109`, název, zdroj, strana/řádek/sloupec). Generuje `npm run znacky`.
  **Pozor:** zdrojové značky v PDF jsou bitmapy, ne vektory. SVG je jen obálka kolem PNG a při velkém zvětšení
  je vidět pixelace. Skutečné vektory jsou možné až z dodaných PNG E001–E019/F001–F006 nebo z CAD zdroje ČAHD.
  Názvy jsou text z PDF; `overeno: false` u všech, dokud je nepotvrdíš.
- **Datový model** (`js/model.js`): projekt → listy (karta, situace, půdorys, schéma, text), pole karty dle vzoru HZS SCK
  (pravidlo „NE“), výkres s měřítkem/severkou/vrstvami/legendou, revize, migrace starších souborů, velikost prvků 1–500 (krok 0,1).
- **Kontrola úplnosti** (`js/uplnost.js`): povinná pole, hasivo u nebezpečí, výkon FVE v kWp, ověřený průtok hydrantu,
  měřítko, severka, legenda, revize, existence značek.
- **Litice** (`data/litice.projekt.json`): jen potvrzené údaje o FVE a poznámky o rozsahu a polohách.

- **Aplikace (krok 3)**: `index.html` + `js/app.js`. Spuštění: `python3 -m http.server 8000` v této složce, pak http://localhost:8000.
  Dashboard (logo vrací na přehled; pokračovat, nový plán, import `.pplan.json`, referenční projekt Litice, duplikovat/stáhnout/smazat),
  formulář operativní karty podle finálního vzoru A4 (tlačítko „NE“, značky z katalogu u nebezpečí a vodních zdrojů, desetinná čísla s čárkou),
  živý náhled A4, kontrola úplnosti s přeskokem na pole, panel Metodika DZP, správa listů a revizí, lokální ukládání (localStorage),
  záloha Stáhnout → Editovatelný projekt. Tisk/PDF zatím přes tisk prohlížeče; vlastní export PDF je krok 5.
- **Editor situace a půdorysu (krok 4)**: listy typu situace / půdorys / schéma. Nástroje: výběr, plátno, stěna, čára, trasa (délka v metrech),
  plocha, obdélník, elipsa, volná kresba, text, značka z katalogu, dveře, kalibrace. Výběr (klik, Shift, oblast), úchyty pro velikost a otočení,
  úprava vrcholů, kopírování/vložení/mazání, undo/redo, přichytávání (body, mřížka, ortho), vrstvy (viditelnost, zámek, pořadí, aktivní vrstva),
  přesná editace vlastností, dveře vázané na stěny (jedno-/dvoukřídlé, vrata; sledují stěnu, jdou odpojit a přepojit), barvy metodiky, síť 10 × 10 m,
  severka, měřítko, razítko, automatická legenda „LEGENDA ZNAČEK“, velikost značek a textu 1–500 mm (krok 0,1, posuvník, +/−),
  zoom kolečkem bez Ctrl k ukazateli, dotyk (tap, dva prsty), export listu do SVG a PNG (300 dpi), import podkladu PNG/JPG s kalibrací podle známé délky.
  Měřítko podkladu je do kalibrace označené jako NEOVĚŘENÉ (v editoru, v kontrole úplnosti i na razítku exportu).
  Úložiště: IndexedDB (kvůli podkladům), záložně localStorage. Podklady jsou součástí zálohy projektu.
- Testy: `npm test` (jednotkové: model, prvky, render), `npm run test:e2e` (Chromium + Playwright: formulář i editor).
- **Importy (krok 6)**: DXF, SVG, PDF, PNG, JPG (z tlačítka Import… v editoru i z přehledu projektů).
  - DXF (ASCII): čáry, polylinie včetně oblouků, kružnice, oblouky, elipsy, spliny (zjednodušeně), SOLID, texty a MTEXT (formátovací kódy, zalomení, Unicode `\U+`,
    `%%c/%%d/%%p`, XML entity, kódová stránka ANSI_1250 aj.), bloky (vnořené, pole), kóty (z anonymních bloků), vrstvy (vypnuté a zmrazené se importují skryté),
    barvy ACI. Jednotky se berou z `$INSUNITS`; když chybí, uživatel je musí zvolit (předvybraný je odhad z kót a rozměrů) a měřítko zůstane NEOVĚŘENÉ do kalibrace.
    Vrstvy se jménem stěn se importují jako (tenké) stěny, bloky se jménem dveří jako dveře označené ke kontrole. HATCH, IMAGE a 3D se přeskočí a hlásí se.
  - SVG: tvary, cesty (křivky, oblouky), transformace, texty. Měřítko tisku zadá uživatel, měřítko zůstane NEOVĚŘENÉ do kalibrace.
  - PDF (pdf.js, `vendor/pdfjs`, Apache-2.0): buď vektorově (čáry, plochy s barvou, texty; navazující úsečky se sloučí), nebo jako rastrový podklad. Situace Litice (20 000 úseček) se převede za ~1 s.
  - DWG se v prohlížeči nepřevádí (bezpečný převod není možný) – aplikace to řekne a poradí uložit DXF/PDF.
  - Kalibrace neověřeného vektorového importu: nástroj Kalibrace, dva body a známá délka; přeškáluje celý obsah listu.
- Zatím není: export PDF a Word, zobrazení více podlaží najednou, převod DXF HATCH (výplní).

## Plán práce
1. datový model karty podle vzoru
2. převod 109 značek do SVG (název + zdroj)
3. vyplňování karty s kontrolou úplnosti
4. editor situace a půdorysu
5. export PDF a Word (hotovo: SVG a PNG listu výkresu)
6. import DXF/PDF/SVG (hotovo)

Odborné údaje je nutné před vydáním DZP ověřit podle aktuální legislativy a s HZS.

## Rozhodnutí uživatele
- Výchozí vzor operativní karty: `podklady/VZOR_operativni_karta_list_A4.docx` (finální). Starší `VZOR_OPERATIVNI_KARTA.docx` je delší varianta.
- Metodika Hanuška 1996 je pro uživatele závazný základ; legislativní platnost se i tak ověřuje u každé DZP.
- Přiložené PNG značky (zatím 10 ks) jsou v `podklady/znacky_E_F/`, kódy E/F zatím nepřiřazeny.

## Požární evakuační plán (samostatný druh dokumentace, není DZP)
Při zakládání projektu lze zvolit „Požární evakuační plán“. Má vlastní listy (Evakuační plán – text, Půdorys/Schéma/Text), vlastní kontrolu úplnosti a vlastní panel Metodika; DZP listy (karta, situace) do něj nelze vložit a naopak. V evakuačním plánu se nepoužívá katalog značek DZP, ale vlastní knihovna evakuačních značek (`js/evakznacky.js`) a neplatí DZP kontroly (síť 10 × 10 m, severka, stupeň poplachu).
- **Textová část a kontrola** podle vyhlášky č. 246/2001 Sb., § 33 odst. 2 písm. a)–f), odst. 4 (ověření cvičným poplachem) a odst. 5 (uložení). Zdroj: `podklady/evakuace/` (vyhlášky 246/2001 a 23/2008, `NALEZITOSTI.md`).
- **Grafická část** (f) se kreslí na listech Půdorys nástrojem Úniková cesta. **Vzhled podle ČSN ISO 23601 (nezávazná) zatím není implementován ani kontrolován** – text normy chybí. Značky pro evakuaci (ISO 7010) rovněž čekají na podklady.
- Export PDF zahrnuje textovou část plánu.
- **Značky evakuačního plánu:** 16 míst (východ vlevo/vpravo, 2 směrové šipky, shromaždiště, hasicí přístroj, hadice/hydrant, první pomoc, hlásič, tísňové volání, evakuační výtah, výtah, schodiště, elektrické zařízení, místo řízení evakuace, ústředna EPS). Oficiální značky ISO 7010 nahrává uživatel (PNG, JPG, SVG) přímo v nástroji Značka; ukládají se do projektu. Kde existuje podobná značka ČAHD z DZP, nabídne se jako **náhrada označená „ISO 7010 neověřeno“** (kontrola úplnosti upozorní); značka DZP přímo v evakuačním plánu je chyba. 
- Od uživatele už dodané značky (součást aplikace, `js/evakvychozi.js`, zdroj `znacky/evakuace/`): nouzový východ vlevo a vpravo, směrová šipka přímá a šikmá, shromaždiště. Ostatní zbývá nahrát nebo použít náhradu z DZP.
- **List „Evakuační plán – podlaží“** (`js/kresleni/evakplan.js`) podle ČSN ISO 23601: formát A3 a větší (A4 jen pro plán v místnosti), zelené záhlaví „ÚNIKOVÝ PLÁN“ s rozměry z tabulky 1 normy, označení podlaží, okno bezpečnostních pokynů (POŽÁR / EVAKUACE – texty zadává zpracovatel, nepředvyplňují se), automatická legenda, popisové pole (zhotovitel, datum, číslo plánu, číslo revize), bod „Jste zde“ (nástroj Jste zde, štítek s ukazatelem), přehledový plán (automaticky, je-li zobrazena jen část objektu, se zvýrazněnou zobrazenou částí a shromaždišti), únikové cesty jako světle zelený pás se šipkami (typ D) po směru kreslení, minimální tloušťky čar (stěny 1,6 mm, příčky 0,6 mm) a minimální velikost značek 7 mm. Barvy jsou přibližné hodnoty sRGB (norma odkazuje na ISO 3864-4, kterou nemáme). Kontrola úplnosti hlídá požadavky normy (měřítko podle kategorie objektu, formát, záhlaví, údaje popisového pole, pokyny, „Jste zde“, východ, shromaždiště, legenda, velikost značek). Export PDF zachovává formát listu (A3 vektorově).

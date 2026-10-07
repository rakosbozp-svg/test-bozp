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
  severka, měřítko, razítko, automatická legenda „LEGENDA ZNAČEK · PBŘ“, velikost značek a textu 1–500 mm (krok 0,1, posuvník, +/−),
  zoom kolečkem bez Ctrl k ukazateli, dotyk (tap, dva prsty), export listu do SVG a PNG (300 dpi), import podkladu PNG/JPG s kalibrací podle známé délky.
  Měřítko podkladu je do kalibrace označené jako NEOVĚŘENÉ (v editoru, v kontrole úplnosti i na razítku exportu).
  Úložiště: IndexedDB (kvůli podkladům), záložně localStorage. Podklady jsou součástí zálohy projektu.
- Testy: `npm test` (jednotkové: model, prvky, render), `npm run test:e2e` (Chromium + Playwright: formulář i editor).
- Zatím není: import DXF/SVG/PDF, export PDF, převod CAD textů, import kót, zobrazení více podlaží najednou.

## Plán práce
1. datový model karty podle vzoru
2. převod 109 značek do SVG (název + zdroj)
3. vyplňování karty s kontrolou úplnosti
4. editor situace a půdorysu
5. export PDF a Word (hotovo: SVG a PNG listu výkresu)
6. import DXF/PDF/SVG

Odborné údaje je nutné před vydáním DZP ověřit podle aktuální legislativy a s HZS.

## Rozhodnutí uživatele
- Výchozí vzor operativní karty: `podklady/VZOR_operativni_karta_list_A4.docx` (finální). Starší `VZOR_OPERATIVNI_KARTA.docx` je delší varianta.
- Metodika Hanuška 1996 je pro uživatele závazný základ; legislativní platnost se i tak ověřuje u každé DZP.
- Přiložené PNG značky (zatím 10 ks) jsou v `podklady/znacky_E_F/`, kódy E/F zatím nepřiřazeny.

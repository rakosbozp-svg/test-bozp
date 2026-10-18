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

## Úvodní stránka: volba DZP × evakuační plány
V horní liště vpravo se přepíná režim **Dokumentace zdolávání požárů** nebo **Požární evakuační plány** (adresy `#/dzp` a `#/evakuace`, volba se pamatuje v prohlížeči). Podle režimu se mění nadpis, zakládání nového projektu, import podkladu (DZP → situace, evakuace → list podlaží) i seznam uložených projektů; logo vrací do režimu otevřeného projektu. Referenční projekt Litice je jen v režimu DZP.

## Operativní plán (DZP)
Druh dokumentace „Operativní plán“ (režim DZP) se zakládá podle Metodického návodu (Hanuška 1996, kap. 2 a příloha č. 3) se čtyřmi listy:
- **Základní text OP** – operativně taktická studie (rozsah příloh, důvody složitých podmínek podle kap. 2.1.1, osoby, signalizace, dojezd, jednotka podniku, voda, stupeň poplachu), nejsložitější varianta požáru, výpočet SaP (zda se provádí, důvod, výpis z PPP, výsledek) a závěr. Součástí je **nepovinný hrubý odhad SaP** podle Pomůcky ČAHD 11/2011 (intenzita 10/8/4 l·min⁻¹·m⁻², Qhp = Sh·Ip nebo Oh·Ip, Nhpr = Qhp/qpr, NHA ≈ 1,25·k·Npr ze vzoru Hanuška) – výslovně nenahrazuje výpočet podle části druhé metodiky.
- **Vyjímatelná příloha – text** – operativně taktická charakteristika (budovy, osoby, činnosti, látky, SHZ/EPS, rozvody, složité podmínky; vodní zdroje a hasiva; komunikace), doporučení pro velitele zásahu a důležitá telefonní čísla.
- **Situace podniku** a **Půdorys** – stávající editor výkresů; lze přidat další půdorysy, schéma, operativní kartu a text.
Kontrola úplnosti hlídá povinné části (kap. 2.1–2.3), náhled i export PDF obsahují textové listy. Klik na nález otevře příslušný list.

### Přebírání údajů karta ↔ operativní plán
V listech OP je tlačítko **Převzít údaje z operativní karty…**, v kartě **Převzít údaje z operativního plánu…**. Zdrojem může být list v tomto projektu i v jiném projektu DZP uloženém v prohlížeči. Aplikace ukáže návrh (co se kam zapíše); prázdná pole jsou předvybraná, pole s hodnotou jsou odškrtnutá a označená „Přepíše“. Do plánu se převádí: budova (charakter objektu), osoby, nebezpečí s hasivy, PBZ, uzávěry/vypínače a FVE, vodní zdroje (s průtokem a ověřením), příjezd a omezení, doporučení, kontakty, stupeň poplachu. Do karty jen jednoznačná pole (vybraná budova, osoby, doporučení, stupeň poplachu) – nebezpečí, vodní zdroje a PBZ jsou v kartě strukturované a z textu plánu se nerozkládají. Údaje se kopírují jednorázově, nejsou trvale propojené.

### Výpočet SaP (Hanuška 1996, část druhá) – list „OP – výpočet SaP“
Kalkulačka podle kap. 3–5 a tabulek č. 1, 2, 4 metodiky: dojezdy jednotek (tDO = tv + 60·L/45), doba volného rozvoje tVR, t1/t2/t3, rádius šíření R (v době prvních proudů i lokalizace), plocha požáru a hašení pro kruhovou, úhlovou (f podle úhlu) a pravoúhlou formu, pravidlo 85 % plochy úseku, dodávka na hašení (Sh·Ip nebo Oh·Io) a ochlazování nádrží, počet proudů, automobilů (podle družstva i 0,75·Qc), hasičů (1,25·Σk·N), porovnání s vydatností zdroje, ochranná doba dýchacího přístroje, dálková doprava (čerpadla i kyvadlo) a zásoba pěnidla. Každý krok se vypisuje se vzorcem a dosazenými hodnotami; chybějící vstupy se hlásí. Tlačítko zapíše shrnutí do základního textu OP. Pozn.: ve vzorci tVR má zdroj u tBR index „Po“, vysvětlivka i schéma „Pr“ – použito „Pr“ a uvedeno v protokolu. Technika z tab. 9 (1996) není přednastavená – výkon čerpadla zadává zpracovatel.

### Kontrola grafické části DZP
Situace: vodní zdroj, nástupní plocha (žlutá plocha nebo značka), hlavní uzávěry/vypínače, místo soustředění evakuovaných (Hanuška 2.3.2). Půdorys: únikové/zásahové cesty a vchody (2.3.3). Soulad s kartou: hydrant, vodní zdroje, uzávěr plynu/vody, vypínač, FVE (vypínač / TOTAL / CENTRAL STOP), EPS a nebezpečí uvedené v kartě musí mít značku ve výkresech. Vše jen jako upozornění – aplikace nečte text ani obsah podkladu (obrázek, DXF).

## Dotazník pro klienta (DZP)
V levém panelu projektu DZP (karta i operativní plán) je položka **Dotazník pro klienta** (`js/dotaznik.js`, 36 otázek v 7 oddílech). Ptá se jen na to, co v PBŘ a výkresech zpravidla není nebo se mohlo změnit: provoz a kontakty, změny proti projektu, hlavní vypínač a uzávěry, prostory pod napětím po vypnutí, FVE, nebezpečné látky a tlakové lahve, EPS a PCO, další PBZ, hydrant s ověřeným průtokem, jiné zdroje vody, organizace PO (zjištění a ohlášení požáru, jednotka podniku), příjezd a místa nebezpečná pro hasiče.
- **Stáhnout PDF k vyplnění** – vyplnitelné PDF (formulářová pole, písmo s českou diakritikou). Vyplněné PDF se **načte zpět** (`js/pdf/dotaznikPdf.js`); naskenovaný papír je třeba opsat ručně.
- **Převzít odpovědi do projektu** – stejný přehled jako u přebírání karta ↔ plán: odpovědi jdou do karty, operativního plánu a do „Poznámek k ověření“ (změny, shromaždiště, další PBZ…); neprázdná pole se bez zaškrtnutí nepřepíší, látky se rozdělí po řádcích do nebezpečí karty, hydrant se zapíše jako vodní zdroj.
- **Načíst údaje z PBŘ / dokumentace…** – v dotazníku i na operativní kartě (`js/pbr.js`). Lze vybrat více souborů najednou: PBŘ, průvodní (A) a souhrnnou (B) technickou zprávu.
  - **PDF s textem** se čte přímo; **naskenované PDF** se po potvrzení rozpozná **OCR** (`js/ocr.js`, Tesseract.js s českým modelem, běží offline v prohlížeči, nic se neodesílá, cca 3–5 s na stranu); **Word .docx** se čte bez knihovny (`js/docx.js`). Starý formát .doc nečte – uložte ho jako .docx nebo PDF.
  - Čte podle typických formulací: adresu / místo stavby, název stavby, investora / stavebníka a IČ, zastavěnou plochu, podlaží, požární výšku, počet osob, konstrukce (i tabulkové „Konstrukce objektu smíšený“), požární úseky se SPB, typ a počet únikových cest, příjezd a vzdálenost od komunikace, nástupní plochu, vnější hydranty (vč. GPS), vnitřní odběrná místa, přenosné hasicí přístroje, TOTAL/CENTRAL STOP, EPS/SHZ/ZOKT, autonomní detekci, plyn, zdroj tepla, přípojky, nebezpečné látky, FVE (kWp), kategorii stavby a „změnu stavby skupiny I–III“ (ČSN 73 0834).
  - Každý údaj má **citaci, soubor a stranu** (u OCR i jistotu rozpoznání strany) a zapíše se až po potvrzení. Předem odškrtnuté jsou údaje k ověření (investor ≠ provozovatel, požární výška ≠ celková výška, název stavby ≠ název objektu, „látky se nevyskytují“), údaje ze stran s OCR jistotou pod 75 % a údaje, ve kterých se **dokumenty navzájem liší** (např. PBŘ „3 NP“ × průvodní zpráva „1“) – ty jsou označené „POZOR“ a převezme se jen ta zaškrtnutá. Záhlaví a zápatí stran se do citací nepřenášejí.
  - **Operativní plán:** tlačítko je i v listech plánu (základní text, vyjímatelná příloha). Údaje se skládají do polí přílohy podle Hanušky (osoby, látky, SHZ/EPS, rozvody a vypínače, vodní zdroje, komunikace) a základního textu (osoby, EPS, zásobování vodou) – více údajů do jednoho pole, nic se nepřepíše bez zaškrtnutí. Podlaží, půdorys, konstrukce a požární úseky se nabídnou jako **budova v „Budovy a zařízení“** (název a celkovou výšku doplníte – PBŘ uvádí název stavby a požární výšku). Má-li plán jednu budovu, doplní se její pole; má-li jich víc, nabídne se nová (neoznačená). Co je v textu plánu, se už nezdvojuje do poznámek (kromě plynu – úkol zjistit uzávěr).
  - Co v žádném dokumentu nebylo, se ukáže v dotazníku jako seznam otázek pro klienta. Průtok hydrantu se nepřebírá (PBŘ uvádí požadavek normy, ne měření).
- Omezení PBŘ: pravidla jsou vyladěná na dvou PBŘ (novostavba / změna užívání s tabulkami; změna stavby skupiny II, sken) a jedné průvodní a souhrnné zprávě; u jiných zpracovatelů se část údajů nemusí najít – zůstanou v dotazníku, nic se nedomýšlí. OCR může zaměnit znaky (čísla!) – proto citace. Jednosouborová verze je kvůli OCR větší (≈ 11 MB); OCR potřebuje prohlížeč s WebAssembly SIMD (Chrome/Edge 91+, Firefox 89+, Safari 16.4+).
- Omezení: chování konkrétního prohlížeče PDF při psaní do polí (písmo) aplikace nezaručí; načtení hodnot zpět ověřují testy.

Výpočet SaP: výběr techniky **CAS 20 / CAS 30** nastaví minimální výkon čerpadla podle vyhlášky č. 35/2007 Sb. (2 000 / 3 000 l/min); skutečný výkon vozu lze zadat ručně.

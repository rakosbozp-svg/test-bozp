# Automatická záloha projektů – plán implementace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Cíl:** Projekty Požárního plánovače se v artefaktu na claude.ai samy zálohují do soukromého úložiště artefaktu a jdou z něj obnovit.

**Architektura:** Tři nové moduly v `js/zaloha/`. `kodovani.js` obsahuje čisté funkce: otisk, gzip, base64, dělení na části a bezpečné segmenty. `uloziste.js` je tenká vrstva nad schopnostmi `db` a `user`. `autozaloha.js` řídí frontu, prodlevu, dohánění, stav a chyby. `js/ulozeni.js` hlásí změny přes `sleduj`. `js/app.js` kreslí kartu, upozornění na obnovu, dialog a upravenou připomínku.

**Technologie:** čistý JavaScript (ES moduly, bez nových závislostí), Web API `CompressionStream`/`DecompressionStream`, `crypto.subtle`, `btoa`/`atob` (všechno je i v Node 22), testy `node --test` a Playwright (Chromium). Sestavení běží přes esbuild z `js/app.js`, nové moduly se přibalí samy.

**Specifikace:** `pozarni-planovac/docs/superpowers/specs/2026-11-04-automaticka-zaloha-design.md`

Všechny cesty níže jsou relativní k `pozarni-planovac/`.

## Globální omezení

- **Schopnosti při publikaci:** `{sample: {images: true}, downloads: true, db: {}, user: {}}`. Pravidla `db` zůstávají výchozí.
- **Hlavička projektu:** `data/users/<uid>/<seg(pid)>`, tvar `{format: 1, nazev, typ, zmeneno, velikost, sha256, verze, casti, komprese, zalohovano, smazano}`.
- **Část:** `data/users/<uid>/<seg(pid)>/casti/<verze>_<i>`, tvar `{d, t}`, kde `d` má nejvýš **200 000** znaků base64 a `t` je ISO čas zápisu.
- **Hodnoty polí:** `komprese` je `"gzip"` nebo `"zadna"`. `verze` je 10 znaků `[0-9a-z]`. `velikost` jsou bajty UTF-8 textu projektu. `sha256` je hex otisk textu projektu.
- **Segment:** povolené jsou písmena, číslice a `_ - ~ : @`. Všechny ostatní bajty UTF-8 (včetně `.` a `+`) se zakódují jako `+xx` (malá hex), takže převod je vratný.
- **Prodleva:** výchozí **30 000 ms** po poslední změně. Pro testy ji přepíše `window.__PP_PRODLEVA_ZALOHY__` (ms).
- **Limit připojení:** 10 000 ms. Bez úspěchu je záloha nedostupná.
- **Chyby (texty přesně podle specifikace):**
  - `quota_exceeded` → „Úložiště artefaktu je plné. Odstraňte ze zálohy smazané projekty, nebo zálohujte ručně.“, fronta se zastaví do další změny.
  - `resource_exhausted` → „Příliš mnoho požadavků, záloha pokračuje za minutu.“, pauza 60 000 ms.
  - `unavailable` → „Úložiště je dočasně nedostupné.“ až po jednom novém pokusu po 2000–5000 ms.
  - `revoked` → záloha je nedostupná a karta zmizí.
  - jiný kód → „Záloha projektu „X“ selhala (kód …).“, projekt se přeskočí.
- **Úklid částí:** smaže části jiné verze než platné, pokud patří předchozí verzi hlavičky nebo jsou starší než **3 600 000 ms** (podle `t`).
- **Připomínka ruční zálohy:** 30 dní s textem „Automatická záloha běží. Jednou za měsíc si stáhněte i kopii mimo claude.ai (Zálohovat všechny projekty).“, když je záloha ve fázi `ok` a nic nečeká. Jinak dnešních 7 dní.
- **Mimo claude.ai** (žádné `claude.use`, `db`/`user` je `null`, `user.id()` je `null`) se karta ani upozornění nezobrazí a nic nevyhodí výjimku.
- **Nezávislost:** ukládání do prohlížeče na záloze nezávisí a chyba zálohy nesmí zablokovat `U.uloz`.
- **Konvence:** názvy, komentáře a texty česky jako ve zbytku kódu. Žádné nové npm závislosti.

## Na co se při revizi zaměřit

1. **Dvě karty (nebo dva počítače) zálohují stejný projekt souběžně:** hlavička musí vždy ukazovat na úplnou verzi a obnova projde. Test je v úkolu 3.
2. **Projekt se smaže v prohlížeči během nahrávání jeho částí:** hlavička musí skončit se `smazano`. Test je v úkolu 3.
3. **Při obnově chybí nebo je poškozená část:** tento projekt jde do `chyby` a ostatní se obnoví. Test je v úkolu 3.
4. **Odhlášený uživatel nebo `user.id()` → `null`:** žádná karta, žádná výjimka, ukládání běží. Testy jsou v úkolech 2 a 4.
5. **Projekt s diakritikou, uvozovkami, zpětnými lomítky, emoji a vícemegovým base64 podkladem:** musí projít tam a zpět bajtově stejně, se stejným otiskem. Test je v úkolu 1.

---

### Úkol 1: Kódování zálohy (`js/zaloha/kodovani.js`)

**Soubory:**
- Vytvořit: `js/zaloha/kodovani.js`
- Vytvořit test: `test/zaloha.test.mjs`
- Upravit: `package.json` (do skriptu `test` přidat `test/zaloha.test.mjs`)

**Rozhraní:**
- Vytváří:
  - `MAX_CAST = 200000`
  - `otisk(text: string): Promise<string>` (SHA-256, 64 hex znaků)
  - `zabal(text: string, {gzip = typeof CompressionStream !== 'undefined'} = {}): Promise<{data: string, komprese: 'gzip'|'zadna', velikost: number}>`
  - `rozbal({data, komprese}): Promise<string>`
  - `rozdel(data: string, n = MAX_CAST): string[]`, která pro prázdný řetězec vrací `['']`
  - `bezpecnySegment(id: string): string`, která pro prázdné id vyhodí `Error('Prázdné id projektu')`
  - `zpetSegment(s: string): string`
  - `novaVerze(): string`

- [ ] **Krok 1: Napsat padající testy**
  - `kódování tam a zpět: diakritika, uvozovky, zpětná lomítka, emoji`: `rozbal(await zabal(t))` se rovná `t` pro `t = '{"nazev":"Hala „Žluťoučký kůň“ \\\\ \\"x\\" 🔥"}'`. Totéž platí s `{gzip: false}` a pak je `komprese === 'zadna'`.
  - `velký podklad: 3 MB náhodného base64, všechny části do limitu`: `rozdel(data)` vrátí části o délce ≤ 200000 a `Buffer.byteLength(JSON.stringify({d: c, t: new Date().toISOString()})) < 256 * 1024`. Po `join('')` dají původní data a `otisk` po obnově je stejný.
  - `otisk je stabilní hex`: `otisk('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'`.
  - `bezpečný segment tam a zpět`: pro `['proj_ab12cd34', 'a/b c', 'Žár', '.', '..', 'x+y.z']` platí, že `zpetSegment(bezpecnySegment(id)) === id`, výstup odpovídá `/^[A-Za-z0-9_\-~:@+]+$/` a není `.` ani `..`. Pro `bezpecnySegment('proj_ab12cd34')` platí `=== 'proj_ab12cd34'`. `bezpecnySegment('')` vyhodí výjimku.
  - `nová verze`: `/^[0-9a-z]{10}$/` a 100 volání dá 100 různých hodnot.
- [ ] **Krok 2: Spustit a ověřit, že testy padají**
  Spustit `node --test test/zaloha.test.mjs`. Očekává se FAIL (modul neexistuje).
- [ ] **Krok 3: Implementovat `js/zaloha/kodovani.js`**
  - gzip: `new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))` a pak `new Response(…).arrayBuffer()`.
  - base64: po blocích 0x8000 bajtů přes `btoa(String.fromCharCode(...blok))`, ať velké pole nepřeteče zásobník.
  - `novaVerze`: `crypto.getRandomValues` → base36.
- [ ] **Krok 4: Spustit testy**
  Spustit `node --test test/zaloha.test.mjs`. Očekává se PASS.
- [ ] **Krok 5: Commit**
  `git commit -m "Záloha: kódování (otisk, gzip, base64, části, bezpečné segmenty)"`

### Úkol 2: Vrstva nad úložištěm (`js/zaloha/uloziste.js`) a falešné úložiště pro testy

**Soubory:**
- Vytvořit: `js/zaloha/uloziste.js`
- Vytvořit: `test/falesne-uloziste.mjs`
- Upravit test: `test/zaloha.test.mjs`

**Rozhraní:**
- Používá: z úkolu 1 `bezpecnySegment`, `zpetSegment`.
- Vytváří (`test/falesne-uloziste.mjs`):
  - `falesneUloziste({dokumenty = {}, uid = 'u1'} = {})` vrací `{claude: {use(name)}, dokumenty, stav}`.
  - `dokumenty` je prostý objekt `cesta → data` a dá se serializovat pro nový kontext.
  - `stav.pred = null | ((sloveso, cesta) => void)`: háček, který může vyhodit `{code, message}` a tím simulovat chybu.
  - `stav.zapisy` je pole `[sloveso, cesta]`.
  - Funkce musí být soběstačná (žádné importy ani vnější proměnné), protože se do stránky vkládá přes `falesneUloziste.toString()`.
  - Implementuje podmnožinu `db.d.ts`:
    - `db.doc(cesta)` → `{id, path, get, set, update, delete, collection(nazev)}`,
    - `db.collection(cesta)` → `{get: () => ({docs, size, empty}), doc(id)}`,
    - snímky `{id, exists, data()}`.
  - Kontroluje paritu segmentů (TypeError) a limit 256 KiB (`invalid_argument`). `update` na neexistující dokument vyhodí `invalid_argument`.
  - Operace jsou asynchronní (`await Promise.resolve()` před i po), aby šly souběhy.
  - `use('user')` → `{id: async () => uid}`. `uid: null` simuluje odhlášení.
- Vytváří (`js/zaloha/uloziste.js`):
  - `kodChyby(e): string`, která vrací `e.code`, pokud je to neprázdný řetězec, jinak `'unavailable'`.
  - `pripoj({claude = globalThis.claude, limitMs = 10000} = {}): Promise<Uloziste|null>`.
  - `Uloziste`:
    - `{uid, hlavicky(): Promise<Array<Hlavicka & {pid: string}>>`
    - `zapisCasti(pid, verze, casti: string[]): Promise<void>` (zapisuje postupně, `{d, t}`)
    - `zapisHlavicku(pid, h): Promise<void>`
    - `oznacSmazany(pid, kdy): Promise<boolean>` (vrací false, když hlavička není)
    - `zrusSmazani(pid): Promise<void>`
    - `uklid(pid, platna, predchozi, tedMs = Date.now()): Promise<number>` (vrací počet smazaných)
    - `ctiData(pid, h): Promise<string>` (chybějící část vyhodí `{code: 'chybi_cast'}`)
    - `odstran(pid): Promise<void>` (smaže všechny části a pak hlavičku)
  - `Hlavicka` je JSDoc typ podle globálních omezení.

- [ ] **Krok 1: Napsat padající testy**
  - `připojení: bez claude, s use → null, s uid null a po limitu → null`. `pripoj({claude: undefined})`, `pripoj({claude: {use: async () => null}})`, `pripoj({claude: falesneUloziste({uid: null}).claude})` a `pripoj({claude: {use: () => new Promise(() => {})}, limitMs: 50})` vrátí `null` a nevyhodí výjimku.
  - `části a hlavička tam a zpět`: `zapisCasti('proj_a', 'v1', ['ab', 'cd'])` + `zapisHlavicku` (`casti: 2`, `verze: 'v1'`). Pak `ctiData` vrátí `'abcd'` a `hlavicky()` vrátí jednu položku s `pid === 'proj_a'`.
  - `úklid: smaže předchozí verzi a staré sirotky, nechá čerstvé cizí části`: v úložišti jsou `v0_0` (předchozí), `vX_0` s `t` starším než 1 h, `vY_0` s čerstvým `t` a `v1_0`. `uklid('proj_a', 'v1', 'v0')` vrátí 2 a zůstanou `vY_0` a `v1_0`.
  - `odstranění smaže hlavičku i všechny části`, `označení smazaného bez hlavičky vrátí false`, `chybějící část → chybi_cast`.
- [ ] **Krok 2: Spustit a ověřit, že testy padají**
  Spustit `node --test test/zaloha.test.mjs`. Očekává se FAIL v nových testech.
- [ ] **Krok 3: Implementovat `test/falesne-uloziste.mjs` a `js/zaloha/uloziste.js`**
  - Časový limit `pripoj` je `Promise.race` s `setTimeout`, výsledek je null.
  - Cesty: hlavička `db.collection('data/users/' + uid).doc(seg)`, části `db.doc('data/users/' + uid + '/' + seg).collection('casti')`.
  - Každý zápis se čeká (`await`) před dalším.
- [ ] **Krok 4: Spustit testy**
  Spustit `node --test test/zaloha.test.mjs`. Očekává se PASS.
- [ ] **Krok 5: Commit**
  `git commit -m "Záloha: vrstva nad úložištěm artefaktu a falešné úložiště pro testy"`

### Úkol 3: Automatická záloha – fronta, dohánění, stav, chyby, obnova (`js/zaloha/autozaloha.js`)

**Soubory:**
- Vytvořit: `js/zaloha/autozaloha.js`
- Upravit test: `test/zaloha.test.mjs`

**Rozhraní:**
- Používá:
  - úkol 1 (`otisk`, `zabal`, `rozbal`, `rozdel`, `novaVerze`),
  - úkol 2 (`Uloziste`, `kodChyby`),
  - z `js/model.js` `nactiProjekt(text)`.
- Vytváří `vytvorAutozalohu({ulozeni, uloziste, prodlevaMs = 30000, ted = () => new Date(), cekej = (ms) => new Promise((r) => setTimeout(r, ms)), nahoda = Math.random})`:
  - `start(): Promise<void>`: přihlásí se k `ulozeni.sleduj`, načte hlavičky a zařadí dohánění.
  - `stav(): {faze: 'pripojuje'|'ok'|'probiha'|'chyba'|'nedostupna', pocet, smazanych, posledni: string|null, hotovo, celkem, ceka, chyba: {kod, text}|null}`
  - `naZmenu(fn): () => void`
  - `projekty(): Array<Hlavicka & {pid}>`
  - `nactiProObnovu(pids: string[]): Promise<{projekty, chyby: string[], vytvoreno: string|null}>`
  - `odstranZeZalohy(pid): Promise<void>`
  - `dokonci(): Promise<void>`: zpracuje frontu hned, bez prodlevy, pro testy.
- Rozhraní `ulozeni`, které záloha očekává (úkol 4 ho doplní do `js/ulozeni.js`):
  - `sleduj(fn: ({typ: 'ulozeno'|'smazano', id}) => void): () => void`
  - `seznam(): Array<{id, nazev, typ, zmeneno}>`
  - `zaznam(id): {id, nazev, typ, zmeneno, text}|null`

**Záloha jednoho projektu** (pořadí je závazné, protože na něm stojí bezpečný přepis):
1. `r = ulozeni.zaznam(pid)`, `h` = hlavička z mezipaměti.
2. Bez `r`: když `h` existuje a nemá `smazano`, volá se `oznacSmazany(pid, ted())`. Konec.
3. `sha = otisk(r.text)`. Když `h?.sha256 === sha`: se `smazano` se zavolá `zrusSmazani`, jinak se nic nezapisuje. Konec.
4. `zabal` → `rozdel` → `verze = novaVerze()` → `zapisCasti(pid, verze, casti)`.
5. Znovu se zkontroluje `ulozeni.zaznam(pid)`. Když zmizel, `smazano = ted()`, jinak `null`.
6. `zapisHlavicku(pid, {format: 1, nazev, typ, zmeneno, velikost, sha256: sha, verze, casti, komprese, zalohovano: ted(), smazano})` a aktualizace mezipaměti.
7. `uklid(pid, verze, h?.verze ?? null)`.

**Dohánění po startu:** do fronty jdou projekty bez hlavičky a projekty, kde `r.zmeneno > h.zmeneno` (porovnání řetězců ISO).

- [ ] **Krok 1: Napsat padající testy**
  Používá falešné `ulozeni` (Map záznamů a seznam posluchačů), `falesneUloziste` a `pripoj`, `prodlevaMs: 10` a `cekej` bez čekání se záznamem volání.
  - `změna se po prodlevě zazálohuje a obnova vrátí stejný text`: po `sleduj` → `ulozeno` a `dokonci()` má `projekty()` 1 položku, `stav().faze === 'ok'`, `stav().pocet === 1` a `nactiProObnovu(['proj_a'])` vrátí projekt shodný s `nactiProjekt(text)`.
  - `beze změny otisku se nic nezapíše`: druhé `ulozeno` se stejným textem nepřidá do `stav.zapisy` žádné `set`.
  - `smazání označí hlavičku; obnova smazaného jen zruší značku`: po `smazano` je `smazano` ISO. Po znovuvložení stejného textu je `smazano === null` a nepřibudou žádné části.
  - `přerušení při zápisu částí nepoškodí zálohu`: `stav.pred` vyhodí `invalid_argument` na druhé části nové verze. `nactiProObnovu` pak vrátí starou verzi a další úspěšná záloha smaže sirotky staré verze.
  - `souběh dvou záloh stejného projektu: hlavička vždy na úplné verzi`: dvě instance nad stejným `falesneUloziste` s různým textem se spustí současně (`Promise.all`). Potom `nactiProObnovu` projde (otisk sedí) a vrátí jeden z obou textů.
  - `smazání během nahrávání: hlavička skončí se smazano`: `stav.pred` při první části odstraní záznam z falešného `ulozeni`. Výsledek: `projekty()[0].smazano` je ISO.
  - `dohánění po startu`: pro (chybí hlavička, novější `zmeneno`, stejné `zmeneno`) se nahrají právě 2 projekty.
  - `chyby`:
    - `quota_exceeded` → `faze 'chyba'` s přesným textem a zbytek fronty čeká, `ceka > 0`.
    - `resource_exhausted` → `cekej` zavolán s 60000 a záloha pak dokončena.
    - `unavailable` dvakrát → jeden nový pokus s prodlevou v [2000, 5000] a pak `chyba` s textem „Úložiště je dočasně nedostupné.“
    - `revoked` → `faze 'nedostupna'`.
    - `invalid_argument` u projektu „X“ → text „Záloha projektu „X“ selhala (kód invalid_argument).“ a další projekt se zazálohuje.
  - `obnova s chybějící částí`: dva projekty, u jednoho se smaže část. Výsledek má 1 projekt v `projekty` a 1 položku v `chyby` obsahující název projektu.
- [ ] **Krok 2: Spustit a ověřit, že testy padají**
  Spustit `node --test test/zaloha.test.mjs`. Očekává se FAIL v nových testech.
- [ ] **Krok 3: Implementovat `js/zaloha/autozaloha.js`**
  - Fronta je `Set` id a zpracovává se po jednom.
  - Časovač prodlevy se obnovuje s každou změnou.
  - `posledni` je maximum `zalohovano`. `pocet`/`smazanych` se počítají z hlaviček s `smazano` a bez něj.
  - Posluchači stavu se volají po každé změně stavu.
- [ ] **Krok 4: Spustit testy**
  Spustit `node --test test/zaloha.test.mjs` a `npm test`. Očekává se PASS a stávajících 165 testů beze změny.
- [ ] **Krok 5: Commit**
  `git commit -m "Záloha: fronta, bezpečný přepis verzí, dohánění, chyby a obnova"`

### Úkol 4: Napojení na ukládání a karta „Automatická záloha“

**Soubory:**
- Upravit: `js/ulozeni.js` (přidat `sleduj`, `zaznam`; volat posluchače po úspěšném `uloz` a v `smaz`)
- Upravit: `js/app.js` (start zálohy po `U.init()` v bloku „start“ na konci souboru; karta v `.dlazdice` za `#d-zaloha`)
- Upravit: `css/app.css` (stav karty, chyba)
- Vytvořit test: `test/autozaloha.e2e.test.mjs`
- Upravit: `package.json` (do `test:e2e` přidat `test/autozaloha.e2e.test.mjs`)

**Rozhraní:**
- Používá:
  - z úkolu 2 `pripoj`,
  - z úkolu 3 `vytvorAutozalohu` (`stav`, `naZmenu`).
- Vytváří:
  - `U.sleduj(fn)`, `U.zaznam(id)` (tvar viz úkol 3),
  - v `js/app.js` modulovou proměnnou `zaloha` (instance nebo `null`),
  - funkci `predChvili(iso: string, ted = Date.now()): string` s výstupy:
    - „před chvílí“ pod 1 min,
    - „před N min“ pod 60 min,
    - „před N h“ pod 24 h,
    - jinak `toLocaleDateString('cs-CZ')`.
- Karta:
  - `<div class="rk-card" id="d-autozaloha" hidden>`, titulek „Automatická záloha“, stav `#d-autozaloha-stav` a tlačítko `#d-autozaloha-zobrazit` „Zobrazit zálohu“ (tlačítko použije úkol 5).
  - Viditelná je jen ve fázi jiné než `nedostupna`.
  - Texty:
    - `pripojuje`: „Připojuji úložiště artefaktu…“
    - `ok`: „Zálohováno: ${projektu(pocet)}${smazanych ? ` (+ ${smazanych} smazané)` : ''} · naposledy ${predChvili(posledni)}“
    - `probiha`: „Zálohuji ${hotovo + 1} z ${celkem}…“
    - `chyba`: `chyba.text` + „ Zkusí se znovu při další změně.“
  - Aktualizuje se z `naZmenu` bez překreslení stránky.

- [ ] **Krok 1: Napsat padající testy v prohlížeči** (`test/autozaloha.e2e.test.mjs`, port 8801)
  `addInitScript` vloží `falesneUloziste.toString()`, `window.claude = f.claude`, `window.__PP_PRODLEVA_ZALOHY__ = 300` a `window.__falesne = f`.
  - `úprava projektu se sama zazálohuje a karta ukáže stav`:
    - založí DZP a vyplní `[data-pole="objekt.nazev"]`,
    - do 5 s jsou v `__falesne.dokumenty` hlavička a ≥ 1 část,
    - po návratu na přehled je `#d-autozaloha` viditelná a obsahuje „Zálohováno: 1 projekt“.
  - `bez claude.use se karta nezobrazí a nic nespadne`: `#d-autozaloha` je skrytá a `pageerror` je prázdné.
  - `odhlášený uživatel (uid null): karta skrytá, ukládání funguje`.
- [ ] **Krok 2: Spustit a ověřit, že testy padají**
  Spustit `node --test test/autozaloha.e2e.test.mjs`. Očekává se FAIL (karta neexistuje).
- [ ] **Krok 3: Implementovat**
  - `ulozeni.js`: posluchači se volají v `try/catch`, aby chyba posluchače nerozbila ukládání.
  - `app.js`: po `U.init()` zavolat `pripoj()` a při úspěchu `vytvorAutozalohu({ulozeni: U, uloziste, prodlevaMs: window.__PP_PRODLEVA_ZALOHY__ ?? 30000}).start()`. Start nesmí blokovat `smeruj()`.
- [ ] **Krok 4: Spustit testy**
  Spustit `node --test test/autozaloha.e2e.test.mjs` a pak `npm run test:e2e`. Očekává se PASS.
- [ ] **Krok 5: Commit**
  `git commit -m "Automatická záloha: napojení na ukládání a karta na úvodní stránce"`

### Úkol 5: Obnova, dialog „Automatická záloha“ a připomínka

**Soubory:**
- Upravit: `js/app.js` (upozornění `#d-obnova-zalohy`, dialog, `pripominkaZalohy`)
- Upravit: `css/app.css` (štítky v dialogu)
- Upravit test: `test/autozaloha.e2e.test.mjs`

**Rozhraní:**
- Používá:
  - z úkolu 3 `projekty()`, `nactiProObnovu(pids)`, `odstranZeZalohy(pid)`, `stav()`,
  - existující `obnovZalohu(z)`, `formular`, `potvrd`.
- Upozornění na obnovu:
  - Zobrazí se pro hlavičky bez `smazano`, jejichž `pid` není v `U.seznam()`.
  - Má tlačítko „Obnovit ze zálohy“ (`#d-obnovit-zalohu`) → `obnovZalohu(await zaloha.nactiProObnovu(pids))`.
  - Přesné texty podle N:
    - 1: „V automatické záloze je 1 projekt, který v tomto prohlížeči není.“
    - 2–4: „V automatické záloze jsou N projekty, které v tomto prohlížeči nejsou.“
    - 5 a víc: „V automatické záloze je N projektů, které v tomto prohlížeči nejsou.“
- Dialog (`#d-autozaloha-zobrazit`):
  - Řádek na projekt: zaškrtávátko, název, druh, „zálohováno ${predChvili(zalohovano)}“ a štítek:
    - „není v tomto prohlížeči“,
    - „smazán v prohlížeči“ (`smazano`),
    - „v záloze novější“ (`h.zmeneno > místní zmeneno`).
  - Výchozí zaškrtnutí mají řádky „není v tomto prohlížeči“ a „smazán v prohlížeči“.
  - Tlačítko „Obnovit“ → `obnovZalohu` s vybranými.
  - U řádků „smazán v prohlížeči“ je tlačítko „Odstranit ze zálohy“ → `potvrd('Odstranit „X“ ze zálohy?', {ano: 'Odstranit', nebezpecne: true})` → `odstranZeZalohy`.
- Připomínka: `pripominkaZalohy(vse)` použije 30 dní a text z globálních omezení, když `zaloha?.stav().faze === 'ok' && zaloha.stav().ceka === 0`.

- [ ] **Krok 1: Napsat padající testy v prohlížeči**
  - `nový prohlížeč se stejnou zálohou nabídne obnovu a vrátí projekt`:
    - kontext A založí a upraví projekt a čeká na zálohu,
    - kontext B (nový, prázdná IndexedDB) dostane přes `addInitScript` stejná `dokumenty`,
    - v B je vidět `#d-obnova-zalohy` s textem „V automatické záloze je 1 projekt, který v tomto prohlížeči není.“,
    - po „Obnovit ze zálohy“ a potvrzení dialogu je projekt v seznamu se stejným `objekt.nazev`.
  - `smazaný projekt zůstane v záloze a jde odstranit`:
    - po smazání projektu na přehledu ukáže dialog štítek „smazán v prohlížeči“ a upozornění na obnovu se neukáže,
    - po „Odstranit ze zálohy“ a potvrzení nezůstane v `dokumenty` žádná cesta s jeho segmentem.
  - `plné úložiště: hláška na kartě`: `stav.pred` vyhodí `quota_exceeded` a karta obsahuje „Úložiště artefaktu je plné.“
  - `připomínka ruční zálohy při běžící záloze až po 30 dnech`:
    - `localStorage['pp.zaloha']` = před 10 dny a projekt je zazálohovaný → `#d-pripominka` není,
    - před 31 dny → je a obsahuje „Automatická záloha běží.“
- [ ] **Krok 2: Spustit a ověřit, že testy padají**
  Spustit `node --test test/autozaloha.e2e.test.mjs`. Očekává se FAIL v nových testech.
- [ ] **Krok 3: Implementovat** podle rozhraní výše. Dialog staví na `formular` jako `obnovZalohu`.
- [ ] **Krok 4: Spustit testy**
  Spustit `node --test test/autozaloha.e2e.test.mjs`, `npm test` a `npm run test:e2e`. Očekává se PASS.
- [ ] **Krok 5: Commit**
  `git commit -m "Automatická záloha: obnova, dialog zálohy, připomínka ruční zálohy"`

### Úkol 6: Sestavení, dokumentace, publikace a ověření

**Soubory:**
- Upravit test: `test/autozaloha.e2e.test.mjs` (jedna HTML)
- Upravit: `README.md` (oddíl „Automatická záloha“ pod „Záloha všech projektů“)
- Sestavit: `dist/pozarni-planovac.html`, `dist/pozarni-planovac.artifact.html`

- [ ] **Krok 1: Napsat padající test**
  `jednosouborová sestava obsahuje automatickou zálohu`:
  - `node tools/sestav_jeden_soubor.mjs`,
  - otevřít `dist/pozarni-planovac.html` přes `file://` s podstrčeným `falesneUloziste`,
  - po úpravě projektu jsou v `dokumenty` hlavička a části a karta je vidět.
- [ ] **Krok 2: Spustit test**
  Spustit `node --test test/autozaloha.e2e.test.mjs`. Očekává se PASS hned po sestavení. Když neprojde, opravit sestavení, ne test.
- [ ] **Krok 3: README**
  Co se zálohuje a kam, kde to funguje, obnova, smazané projekty, limity a nejistoty ze specifikace, `window.__PP_PRODLEVA_ZALOHY__` jen pro testy.
- [ ] **Krok 4: Celé sady**
  Spustit `npm test` a `npm run test:e2e`. Očekává se jen PASS a v závěrečném hlášení se uvedou počty.
- [ ] **Krok 5: Sestavit a publikovat**
  - Spustit `npm run build`.
  - Zkopírovat `dist/pozarni-planovac.artifact.html` do publikačního souboru a publikovat na https://claude.ai/artifact/NBYXk4Ux1LE5sbfVqSRVAQ se schopnostmi `{sample: {images: true}, downloads: true, db: {}, user: {}}`.
  - Výsledek publikace musí vypsat všechny čtyři schopnosti.
- [ ] **Krok 6: Commit a push**
  `git commit -m "Automatická záloha: sestavení, README, publikace artefaktu"`, potom `git push -u origin claude/zealous-mendel-jf5fin` (rychlé posunutí, bez force).
- [ ] **Krok 7: Ověření po otevření uživatelem**
  - Uživatel otevře artefakt a upraví projekt.
  - Nástrojem ArtifactData (`list`) se ověří, že v úložišti jsou hlavička a části. Zápis se dělá jako uživatel, a pokud platforma soukromou část `data/users/<uid>` nástroji nezpřístupní, řekne se to uživateli a ověří se stav na kartě.
  - Výsledek dostane uživatel jednou větou.

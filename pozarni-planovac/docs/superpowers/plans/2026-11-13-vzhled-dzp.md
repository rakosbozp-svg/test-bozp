# Vzhled DZP podle vzorů – plán implementace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Listy DZP (situace, půdorys, schéma) dostanou vzhled podle vzorů uživatele. Okénka vzoru HZS SČK zůstávají beze změny. Mění se:
- nadpis nad rámem;
- tečkovaná síť s popisky;
- výplně podle významu;
- šipka příjezdu;
- tučný text;
- nadpis legendy.

**Architecture:** Vzhled vzniká jen ve vykreslení SVG (`js/kresleni/render.js`) a v modelu prvků (`js/kresleni/prvky.js`). Export PDF používá stejné SVG.

Nový druh prvku `prijezd` se doplní všude, kde se druhy vyjmenovávají:
- model,
- očista importu,
- vykreslení,
- editor,
- nástroje Clauda.

Výplně podle významu jsou jen předvolby: zapíší do prvku běžné hodnoty `vypln`, `kryti`, `barva` a `tloustka`.

**Tech Stack:**
- vanilla ES moduly;
- `node:test`, Playwright pro e2e;
- esbuild (`tools/sestav_jeden_soubor.mjs`, `tools/sestav_web.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-13-vzhled-dzp-design.md`

## Global Constraints

**Obecně:**
- Cesty a příkazy jsou relativně k `pozarni-planovac/`. Jednotkové testy: `npm test`, e2e: `npm run test:e2e`.
- Žádné nové závislosti. Identifikátory a texty UI jsou česky.
- Evakuační plán (`v.evakPlan`) se nemění. Nemá pás nad rámem, nadpis, popisky sítě, `vyznam` ani `prijezd`.

**Rozvržení a nadpis:**
- `HLAVICKA_MM = 5`.
- Nadpis listu: `#d00000`, tučně, 4,4 mm, účaří 6,2 mm nad rámem, zmenšení nejvýš na 3 mm.

**Síť 10 m:**
- Čáry: `stroke="#333"`, `stroke-opacity` 0.8, šířka 0,2 mm, `stroke-dasharray` 0,25 / 1,05 mm (na papíře).
- Popisky 3 mm tučně:
  - sloupce: účaří 1,3 mm nad rámem, na střed;
  - řádky: zarovnané doprava 1,2 mm vlevo od rámu;
  - „10 m“: 2,2 mm v levém horním rohu vně rámu.
- Popisek dostane jen buňka, jejíž střed je víc než 1 mm od okraje rámu. Buňka musí mít aspoň 4 mm.

**Výplně podle významu (`VYPLNE`)** – klíč: název / výplň / krytí / obrys / tloušťka:
- `zelen`: „Zeleň“ / `#94f993` / 1 / `#555555` / 0.18
- `komunikace`: „Komunikace a zpevněné plochy“ / `#f6f884` / 1 / `#555555` / 0.18
- `objekt`: „Řešený objekt“ / `#c0c0c0` / 1 / `#000000` / 0.7
- `okoli`: „Okolní zástavba“ / `#e3e3e3` / 1 / `#555555` / 0.25
- `voda`: „Vodní plocha“ / `#a6d8ff` / 1 / `#1e5fd0` / 0.18

**Šipka příjezdu (`prijezd`):**
- Model: `{ body: [[x,y],[x,y]], sirka: 6, text: 'směr příjezdu', barva: '#000000' }`, `sirka` v mm na papíře 2–30, vrstva `komunikace`.
- Hrot: šířka 2 × `sirka`, délka 1,35 × `sirka`, nejvýš 45 % délky šipky.
- Text: bílý, tučný, 0,52 × `sirka`, zmenšení nejvýš na 1,8 mm, jinak se nevykreslí.

**Legenda:** nadpis „Legenda pro dokumentaci zdolávání požárů“, `#d00000`, tučně 2,6 mm, podtržený červenou čarou 0,25 mm.

**Postup:**
- Každý `<text>` nese vlastní `font-size` / `font-weight` / `font-family` (převod SVG→PDF nespoléhá na dědění z `<g>`).
- Commity česky, zakončené řádky:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01Vbt7WPEH5HUpsSUu7MeTD8`
- E2E testy přestavují `dist/`. Mimo úkol 7 po nich vrátit `git checkout -- dist/`.

## Review Focus

1. **Starý projekt po aktualizaci:** rám je o 5 mm nižší. `nastav_list` s `prizpusobit: true` musí obsah vrátit celý do nového rámu. Test je v úkolu 1.
2. **Velmi dlouhý název listu (200 znaků):** nadpis nepřeteče šířku rámu ani při 3 mm, zkrátí se výpustkou. Test je v úkolu 1.
3. **Poškozená šipka z cizího souboru** (1 bod, NaN, `sirka` 999, `text` jako číslo): očista ji opraví, neúplná se nevykreslí a list nespadne. Test je v úkolu 4.
4. **Krátká šipka s dlouhým textem:** hrot má nejvýš 45 % délky a text se raději vynechá, než aby přetekl. Test je v úkolu 4.
5. **PDF s tučnou češtinou** v nadpisu a legendě (Č, Á, Í, Ů): text je v PDF čitelný. Test je v úkolu 7.

---

### Task 1: Pás nad rámem, nadpis listu a nadpis legendy

**Files:**
- Modify:
  - `js/kresleni/prvky.js` (`rozlozeniListu`)
  - `js/kresleni/render.js` (`nadpisListu`, `renderListu`, `legenda`)
  - `js/kresleni/editor.js:186` (`mkO`)
  - `js/pdf/export.js:81` (volání `renderListu`)
- Test:
  - `test/render.test.mjs`, `test/ai.test.mjs`
  - úprava řetězce „LEGENDA ZNAČEK“ v `test/render.test.mjs:28`, `test/editor.e2e.test.mjs:197`, `test/editor.e2e.test.mjs:211`, `test/jeden-soubor.e2e.test.mjs:54`, `test/pdf.test.mjs:46`

**Interfaces:**
- Produces:
  - `HLAVICKA_MM` (prvky.js, číslo 5);
  - `nadpisListu({ typDokumentu, nazevListu, typListu }) → string` (render.js);
  - `NADPIS_LEGENDY` (render.js, řetězec);
  - nová volba `o.typDokumentu` funkce `renderListu`.

- [ ] **Step 1: Napiš padající testy v `test/render.test.mjs`** (importuj `nadpisListu`, `NADPIS_LEGENDY` z render.js a `sirkaTextu`):

```js
test('rozvržení DZP: pás 5 mm nad rámem, evakuační plán beze změny', () => {
  const v = novyList('situace').vykres;
  assert.equal(P.HLAVICKA_MM, 5);
  assert.deepEqual(P.rozlozeniListu(v).ram, { x: 10, y: 15, w: 277, h: 161 });
  v.orientace = 'na_vysku'; assert.deepEqual(P.rozlozeniListu(v).ram, { x: 10, y: 15, w: 190, h: 248 });
  assert.deepEqual(P.rozlozeniListu(novyList('evak_plan').vykres).ram, { x: 97, y: 51, w: 313, h: 236 });
});
test('nadpis listu podle druhu dokumentace a názvu listu', () => {
  assert.equal(nadpisListu({ typDokumentu: 'operativni_karta', nazevListu: 'Situace', typListu: 'situace' }), 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – SITUACE –');
  assert.equal(nadpisListu({ typDokumentu: 'operativni_plan', nazevListu: 'Půdorys 1.NP', typListu: 'pudorys' }), 'GRAFICKÁ ČÁST OPERATIVNÍHO PLÁNU – PŮDORYS 1.NP –');
  assert.equal(nadpisListu({ nazevListu: '  ', typListu: 'schema' }), 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – SCHÉMA –');
});
test('render: červený nadpis nad rámem (dlouhý se zmenší a zkrátí), nový nadpis legendy, evakuační plán bez nadpisu', () => {
  const nad = (svg) => /<text data-nadpis="1" x="148\.5" y="8\.8" font-size="([\d.]+)" font-weight="700" fill="#d00000"[^>]*>([^<]*)<\/text>/.exec(svg);
  const m = nad(renderListu(ukazka(), o({ typDokumentu: 'operativni_karta' })));
  assert.ok(m); assert.equal(m[1], '4.4'); assert.equal(m[2], 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – PŮDORYS 1.NP –');
  const d = nad(renderListu(ukazka(), o({ nazevListu: 'X'.repeat(200) })));
  assert.equal(d[1], '3'); assert.ok(d[2].endsWith('…')); assert.ok(sirkaTextu(d[2], 3, true) <= 277);
  const svg = renderListu(ukazka(), o());
  assert.ok(svg.includes(NADPIS_LEGENDY) && !svg.includes('LEGENDA ZNAČEK'));
  assert.equal(NADPIS_LEGENDY, 'Legenda pro dokumentaci zdolávání požárů');
});
```

Do `test/ai.test.mjs` (Review Focus 1):

```js
test('přizpůsobit vrátí obsah celý do nižšího rámu DZP', () => {
  const k = kontext('situace');
  A.provedNastroj('kresli', { prvky: [{ druh: 'plocha', body: [[0, 0], [120, 0], [120, 95], [0, 95]] }] }, k);
  A.provedNastroj('nastav_list', { prizpusobit: true }, k);
  const R = A.ramSvet(k.v);
  assert.ok(R.x0 <= 0 && R.y0 <= 0 && R.x1 >= 120 && R.y1 >= 95);
});
```

V evakuačním testu v `test/evak.test.mjs` (nebo novém testu v `render.test.mjs`) ověř, že `renderListu` listu `evak_plan` neobsahuje `data-nadpis`.

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/render.test.mjs test/ai.test.mjs`
Expected: FAIL. `HLAVICKA_MM` je `undefined`, `nadpisListu is not a function`.

- [ ] **Step 3: Implementuj**

V `prvky.js`:
- `export const HLAVICKA_MM = 5;`
- větev DZP v `rozlozeniListu`: `ram: { x: M, y: M + HLAVICKA_MM, w: W - 2 * M, h: H - 2 * M - R - HLAVICKA_MM }`.

V `render.js`:
- `export const NADPIS_LEGENDY = 'Legenda pro dokumentaci zdolávání požárů'`.
- `export function nadpisListu({ typDokumentu, nazevListu, typListu })`: název listu je `String(nazevListu ?? '').trim()`, prázdný nahradí `TYP_LISTU[typListu]`, převede se `toLocaleUpperCase('cs')`. `operativni_plan` dává „OPERATIVNÍHO PLÁNU“, cokoli jiného „OPERATIVNÍ KARTY“.
- V `renderListu` (jen DZP, za rámečkem rámu) přidej nadpis přesně v tomto formátu:

  `<text data-nadpis="1" x="{W/2}" y="{ram.y − 6.2}" font-size="{vel}" font-weight="700" fill="#d00000" text-anchor="middle" font-family="Arial,sans-serif">{text}</text>`

  - `vel = min(4.4, max(3, ram.w / sirkaTextu(t, 1, true)))`;
  - když `sirkaTextu(t, 3, true) > ram.w`, text zkrátí existující `vypustka(t, ram.w, 3, true)`.
- Nadpis legendy nahraď:

  `<text x="2" y="5" font-size="2.6" font-weight="700" font-family="Arial,sans-serif" fill="#d00000">{NADPIS_LEGENDY}</text><line x1="2" y1="6.1" x2="{2 + sirkaTextu(NADPIS_LEGENDY, 2.6, true)}" y2="6.1" stroke="#d00000" stroke-width="0.25"/>`

V `editor.js` `mkO` a v `pdf/export.js` doplň do voleb `typDokumentu: projekt.typ`.

Nahraď „LEGENDA ZNAČEK“ za `Legenda pro dokumentaci zdolávání požárů` v testech vyjmenovaných výše.

- [ ] **Step 4: Spusť testy**

Run: `node --test test/render.test.mjs test/ai.test.mjs test/pdf.test.mjs test/opravy-editor.test.mjs && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add js/kresleni/prvky.js js/kresleni/render.js js/kresleni/editor.js js/pdf/export.js test/` a commit „Nadpis listu DZP nad rámem a nový nadpis legendy“.

### Task 2: Síť 10 m – tečkovaná, s popisky sloupců a řádků

**Files:**
- Modify: `js/kresleni/render.js` (síť v `renderListu`, nové `popiskySite`, `jmenoSloupce`)
- Test: `test/render.test.mjs`

**Interfaces:**
- Consumes: `rozlozeniListu` s pásem z úkolu 1.
- Produces:
  - `jmenoSloupce(i: number) → string` (0 → „A“, 25 → „Z“, 26 → „AA“);
  - `popiskySite(v) → { sloupce: [{ x, text }], radky: [{ y, text }] } | null` (mm na papíře).

- [ ] **Step 1: Napiš padající testy**

```js
test('popisky sítě: písmena nad rámem, čísla vlevo, krajní poloviny bez popisku', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500; v.okno = { x: 0, y: 0 };
  const p = popiskySite(v);
  assert.deepEqual(p.sloupce.map((s) => s.text), [...'ABCDEFGHIJKLMN']);
  assert.equal(p.sloupce[0].x, 20); assert.equal(p.radky.length, 8); assert.equal(p.radky[0].y, 25); assert.equal(p.radky[7].text, '8');
  v.okno = { x: -5, y: -5 }; const q = popiskySite(v);
  assert.equal(q.sloupce[0].text, 'A'); assert.equal(q.sloupce[0].x, 30); assert.equal(q.radky[0].y, 35);
});
test('popisky sítě: AA za Z, nic bez sítě, v evakuačním plánu ani při buňce pod 4 mm', () => {
  assert.deepEqual([0, 25, 26, 27].map(jmenoSloupce), ['A', 'Z', 'AA', 'AB']);
  const v = novyList('situace').vykres; v.meritko.pomer = 1000; v.okno = { x: 0, y: 0 };
  assert.equal(popiskySite(v).sloupce.at(-1).text, 'AB');
  v.meritko.pomer = 2500; assert.ok(popiskySite(v));
  v.meritko.pomer = 5000; assert.equal(popiskySite(v), null);
  v.meritko.pomer = 500; v.sit10m = false; assert.equal(popiskySite(v), null);
  assert.equal(popiskySite(novyList('evak_plan').vykres), null);
});
test('render: síť je tečkovaná, popisky leží mimo rám, „10 m“ v rohu', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500;
  const svg = renderListu(v, o());
  assert.ok(svg.includes('stroke-dasharray="0.125,0.525"') && svg.includes('data-popis-site="1"') && svg.includes('>10 m</text>'));
});
```

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/render.test.mjs`
Expected: FAIL. `popiskySite is not a function`.

- [ ] **Step 3: Implementuj v `render.js`**

- `jmenoSloupce` používá bijektivní základ 26.
- `popiskySite(v)`:
  - vrátí `null` pro `v.evakPlan`, pro `!v.sit10m` a pro `10 * s < 4` (`s = 1000 / pomer`);
  - sloupce jdou od `Math.floor(okno.x / 10) * 10` po 10 m, střed buňky převedený na papír je `ox + (x + 5) * s`;
  - popisek dostane jen střed v intervalu `(ram.x + 1, ram.x + ram.w − 1)`, písmena se číslují od A;
  - řádky se počítají stejně od `ram.y` a číslují od 1;
  - souřadnice zaokrouhli na 3 desetinná místa (`f`).
- Síť (`grid`):
  - `stroke="#333" stroke-opacity=".8" stroke-width="{k(0.2)}" stroke-dasharray="{k(0.25)},{k(1.05)}"`;
  - atribut `data-sit="1"` zůstává.
- Popisky vykresli za rámečkem rámu (mimo ořez) do `<g data-popis-site="1">`:
  - sloupce: `y = ram.y − 1.3`, `text-anchor="middle"`;
  - řádky: `x = ram.x − 1.2`, `y = střed + 1.05`, `text-anchor="end"`;
  - každý text `font-size="3" font-weight="700" font-family="Arial,sans-serif"`;
  - „10 m“: `x = ram.x − 1.2`, `y = ram.y − 1.3`, `font-size="2.2"`, `text-anchor="end"`.

- [ ] **Step 4: Spusť testy**

Run: `node --test test/render.test.mjs && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit „Tečkovaná síť 10 m s písmeny a čísly mimo rám“.

### Task 3: Tučný text a výplně podle významu (model, očista, vykreslení)

**Files:**
- Modify:
  - `js/kresleni/prvky.js` (`VYPLNE`, `vyznamVyplne`, `pouzijVyznam`)
  - `js/kresleni/render.js` (`case 'text'`)
  - `js/ocista.js` (`prvek`)
- Test: `test/prvky.test.mjs`, `test/render.test.mjs`, `test/model.test.mjs`

**Interfaces:**
- Produces:
  - `VYPLNE: Record<'zelen'|'komunikace'|'objekt'|'okoli'|'voda', { nazev, vypln, kryti, barva, tloustka }>`;
  - `vyznamVyplne(p) → klíč | null`;
  - `pouzijVyznam(p, klic) → p` (zapíše 4 hodnoty; neznámý klíč → `Error('Neznámý význam výplně: …')`);
  - textový prvek s nepovinným `tucne: boolean`.

- [ ] **Step 1: Napiš padající testy**

```js
// test/prvky.test.mjs
test('výplně podle významu: hodnoty ze vzorů, zápis do prvku a rozpoznání', () => {
  assert.deepEqual(Object.keys(P.VYPLNE), ['zelen', 'komunikace', 'objekt', 'okoli', 'voda']);
  assert.deepEqual(P.VYPLNE.objekt, { nazev: 'Řešený objekt', vypln: '#c0c0c0', kryti: 1, barva: '#000000', tloustka: 0.7 });
  const p = P.pouzijVyznam(P.novyPrvek('plocha', { body: [[0, 0], [1, 0], [1, 1]] }), 'okoli');
  assert.deepEqual([p.vypln, p.kryti, p.barva, p.tloustka], ['#e3e3e3', 1, '#555555', 0.25]);
  assert.equal(P.vyznamVyplne(p), 'okoli'); assert.equal(P.vyznamVyplne({ ...p, vypln: '#E3E3E3' }), 'okoli');
  assert.equal(P.vyznamVyplne({ ...p, vypln: '#123456' }), null); assert.equal(P.vyznamVyplne({ druh: 'text' }), null);
  assert.throws(() => P.pouzijVyznam(p, 'les'), /Neznámý význam výplně/);
});
// test/render.test.mjs
test('tučný text se vykreslí tučně', () => {
  const v = novyList('situace').vykres; v.prvky.push(P.novyPrvek('text', { x: 1, y: 1, text: 'ul. Tyršova', tucne: true, vrstva: 'popisky' }));
  assert.match(renderListu(v, o()), /data-druh="text"[^>]*font-weight="700"/);
});
// test/model.test.mjs
test('očista: tucne jiné než boolean je false', () => {
  const pr = M.novyProjekt(); M.pridejList(pr, 'situace');
  pr.listy.at(-1).vykres.prvky.push({ id: 'e_t1', druh: 'text', vrstva: 'popisky', x: 1, y: 1, text: 'A', vyska: 3, tucne: 'ano' });
  assert.equal(M.nactiProjekt(JSON.stringify(pr)).listy.at(-1).vykres.prvky[0].tucne, false);
});
```

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/prvky.test.mjs test/render.test.mjs test/model.test.mjs`
Expected: FAIL. `VYPLNE` je `undefined`.

- [ ] **Step 3: Implementuj**

- `VYPLNE` s hodnotami z Global Constraints, v uvedeném pořadí klíčů.
- `vyznamVyplne` porovnává `vypln` bez ohledu na velikost písmen, jen u druhů `plocha`, `obdelnik` a `elipsa`.
- Text: `${p.tucne === true ? ' font-weight="700"' : ''}` před `fill`.
- Očista: `ano(p, 'tucne', false)`.

- [ ] **Step 4: Spusť testy**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit „Výplně podle významu a tučný text v modelu“.

### Task 4: Šipka příjezdu – model, vykreslení, očista

**Files:**
- Modify:
  - `js/kresleni/prvky.js` (`DRUHY`, `VYCHOZI.prijezd`, `geometriePrijezdu`, `bboxPrvku`, `zasah`)
  - `js/kresleni/render.js` (`case 'prijezd'`)
  - `js/ocista.js`
- Test: `test/prvky.test.mjs`, `test/render.test.mjs`, `test/model.test.mjs`

**Interfaces:**
- Consumes: `sirkaTextu` z render.js. Funkci přesuň do `prvky.js` a z render.js ji jen reexportuj, ať nevznikne kruhový import.
- Produces:
  - druh `prijezd` (výchozí hodnoty viz Global Constraints);
  - `geometriePrijezdu(p, pomer) → { obrys: [[x,y]×7], text: { cx, cy, uhel, vel } | null } | null` (svět v m; `cx, cy` = střed dříku, `vel` v mm na papíře).

  Pořadí obrysu: `[a+n·w/2, b′+n·w/2, b′+n·hw, b, b′−n·hw, b′−n·w/2, a−n·w/2]`, kde:
  - `u` je jednotkový směr a→b, `n = (−u.y, u.x)`;
  - `w = mmNaM(sirka)`, `hw = w`, `hl = min(1,35·w, 0,45·délka)`, `b′ = b − u·hl`.

- [ ] **Step 1: Napiš padající testy**

```js
// test/prvky.test.mjs
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
test('příjezd: hrot 2× šířka, délka 1,35× šířka a nejvýš 45 % délky; obrys a zásah', () => {
  const p = P.novyPrvek('prijezd', { body: [[0, 20], [0, 0]] });
  assert.deepEqual([p.sirka, p.text, p.barva], [6, 'směr příjezdu', '#000000']);
  const g = P.geometriePrijezdu(p, 500);
  assert.equal(g.obrys.length, 7); close(g.obrys[3][0], 0); close(g.obrys[3][1], 0);
  close(g.obrys[2][0] - g.obrys[4][0], 6); close(g.obrys[2][1], 4.05);
  close(P.geometriePrijezdu(P.novyPrvek('prijezd', { body: [[0, 4], [0, 0]] }), 500).obrys[2][1], 1.8);
  const b = P.bboxPrvku(p, 500); close(b.x0, -3); close(b.x1, 3); close(b.y0, 0); close(b.y1, 20);
  assert.ok(P.zasah(p, [0, 10], 0.1, 500)); assert.ok(!P.zasah(p, [5, 10], 0.1, 500));
});
test('příjezd: text čitelně podél šipky, zmenší se, krátká šipka bez textu', () => {
  const g = (body, text) => P.geometriePrijezdu(P.novyPrvek('prijezd', { body, ...(text ? { text } : {}) }), 500);
  close(g([[0, 20], [0, 0]]).text.uhel, -90); close(g([[0, 0], [0, 20]]).text.uhel, -90);
  close(g([[20, 0], [0, 0]]).text.uhel, 0); close(g([[0, 0], [20, 0]]).text.uhel, 0);
  assert.equal(g([[0, 20], [0, 0]]).text.vel, 3.12);
  const t = g([[0, 15], [0, 0]]).text; assert.ok(t.vel < 3.12 && t.vel >= 1.8);
  assert.equal(g([[0, 4], [0, 0]], 'příjezd jednotek HZS ze severu').text, null);
});
// test/render.test.mjs
test('render příjezdu: černý mnohoúhelník a bílý tučný text; poškozená šipka se nevykreslí', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500;
  v.prvky.push(P.novyPrvek('prijezd', { body: [[0, 20], [0, 0]], vrstva: 'komunikace' }), P.novyPrvek('prijezd', { body: [[0, 0]], vrstva: 'komunikace' }));
  const svg = renderListu(v, o());
  assert.match(svg, /data-druh="prijezd"><polygon points="[^"]+" fill="#000000"\/><text [^>]*font-weight="700" fill="#fff"[^>]*>směr příjezdu<\/text>/);
  assert.equal((svg.match(/data-druh="prijezd"/g) || []).length, 1);
});
// test/model.test.mjs (Review Focus 3)
test('očista: šipka příjezdu z cizího souboru – šířka do mezí, text na řetězec, neúplná nespadne', () => {
  const pr = M.novyProjekt(); M.pridejList(pr, 'situace');
  pr.listy.at(-1).vykres.prvky.push({ id: 'e_p1', druh: 'prijezd', vrstva: 'komunikace', body: [[0, 0], [0, 9]], sirka: 999, text: 5 }, { id: 'e_p2', druh: 'prijezd', vrstva: 'komunikace', body: [[0, 0], [Number.NaN, 1]], sirka: 'x' });
  const [a, b] = M.nactiProjekt(JSON.stringify(pr)).listy.at(-1).vykres.prvky;
  assert.equal(a.sirka, 30); assert.equal(a.text, '5'); assert.equal(b.sirka, 6); assert.equal(b.body.length, 1);
});
```

V řádku `close(... .text.uhel, -90)` pro šipku dolů: úhel 90° se otočí na −90°, svislý text se tedy čte zdola nahoru.

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/prvky.test.mjs test/render.test.mjs test/model.test.mjs`
Expected: FAIL. „Neznámý druh prvku: prijezd“.

- [ ] **Step 3: Implementuj**

**`prvky.js`:**
- Přidej `'prijezd'` do `DRUHY` a `VYCHOZI.prijezd = { sirka: 6, text: 'směr příjezdu', barva: '#000000' }`.
- `geometriePrijezdu` vrátí `null`, když `body` nemá právě 2 konečné body nebo když je délka 0.
- **Úhel textu:** `deg(atan2(dy, dx))`; když je `> 89.99` nebo `< −90.01`, přičti 180. Když po normalizaci vyjde `> 180`, odečti 360.
- **Velikost textu:**
  - `vel0 = 0,52·sirka`;
  - délka dříku v mm je `(délka − hl)·1000/pomer`;
  - `vel = min(vel0, vel0 · 0,9 · dřík / sirkaTextu(text, vel0, true))`, zaokrouhli na 2 desetinná místa;
  - když `vel < 1,8` nebo je text prázdný, `text = null`.
- **Poloha textu:** `cx, cy = (a + b′)/2` (střed dříku). Vykreslení dá `x = cx`, `y = cy + mmNaM(0,36·vel)` a `transform="rotate(uhel cx cy)"`, takže je text vycentrovaný na dříku.
- `bboxPrvku`: `bbox(obrys)`.
- `zasah`: `bodVPolygonu(bod, obrys)` nebo vzdálenost k obrysu ≤ `tol`.
- Funkce `posunPrvek`, `otocPrvek` a `meritkujPrvek` už `body` zvládnou.

**`render.js`:** `<g data-id="…" data-druh="prijezd"><polygon points="…" fill="{barva}"/><text x y font-size="{mmNaM(vel)}" font-family="Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle" transform="rotate({uhel} {cx} {cy})">{esc(text)}</text></g>`. Pro `null` vrať `''`.

**`ocista.js`:** `if (p.druh === 'prijezd') cislo(p, 'sirka', 6, 2, 30);`. Text a body už pokrývá stávající očista.

- [ ] **Step 4: Spusť testy**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit „Šipka směru příjezdu (druh prijezd) v modelu a vykreslení“.

### Task 5: Claude – `prijezd`, `vyznam`, `tucne` a pokyny „Styl DZP“

**Files:**
- Modify: `js/ai/nastroje.js`
- Test: `test/ai.test.mjs`

**Interfaces:**
- Consumes: `P.VYPLNE`, `P.pouzijVyznam`, `P.vyznamVyplne`, druh `prijezd` a `P.geometriePrijezdu` (úkoly 3 a 4).
- Produces:
  - `kresli` / `uprav` přijímají `vyznam` (plocha, obdelnik, elipsa), `tucne` (text) a `prijezd` s klíči `body`, `text`, `sirka_mm`, `barva`;
  - `popisPrvku` vrací `vyznam`, `tucne` a pro `prijezd` `{ body, text, sirka_mm }`.

- [ ] **Step 1: Napiš padající testy**

```js
test('kresli DZP: vyznam nastaví výplň, krytí, obrys a tloušťku; výslovné hodnoty mají přednost; neznámý je chyba', () => {
  const k = kontext('situace');
  const r = A.provedNastroj('kresli', { prvky: [
    { druh: 'plocha', body: [[0, 0], [5, 0], [5, 5]], vyznam: 'Řešený objekt' },
    { druh: 'obdelnik', x: 0, y: 0, w: 2, h: 2, vyznam: 'zeleň', tloustka_mm: 0.5 },
    { druh: 'plocha', body: [[0, 0], [5, 0], [5, 5]], vyznam: 'les' },
  ] }, k);
  const [a, b] = r.vysledek.id.map((id) => P.najdi(k.v.prvky, id));
  assert.deepEqual([a.vypln, a.kryti, a.barva, a.tloustka], ['#c0c0c0', 1, '#000000', 0.7]);
  assert.deepEqual([b.vypln, b.tloustka], ['#94f993', 0.5]);
  assert.match(JSON.stringify(r.vysledek.chyby), /zelen, komunikace, objekt, okoli, voda/);
});
test('kresli DZP: šipka příjezdu se 2 body, výchozím textem a šířkou; jiný počet bodů je chyba; evakuační plán ji odmítne', () => {
  const k = kontext('situace');
  const r = A.provedNastroj('kresli', { prvky: [{ druh: 'prijezd', body: [[0, 30], [0, 5]] }, { druh: 'prijezd', body: [[0, 0], [1, 1], [2, 2]] }, { druh: 'prijezd', body: [[9, 9], [9, 1]], text: 'příjezd HZS', sirka_mm: 99 }] }, k);
  const [p, q] = r.vysledek.id.map((id) => P.najdi(k.v.prvky, id));
  assert.deepEqual([p.sirka, p.text, p.vrstva], [6, 'směr příjezdu', 'komunikace']);
  assert.deepEqual([q.sirka, q.text], [30, 'příjezd HZS']);
  assert.match(JSON.stringify(r.vysledek.chyby), /právě 2 body/);
  const e = kontext('evak_plan');
  assert.match(JSON.stringify(A.provedNastroj('kresli', { prvky: [{ druh: 'prijezd', body: [[0, 1], [0, 0]] }, { druh: 'obdelnik', x: 0, y: 0, w: 1, h: 1, vyznam: 'zelen' }, { druh: 'text', x: 1, y: 1, text: 'A' }] }, e).vysledek), /evakuační/);
});
test('uprav: tucne, text a šířka šipky, vyznam; popis prvků je vrací', () => {
  const k = kontext('situace');
  const r = A.provedNastroj('kresli', { prvky: [{ druh: 'text', x: 1, y: 1, text: 'ul. Tyršova' }, { druh: 'prijezd', body: [[0, 30], [0, 5]] }, { druh: 'obdelnik', x: 0, y: 0, w: 2, h: 2 }] }, k);
  const [t, s, o2] = r.vysledek.id;
  A.provedNastroj('uprav', { zmeny: [{ id: t, tucne: true }, { id: s, text: 'příjezd HZS', sirka_mm: 8 }, { id: o2, vyznam: 'okoli' }] }, k);
  const popis = k.v.prvky.map((p) => A.popisPrvku(p, k));
  assert.equal(popis[0].tucne, true); assert.deepEqual([popis[1].text, popis[1].sirka_mm], ['příjezd HZS', 8]); assert.equal(popis[2].vyznam, 'okoli');
});
test('pokyny: odstavec STYL DZP jen u DZP', () => {
  assert.match(A.pokyny(kontext('situace')), /STYL DZP/); assert.match(A.pokyny(kontext('situace')), /prijezd/);
  assert.doesNotMatch(A.pokyny(kontext('evak_plan')), /prijezd|STYL DZP/);
});
```

Stávající test limitů („definice nástrojů a pokyny dodrží limity platformy“) musí dál projít.

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/ai.test.mjs`
Expected: FAIL. „neznámý druh „prijezd““.

- [ ] **Step 3: Implementuj v `nastroje.js`**

**Druhy a klíče:**
- `DRUHY_AI` += `'prijezd'`, `VYCHOZI_VRSTVA.prijezd = 'komunikace'`.
- `KLICE`:
  - plocha, obdelnik a elipsa += `'vyznam'`;
  - text += `'tucne'`;
  - `prijezd: ['body', 'text', 'sirka_mm', 'barva']`.

**Odmítnutí v evakuačním plánu:** `k.evak` a `prijezd` nebo `vyznam` → `Chyba('… do evakuačního plánu nepatří')`.

**Význam (`vyznamZ(hodnota, co) → klíč`):**
- Normalizace: `bezDiakritiky`, malá písmena, mezery na `_`.
- Přezdívky: `reseny_objekt`/`objekt` → objekt, `okolni`/`okolni_zastavba` → okoli, `vodni_plocha` → voda, `ulice` → komunikace.
- Neznámý → `Chyba` se seznamem `zelen, komunikace, objekt, okoli, voda`.
- V `kresli` doplní předvolba jen hodnoty, které v zadání nejsou (`vypln`, `kryti`, `barva`, `tloustka_mm`). V `uprav` stejně: výslovné hodnoty téže změny mají přednost.

**Šipka příjezdu:**
- `body(s.body, co, 2)` a navíc kontrola `length === 2` → jinak `Chyba('… šipka příjezdu má právě 2 body: odkud a kam (hrot)')`.
- `sirka` z `sirka_mm`, oříznutá do 2–30 stejně jako ostatní čísla (ořezání se hlásí upozorněním).
- `text` je volitelný.

**Úpravy (`uprav`):** `tucne` (ano/ne), `text`, `sirka_mm`, `vyznam`. Nové `body` u `prijezd` musí mít právě 2 body.

**Popis prvků (`popisPrvku`):**
- `vyznam` (když `vyznamVyplne` něco vrátí);
- `tucne: true`;
- pro `prijezd` `{ body, text, sirka_mm }`.

**Schéma `kresli` / `uprav`:**
- `vyznam: { type: 'string', enum: Object.keys(P.VYPLNE) }` (jen DZP);
- `tucne: { type: 'boolean' }`, `sirka_mm: N`;
- `druh` v DZP obsahuje `prijezd`.

**Pokyny (jen DZP):**
- V PRVKY přibude řádek o `prijezd`, u ploch, obdélníků a elips `vyznam`, u textu `tucne`.
- Nový odstavec `STYL DZP:` se zněním ze specifikace §8 (řešený objekt `objekt`, okolní stavby `okoli`, ulice a zpevněné plochy `komunikace`, zeleň `zelen`; názvy ulic a objektu tučně; příjezd hasičů šipkou `prijezd` hrotem k objektu nebo vstupu; hlavní vchod DZP-105; nic nedomýšlet).

- [ ] **Step 4: Spusť testy**

Run: `node --test test/ai.test.mjs && npm test`
Expected: PASS, včetně testu limitů.

- [ ] **Step 5: Commit**

Commit „Claude kreslí šipky příjezdu, výplně podle významu a tučný text“.

### Task 6: Editor – nástroj Směr příjezdu, Výplň podle významu, Tučně

**Files:**
- Modify:
  - `js/kresleni/editor.js` (`NASTROJE`, `IK`, `VYCHOZI_VRSTVA`, `BEZ_V_EVAK`, skupina nástrojů na ř. 67, klikání lomených ř. ~336, úchyty ř. ~240)
  - `js/kresleni/panel-vykres.js`
  - `js/ikony.js` (ikona `prijezd`)
  - `css/*.css` (styl tlačítek výplně; soubor podle `grep -l "barvy-vyber" css/`)
- Test: `test/editor.e2e.test.mjs`

**Interfaces:** Consumes `P.VYPLNE`, `P.pouzijVyznam`, `P.vyznamVyplne` a druh `prijezd` (úkoly 3 a 4).

- [ ] **Step 1: Napiš padající e2e test** (`test/editor.e2e.test.mjs`)

```js
test('styl DZP: nástroj Směr příjezdu (2 kliknutí), výplň podle významu a tučný text', skip, async () => {
  const p = await nova();
  await p.nastroj('prijezd'); await p.klik(5, 20); await p.klik(5, 5);
  assert.equal(await p.pocet('prijezd'), 1, 'dokončeno druhým kliknutím bez Enter');
  assert.match(await p.locator('#svet [data-druh=prijezd] text').textContent(), /směr příjezdu/);
  await p.nastroj('obdelnik'); await p.tahni([10, 5], [16, 9]);
  await p.click('[data-vyznam=objekt]'); await p.klid();
  assert.match(await p.locator('#svet [data-druh=obdelnik]').evaluate((e) => e.outerHTML), /fill="#c0c0c0"/);
  assert.equal(await p.locator('[data-vyznam=objekt].akt').count(), 1);
  await p.nastroj('text'); await p.klik(2, 2); await p.dlg('ul. Tyršova');
  await p.getByLabel('Tučně').check(); await p.klid();
  assert.match(await p.locator('#svet [data-druh=text]').evaluate((e) => e.outerHTML), /font-weight="700"/);
  assert.deepEqual(p.chyby, []);
});
```

Ve stejném testu ověř i evakuační plán: nový projekt v režimu evakuačního plánu (přepínač na úvodní stránce jako v `test/pozadi.e2e.test.mjs`), list podlaží a `assert.equal(await p.locator('[data-nastroj=prijezd]').count(), 0)`.

- [ ] **Step 2: Spusť testy a ověř, že padají**

Run: `node --test test/editor.e2e.test.mjs`
Expected: FAIL. Selektor `[data-nastroj=prijezd]` nenalezen.

- [ ] **Step 3: Implementuj**

**Nástroj:**
- `['prijezd', 'Směr příjezdu', 'Šipka směru příjezdu hasičů: klik = odkud, druhý klik = kam (hrot)']` za `plocha`.
- `IK.prijezd = 'prijezd'`, ikona šipky v `ikony.js`.
- `VYCHOZI_VRSTVA.prijezd = 'komunikace'`, `BEZ_V_EVAK` += `'prijezd'`, nástroj patří do skupiny kreslicích nástrojů.

**Kreslení:** `'prijezd'` patří mezi lomené nástroje. Po přidání 2. bodu se volá `dokonciKresleni()`.

**Úchyty:** vrcholové úchyty jako u lomených prvků, ale bez úchytů pro vložení bodu (jako `volna`).

**Panel `prijezd`:** pole Text (input), `num('Šířka šipky (mm na papíře)', 'sirka')` a barva.

**Panel plochy, obdélníku a elipsy (jen DZP):**
- řádek „Výplň podle významu“: `<button type="button" data-vyznam="{klíč}" class="{akt?}">` se vzorkem barvy a názvem;
- klik zavolá `P.pouzijVyznam(p, klíč)` a `ed.commit()`.

**Panel textu:** `zaskrt('Tučně', p.tucne === true, c((x) => { p.tucne = x; }))`. Label musí obsahovat input, aby fungoval `getByLabel`.

- [ ] **Step 4: Spusť testy**

Run: `node --test test/editor.e2e.test.mjs && npm test && git checkout -- dist/`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit „Editor: nástroj Směr příjezdu, výplň podle významu, tučný text“.

### Task 7: Sestavení, PDF, README, publikace

**Files:**
- Modify: `README.md` (oddíl o vzhledu DZP), `dist/*` (sestavení)
- Test: `test/pdf.test.mjs`

**Interfaces:** Consumes vše z úkolů 1–6.

- [ ] **Step 1: Napiš padající test PDF** (Review Focus 5)

V `test/pdf.test.mjs` přidej k řetězcům, které musí být v exportovaném PDF:
- `'GRAFICKÁ ČÁST OPERATIVNÍ KARTY'`
- `'Legenda pro dokumentaci zdolávání požárů'`
- `'směr příjezdu'`

Do ukázkového projektu testu přidej šipku `prijezd` a tučný text `'ČÁST ÚŘADU'`.

- [ ] **Step 2: Spusť test**

Run: `node --test test/pdf.test.mjs`
Expected: FAIL, dokud ukázkový projekt šipku nemá. Po doplnění PASS. Když PDF tučnou češtinu neobsahuje, oprav výběr tučného řezu v `js/pdf/svg2pdf.js`.

- [ ] **Step 3: Sestav a ověř**

Run:
```bash
npm run build && npm run build:web && npm test && npm run test:e2e
```
Expected: všechno PASS. Kdyby flaky test `ai.e2e` „kreslení podle zadání s fotkou“ selhal, spusť ho samostatně 3×.

- [ ] **Step 4: Snímek a README**

- Vyrender list situace s ukázkou nového vzhledu (Playwright, `deviceScaleFactor: 1`) a vizuálně ho zkontroluj.
- Do README doplň krátký oddíl „Vzhled DZP“: nadpis, síť s popisky, výplně podle významu, směr příjezdu, tučný text.

- [ ] **Step 5: Commit, push a publikace artefaktu**

- Commit „Sestavení: nový vzhled DZP“.
- `git push -u origin claude/zealous-mendel-jf5fin`.
- Publikace artefaktu „Požární plánovač“ z `dist/pozarni-planovac.artifact.html` (stejná URL jako dřív).

# Automatická záloha projektů v artefaktu na claude.ai – návrh

Datum: 2026-11-04 · Stav: návrh schválený uživatelem v chatu (varianta „záloha přímo v artefaktu“), čeká na schválení této specifikace.

## Cíl

Projekty se zálohují samy, bez ručního stahování. Záloha přežije vymazání dat prohlížeče a jde z ní obnovit na jiném počítači jedním kliknutím. Ruční záloha souborem („Zálohovat všechny projekty“) zůstává jako občasná kopie mimo claude.ai.

## Výchozí stav

- Projekty jsou jen v prohlížeči (`js/ulozeni.js`: IndexedDB, záložně localStorage). Záznam projektu je `{id, nazev, typ, zmeneno, text}` a `text` je serializovaný projekt včetně podkladů (data URI), takže může mít jednotky MB.
- Ruční záloha: `stahniZalohu()` stáhne soubor formátu `pozarni-planovac-zaloha` a obnova jde přes „Importovat projekt“ → `obnovZalohu(z)` v `js/app.js`, kde je dialog „jen chybějící / vše jako kopie“.
- Připomínka ruční zálohy (`pripominkaZalohy`) se ukáže, když je poslední ruční záloha starší než 7 dní a od té doby se něco změnilo.
- Artefakt „Požární plánovač“ (https://claude.ai/artifact/NBYXk4Ux1LE5sbfVqSRVAQ) má schopnosti `sample` (s obrázky) a `downloads`.

## Rozsah

V rozsahu:
- automatické zálohování každého projektu do soukromého úložiště artefaktu (schopnosti `db` a `user`),
- stav zálohy na úvodní stránce, dialog „Automatická záloha“, nabídka obnovy,
- zachování smazaných projektů v záloze až do ručního odstranění,
- úprava připomínky ruční zálohy.

Mimo rozsah:
- Google Disk a jiná úložiště mimo claude.ai,
- historie verzí (v záloze je vždy jen poslední verze každého projektu),
- synchronizace mezi počítači v reálném čase (obnova jen na vyžádání),
- webová verze na Vercelu a soubor otevřený z disku (tam zůstává jen ruční záloha).

## Chování pro uživatele

### Karta „Automatická záloha“ na úvodní stránce
Je mezi dlaždicemi (vedle „Zálohovat všechny projekty“) a v obou režimech (DZP i evakuační plány) ukazuje celou zálohu. Stavy:
- **připojuje se**: „Připojuji úložiště artefaktu…“, nejdéle 10 s,
- **v pořádku**: „Zálohováno: 12 projektů · naposledy před 2 min“. Počet jsou hlavičky bez `smazano`, a když nějaké smazané jsou, přidá se „(+ 2 smazané)“. Čas je nejnovější `zalohovano` ze všech hlaviček,
- **probíhá**: „Zálohuji 2 z 5…“,
- **chyba**: srozumitelný důvod a kód (viz Chyby a limity) a „Zkusí se znovu při další změně“,
- **nedostupná** (mimo claude.ai, odhlášený uživatel, odepřené úložiště): karta se nezobrazí. Na webu a v souboru z disku tedy úvodní stránka vypadá jako dnes.

Odkaz karty „Zobrazit zálohu“ otevře dialog „Automatická záloha“.

### Dialog „Automatická záloha“
- Seznam projektů v záloze: název, druh, kdy byl zálohován, a štítek „není v tomto prohlížeči“, „smazán v prohlížeči“ nebo „v záloze novější“ (záloha má novější `zmeneno` než prohlížeč).
- **Obnovit**: vybrané projekty předá stávajícímu dialogu obnovy `obnovZalohu(z)`, takže se zachová volba „jen chybějící / vše jako kopie“.
- **Odstranit ze zálohy**: jen u projektů „smazán v prohlížeči“, po potvrzení. Smaže hlavičku i všechny části.

### Nabídka obnovy
Když záloha obsahuje projekty, které v prohlížeči nejsou a nejsou označené jako smazané (nový počítač, vymazaná data), ukáže se nahoře na úvodní stránce upozornění: „V automatické záloze je N projektů, které v tomto prohlížeči nejsou. [Obnovit ze zálohy]“. Tlačítko otevře dialog obnovy s těmito projekty.

### Smazaný projekt
Smazání v prohlížeči projekt ze zálohy neodstraní. Hlavička dostane `smazano: <datum>` a projekt jde dál obnovit. Když se projekt znovu objeví v prohlížeči (obnova, import) a změní se, další záloha značku zruší.

### Připomínka ruční zálohy
Když automatická záloha funguje (stav „v pořádku“ a žádný projekt nečeká na zálohu), připomínka se ukáže až po 30 dnech od poslední ruční zálohy. Text: „Automatická záloha běží. Jednou za měsíc si stáhněte i kopii mimo claude.ai (Zálohovat všechny projekty).“ Jinak platí dnešních 7 dní.

## Technický návrh

### Schopnosti artefaktu
Publikace deklaruje celou sadu (neprázdný objekt nahrazuje uloženou deklaraci): `{sample: {images: true}, downloads: true, db: {}, user: {}}`. Pravidla `db` zůstanou výchozí, takže `data/users/<id>/` je soukromé pro každého (i před vlastníkem artefaktu u cizích podstromů). `user` je potřeba kvůli `await user.id()`.

### Datový model (úložiště artefaktu)
- Hlavička projektu: `data/users/<uid>/<pid>` (4 segmenty, dokument), tvar:
  `{format: 1, nazev, typ, zmeneno, velikost, sha256, verze, casti, komprese, zalohovano, smazano}`
  - `velikost`: bajty UTF-8 textu projektu,
  - `sha256`: hex otisk textu projektu,
  - `verze`: náhodné id verze (base36, 10 znaků),
  - `casti`: počet částí,
  - `komprese`: `"gzip"` nebo `"zadna"`,
  - `zalohovano`: ISO čas zápisu,
  - `smazano`: ISO čas nebo `null`.
- Část: `data/users/<uid>/<pid>/casti/<verze>_<i>` (6 segmentů), tvar `{d: "<base64, nejvýš 200 000 znaků>", t: "<ISO čas zápisu>"}`. Serializovaný dokument je tak hluboko pod limitem 256 KiB.
- `<pid>` se do segmentu převádí bezpečně: beze změny zůstanou jen písmena, číslice a `_ - ~ : @`, všechny ostatní bajty UTF-8 (i `.` a `+`) se zakódují jako `+xx` (malá hex). Převod jde vrátit a segment `.`/`..` nikdy nevznikne.

### Zálohování jednoho projektu
1. Vezme se `text` záznamu z `js/ulozeni.js` a spočítá se `sha256`. Když hlavička existuje se stejným `sha256`: bez `smazano` se nic nezapisuje, se `smazano` se jen zruší značka (`update({smazano: null})`, třeba po obnově smazaného projektu).
2. `text` → UTF-8 → gzip (`CompressionStream`; když chybí, `komprese: "zadna"`) → base64 → části po 200 000 znacích.
3. Vygeneruje se nová `verze` a části se zapíšou postupně (`set`), jedna po druhé.
4. Až jsou všechny části zapsané, přepíše se hlavička (`set`) s novou `verze`, `casti` a `smazano: null`. Teprve tím se nová verze stane platnou.
5. Úklid: části předchozí verze hlavičky se smažou přímo podle jejich počtu. Části jiných verzí starší než 24 hodin (podle `t`) najde dotaz a také je smaže, takže se nestahují všechny části. Čerstvé části jiné verze zůstanou, protože je může právě zapisovat jiná karta nebo počítač. Dlouhá lhůta snese i velký rozdíl hodin mezi počítači. Tím zmizí stará verze i zbytky přerušených pokusů a souběžná záloha se nepoškodí.

Přerušení v kroku 3 nebo 5 nepoškodí poslední platnou zálohu: hlavička dál ukazuje na úplnou starou verzi a sirotci se uklidí příště. Před zápisem hlavičky se znovu zkontroluje, jestli projekt mezitím nebyl v prohlížeči smazán. Pokud ano, hlavička dostane `smazano`.

### Kdy se zálohuje
- `js/ulozeni.js` dostane malé rozhraní pro sledování změn: `sleduj(fn)` volá `fn({typ: 'ulozeno' | 'smazano', id})` po úspěšném `uloz(p)` a po `smaz(id)`. Pokrývá to editor, import, obnovu i duplikování.
- Automatická záloha si změněné id zařadí do fronty a 30 s po poslední změně (prodleva se počítá znovu s každou změnou) zpracuje frontu postupně, projekt po projektu.
- Po startu (připojení úložiště) porovná projekty v prohlížeči s hlavičkami a zařadí ty, které v záloze chybí nebo mají v prohlížeči novější `zmeneno`.
- `smazano` → `update({smazano: <teď>})` na hlavičce, pokud existuje.
- Pro testy jde prodlevu zkrátit globální proměnnou `window.__PP_PRODLEVA_ZALOHY__` (ms). Jinak má výchozí hodnotu.

### Obnova
1. Přečtou se části `…/<pid>/casti/<verze>_0 … <verze>_<casti-1>`, spojí se, dekódují (base64 → gunzip → UTF-8) a ověří se `sha256`.
2. Text se načte přes `nactiProjekt` (model). Projekty s neshodným otiskem nebo chybou se nahlásí jako nepoužitelné (pole `chyby`).
3. Výsledek `{projekty, chyby, vytvoreno}` jde do stávajícího `obnovZalohu(z)`.

### Chyby a limity
| Kód z úložiště | Co uvidí uživatel | Co udělá záloha |
|---|---|---|
| `quota_exceeded` | „Úložiště artefaktu je plné. Odstraňte ze zálohy smazané projekty, nebo zálohujte ručně.“ | zastaví frontu, zkusí znovu při další změně |
| `resource_exhausted` | „Příliš mnoho požadavků, záloha pokračuje za minutu.“ | pauza 60 s, pak pokračuje |
| `unavailable` | „Úložiště je dočasně nedostupné.“ | jeden nový pokus po 2–5 s (náhodně), pak při další změně |
| `revoked` | karta zmizí | záloha se pro toto otevření vypne |
| `invalid_argument` a ostatní | „Záloha projektu „X“ selhala (kód …).“ | přeskočí projekt, pokračuje dalším |

- Ukládání do prohlížeče na záloze nezávisí: chyba zálohy nikdy nezablokuje práci.
- Připojení (`claude.use('db')`, `claude.use('user')`, `user.id()`) má limit 10 s. Bez úspěchu je záloha pro toto otevření nedostupná.
- Limity, které claude.ai neuvádí číslem: celková velikost úložiště artefaktu, počet dokumentů a rychlost volání. Komprese velikost zmenší, chyby se ohlásí podle tabulky.

## Rozdělení do modulů
- `js/zaloha/kodovani.js` – čisté funkce bez prohlížečových závislostí mimo standard (`CompressionStream`, `crypto.subtle`, `btoa/atob` nebo `Buffer`): `otisk(text)`, `zabal(text)` → `{data, komprese, velikost}`, `rozdel(data, n)`, `rozbal({data, komprese})` → text, `bezpecnySegment(id)` / `zpetSegment(s)`. Běží v Node (testy) i v prohlížeči.
- `js/zaloha/uloziste.js` – tenká vrstva nad `db` a `user`: `pripoj()` (s časovým limitem) → objekt úložiště nebo `null`, `hlavicky()`, `zapisCasti(pid, verze, casti)`, `zapisHlavicku(pid, h)`, `oznacSmazany(pid, kdy)`, `zrusSmazani(pid)`, `uklid(pid, platna, predchozi)`, `ctiData(pid, h)`, `odstran(pid)` a `kodChyby(e)` pro převod chyb na kódy z tabulky.
- `js/zaloha/autozaloha.js` – `vytvorAutozalohu({ulozeni, uloziste, prodlevaMs})` řídí frontu, prodlevu, dohánění po startu a stav s posluchači: `start()`, `stav()`, `naZmenu(fn)`, `projekty()` (hlavičky pro dialog), `nactiProObnovu(ids)`, `odstranZeZalohy(pid)`.
- `js/ulozeni.js` – `sleduj(fn)` a `zaznam(id)` (surový záznam s textem projektu).
- `js/app.js` – karta, upozornění na obnovu, dialog „Automatická záloha“, úprava `pripominkaZalohy`. Stav se na úvodní stránce aktualizuje bez překreslení celé stránky.
- `css/app.css` – styl karty a štítků v dialogu (stávající tokeny `rk-*`).

## Testy
- **Jednotkové** (`test/zaloha.test.mjs`, Node, falešné úložiště v paměti se stejným rozhraním jako `db`):
  - kódování tam a zpět (čeština, velký base64 podklad), všechny části pod limitem, kontrola otisku,
  - bezpečný segment tam a zpět,
  - přerušení během zápisu částí: hlavička beze změny, stará verze obnovitelná, sirotci se příště uklidí,
  - beze změny otisku se nic nezapíše,
  - smazání označí hlavičku,
  - dohánění po startu,
  - mapování chyb na stav.
- **V prohlížeči** (`test/autozaloha.e2e.test.mjs`, Playwright, podstrčené `window.claude.use` s falešným `db` a `user`, zkrácená prodleva):
  - úprava projektu se sama zazálohuje a karta ukáže stav,
  - nový kontext s prázdným úložištěm prohlížeče, ale stejnou zálohou, nabídne obnovu, která projekt vrátí beze změny,
  - smazaný projekt zůstane v záloze a jde odstranit tlačítkem,
  - `quota_exceeded` ukáže hlášku,
  - bez `claude.use` se karta nezobrazí,
  - jednosouborová sestava obsahuje automatickou zálohu.
- Stávající sady (`npm test`, `npm run test:e2e`) musí zůstat zelené.

## Publikace a ověření
- `npm run build` a publikace `dist/pozarni-planovac.artifact.html` na stejnou adresu se schopnostmi `{sample: {images: true}, downloads: true, db: {}, user: {}}`.
- Po prvním otevření artefaktu uživatelem se nástrojem ArtifactData ověří, že v jeho části úložiště jsou hlavičky a části projektů. Výsledek dostane uživatel jednou větou.

## Rizika a nejistoty
- Celkový limit úložiště a počet dokumentů claude.ai neuvádí. Velké podklady (PDF, fotky) ho mohou vyčerpat. Zmírnění: komprese, jasná hláška, ruční záloha.
- Záloha patří k artefaktu a se smazáním artefaktu zmizí. Zmírnění: připomínka ruční zálohy jednou za 30 dní.
- Záloha není synchronizace. Při práci na více počítačích platí v záloze poslední uložená verze projektu. Dialog ukáže „v záloze novější“ a obnovit jde jako kopie.
- claude.ai se může při prvním použití úložiště zeptat na svolení. Odepření = karta se nezobrazí, ruční záloha funguje dál.

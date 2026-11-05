# Bot Crossing

Útulný lokální dashboard, který zobrazuje tvoje relace Claude Code jako malou kolonii na hexagonální mapě.
Podrobný plán a ověřený formát dat: [PLAN.md](PLAN.md).

> **Stav: hotovo (fáze 5 z 5)** — 3D kolonie se živými změnami (hooky + WebSocket), animovanými dělníky
> a denním/nočním cyklem podle hodin tvého počítače.

## Rychlý start — tvůj postup

### Jednou na začátku (asi 3 minuty)

1. **Nainstaluj Node.js** (verze LTS) z <https://nodejs.org>, pokud ho ještě nemáš.
2. **Stáhni tuto složku** (`bot-crossing`) k sobě.
3. **Dvojklik na spouštěč:**
   - macOS: **`Bot Crossing.command`** (když macOS poprvé varuje, klikni pravým tlačítkem → Otevřít),
   - Windows: **`Bot Crossing.bat`**.
4. Otevře se okno terminálu. Při prvním spuštění se samo nainstaluje, co je potřeba, a **zeptá se na hooky**: stiskni **Enter** (= ano). Udělá zálohu tvého `settings.json` a přidá jen svoje hooky.
5. Otevře se prohlížeč s kolonií. **Restartuj** relace Claude Code, které už běží, aby hooky načetly.

### Každý den

1. **Dvojklik na spouštěč** → otevře se kolonie (když už běží, jen se otevře prohlížeč). Okno terminálu nech otevřené na pozadí.
2. **Pracuj v Claude Code jako obvykle**, klidně v několika terminálech najednou.
3. **Když se objeví 🙋 „Potřebuje tě“** (žlutý banner, `(1) 🙋` v názvu karty, případně systémové oznámení přes 🔔), klikni na něj. Uvidíš, která relace a proč. **Přepni se do jejího terminálu** a odpověz.
4. **🔥 Zablokováno** = agent skončil na chybě. Podívej se do detailu (vpravo) a rozhodni, co dál.
5. **Hotovou práci archivuj** tlačítkem **Archivovat** → budova dostane vlajku 🏁.
6. **Konec dne:** zavři okno terminálu (nebo `Ctrl+C`). Claude Code funguje dál i bez dashboardu, tichý režim hooků nic nehlásí.

### Kdyby něco

- **Odebrat hooky:** `npm run hooks:uninstall` (ve složce `bot-crossing`), vrátí `settings.json` do původního stavu.
- **Zkontrolovat hooky:** `npm run hooks:status`.
- **Aktualizace:** stáhni novou verzi složky a dvojklikni; spouštěč sám doinstaluje, co se změnilo.
- Další pomoc: [Řešení problémů](#řešení-problémů).

## Pro pokročilé: spuštění z terminálu

Požadavky: Node.js 20.19+ nebo 22.12+ (Windows, macOS i Linux).

```bash
cd bot-crossing
npm install
npm start
```

`npm start` otevře prohlížeč sám; `npm run dev` jen spustí server na <http://127.0.0.1:4545>. Jeden proces obsluhuje API i stránku, na jednom portu.

- **Otevřít** zkopíruje do schránky příkaz `cd "<projekt>" && claude --resume <id>` (na Windows se místo `&&` použije `;`). Vlož ho do terminálu. Pokud relace pořád běží, aplikace tě upozorní, ať se raději přepneš do jejího terminálu: `--resume` by spustil druhou kopii.
- **Archivovat** přesune relaci do stavu Hotovo. Pracující relaci archivovat nejde. **Obnovit** archivaci zruší.
- Kliknutím na relaci se otevře detail: cesta, model, poslední nástroje, zprávy, časová osa a surová data pro kontrolu.

### Kolonie (3D)

- Každá relace je jedna budova. Relace stejného projektu tvoří shluk kolem cedule s názvem projektu; uprostřed mapy je základna.
- **Ovládání:** levé tlačítko myši = otáčení, kolečko = přiblížení, pravé tlačítko = posun. Kliknutí na budovu (nebo na kartu vlevo) k ní plynule přiletí a otevře detail. Kliknutí do prázdna nebo **🗺 Celá kolonie** = zpět na přehled.
- **Stav budovy:** maják na anténě má barvu stavu (zelená pracuje, žlutá potřebuje tě, červená zablokováno, šedá nečinné, modrá hotovo). Zablokovaná budova kouří, „potřebuje tě“ pulzuje se žlutým kruhem, hotová má vlajku. Okna svítí, když agent pracuje.
- **Dělníci:** u pracující budovy bouchají kladivem 2 dělníci + 1 za každého běžícího subagenta. „Potřebuje tě“ = mávají, zablokováno = drbou se na hlavě, nečinné = sedí (po 6 h bez aktivity odejdou domů). U ukončené relace zhasnou světla a nikdo tam není.
- Budovy rostou s množstvím práce (od 40 a 200 volání nástrojů přibude modul).
- Zelená tečka vedle názvu = živé spojení (WebSocket). Šedá = spojení vypadlo, data se obnovují každé 2 s.
- Rozložení je stabilní: nová relace ani nový projekt existující budovy neposune.
- Přepínač **Kolonie / Seznam** vpravo nahoře; volba se pamatuje v prohlížeči.
- **Denní a noční cyklus** podle hodin tvého počítače: úsvit 5–8, den 8–18, soumrak 18–21, noc. V noci svítí okna, lampy u cestiček a hvězdy. Posuvníkem vpravo dole čas přepíšeš, tlačítko **Podle hodin** ho vrátí.
- Klávesa **Esc** zavře detail.
- Vše se kreslí lokálně, scéna nestahuje nic z internetu (žádné fonty, textury ani HDR z CDN).

Rychlá kontrola v terminálu bez serveru:

```bash
npm run list
```

Ukázková kolonie s falešnými relacemi ve všech stavech (tvoje skutečná data se vůbec nečtou):

```bash
npm run demo
```

### Když na tebe relace čeká

„Potřebuje tě“ je nejhlasitější věc v aplikaci: žlutý pulzující banner nahoře (kliknutím přiletíš k budově), žlutý kruh a mávající dělníci u budovy, karta nahoře v seznamu a v názvu karty prohlížeče `(1) 🙋 Bot Crossing` i se změněnou ikonkou. Takže si toho všimneš, i když máš otevřené jiné okno.

Volitelně: **zvoneček 🔕/🔔** vpravo nahoře zapne systémová oznámení. Prohlížeč se jednou zeptá na povolení. Používá se místní Notification API prohlížeče, nic neodchází ven.

## Hooky (živé události)

Bez hooků aplikace funguje, ale stav jen odhaduje ze souborů relací (zpoždění až 2 s a „Potřebuje tě“ pozná jen částečně, viz níže). S hooky Claude Code pošle každou událost okamžitě na `http://127.0.0.1:4545/hook`.

**Nastavení jedním příkazem (doporučeno):** spouštěč se na to zeptá sám při prvním spuštění, nebo kdykoli:

```bash
npm run hooks:install
```

Ukáže, co přidá, zeptá se, udělá zálohu `settings.json` (`settings.json.bot-crossing-backup-…`) a přidá jen svoje hooky. Tvoje ostatní nastavení i hooky zůstanou beze změny; opakované spuštění nic nezdvojí. Sám od sebe Bot Crossing tvoje nastavení nikdy nemění, jen když tento příkaz spustíš ty.

| Režim | Příkaz | Výhoda | Nevýhoda |
|---|---|---|---|
| **tichý** (výchozí) | `npm run hooks:install` | když dashboard neběží, Claude Code nic nehlásí (ověřeno) | u každé události se spustí Node (desítky ms) |
| http | `npm run hooks:install -- --http` | nejrychlejší, bez spouštění procesů | když dashboard neběží, Claude Code u každé události vypíše `hook … failed: ECONNREFUSED` |

Tichý režim posílá data přes malý skript [`hooks/send-event.mjs`](hooks/send-event.mjs), který je ořeže ještě před odesláním a vždy skončí bez chyby. Funguje i se starší verzí Claude Code, která nezná hooky typu `http`.

- **Kontrola:** `npm run hooks:status` (jen čte; upozorní i na neplatnou cestu, např. po přeinstalaci Node.js, pak stačí znovu `npm run hooks:install`).
- **Odebrání:** `npm run hooks:uninstall` (odebere jen hooky Bot Crossing, se zálohou).
- **Jiný port:** spusť instalaci se stejným portem, na kterém dashboard běží, např. `PORT=4546 npm run hooks:install`.
- Po instalaci **restartuj běžící relace** Claude Code (nejsem si jistý, jestli změnu načtou samy).

**Ruční nastavení (bez instalátoru):** zkopíruj obsah klíče `"hooks"` z [`hooks/bot-crossing-hooks.json`](hooks/bot-crossing-hooks.json) (http režim) do `~/.claude/settings.json` (Windows `%USERPROFILE%\.claude\settings.json`). Pokud už pro stejnou událost nějaké hooky máš, náš objekt do jejího pole přidej, nic nemaž.

**Co přesně přichází a co se ukládá:** Claude Code posílá celý obsah události, včetně zadání a vstupů nástrojů. Bot Crossing si z něj ponechá jen `session_id`, `cwd`, název události, název a ID nástroje, typ notifikace, příznak přerušení a ID subagenta, a to jen v paměti (posledních 60 událostí na relaci). Zbytek okamžitě zahodí a nic nezapisuje na disk. Odpověď je vždy `200 {}`, takže hook nikdy nic nepovolí, nezakáže ani nezmění.

**Doplňkový zdroj bez nastavování:** Claude Code si vede nedokumentovaný seznam běžících relací v `~/.claude/sessions/<pid>.json` se stavem `busy` / `waiting` / `idle`. Bot Crossing ho jen čte. `waiting` = čeká se na tebe (→ Potřebuje tě), `busy` = pracuje. Díky tomu se po tvém schválení povolení stav hned vrátí na Pracuje. Claude Code totiž nemá hook „povolení uděleno“. Jde o interní soubor, takže v jiné verzi může chybět; pak se prostě nepoužije.

## API

| Metoda | Cesta | Co vrací |
|---|---|---|
| GET | `/api/sessions` | seznam relací, seřazený: potřebuje tě → zablokováno → pracuje → nečinné → hotovo |
| GET | `/api/sessions/:id` | detail: poslední nástroje, poslední zprávy, časová osa |
| GET | `/api/health` | odkud se čte, kolik relací, chyby čtení |
| POST | `/api/sessions/:id/archive` | archivovat (→ Hotovo); odmítne, pokud relace pracuje |
| POST | `/api/sessions/:id/unarchive` | zrušit archivaci |
| POST | `/hook` | příjem událostí z hooků Claude Code (vždy odpoví `200 {}`) |
| WS | `/ws` | živé změny seznamu relací |

## Nastavení (proměnné prostředí, vše volitelné)

| Proměnná | Výchozí | Význam |
|---|---|---|
| `PORT` | `4545` | port serveru |
| `BC_DAYS` | `7` | načítat relace změněné za posledních N dní |
| `BC_WORKING_SEC` | `30` | aktivita v tomto okně = Pracuje |
| `BC_OPEN_TOOL_MIN` | `10` | nástroj bez výsledku se počítá jako Pracuje nejvýše tolik minut |
| `BC_BLOCKED_STRICT` | vypnuto | `1` = Zablokováno jen tehdy, když agent po chybě ukončil tah |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | stejná proměnná, jakou používá Claude Code |
| `BC_DEBUG_HOOKS` | vypnuto | `1` = do terminálu vypisuje přijaté hooky (jen název události a seznam klíčů, žádné hodnoty) |

Na Windows v PowerShellu: `$env:PORT=4546; npm run dev`

## Bezpečnost a soukromí

- Soubory v `~/.claude` se **jen čtou** (otevírají se výhradně pro čtení). Nic se tam nezapisuje, nepřesouvá ani nemaže.
- Aplikace zapisuje jen do `bot-crossing/.data/` (archivace, příznak prvního spuštění). `~/.claude/settings.json` mění pouze příkazy `hooks:install` / `hooks:uninstall`, když je spustíš ty (vždy se zálohou).
- Server poslouchá jen na `127.0.0.1` a odmítá požadavky s cizím `Host` nebo `Origin` (platí i pro WebSocket).
- `/hook` přijme jen `application/json` bez hlavičky `Origin`, takže webová stránka v prohlížeči nemůže podvrhnout události.
- Žádná odchozí síťová komunikace, žádná telemetrie.

## Řešení problémů

| Problém | Co s tím |
|---|---|
| `Port 4545 je obsazený jiným programem` | spusť s jiným portem: `PORT=4546 npm start` (Windows PowerShell: `$env:PORT=4546; npm start`) a hooky přeinstaluj se stejným portem |
| macOS: dvojklik na `Bot Crossing.command` nic neudělá / „nemáte oprávnění“ | v Terminálu ve složce `bot-crossing` spusť `chmod +x "Bot Crossing.command"`; při varování „neověřený vývojář“ pravé tlačítko → Otevřít |
| Windows: okno se hned zavře | spusť `Bot Crossing.bat` z příkazového řádku, ať vidíš chybu; nejčastěji chybí Node.js |
| Žádné relace | `npm run list` ukáže, odkud se čte. Relace starší 7 dní se nenačítají (`BC_DAYS=30 npm run dev`) |
| „Potřebuje tě“ se neukazuje | `npm run hooks:status`, případně `npm run hooks:install`, pak restartuj relace Claude Code. Bez hooků to pozná jen přes interní registr, a to nemusí být spolehlivé |
| 3D se nespustí | prohlížeč nemá WebGL; přepni na **Seznam**, ten funguje vždy |
| Claude Code hlásí `hook failed … ECONNREFUSED` | máš http režim a dashboard neběží. Přepni na tichý: `npm run hooks:install` |
| Data vypadají špatně | detail relace → **Surová data**; `BC_DEBUG_HOOKS=1 npm run dev` vypíše přijaté hooky (jen názvy a klíče) |

## Odinstalace

1. `npm run hooks:uninstall` a ověř `npm run hooks:status`.
2. Smaž složku `bot-crossing/`. Aplikace nic jiného nevytvořila; v `~/.claude` zůstanou jen zálohy `settings.json.bot-crossing-backup-…`, které můžeš smazat.

## Testy

```bash
npm test
npm run typecheck
```

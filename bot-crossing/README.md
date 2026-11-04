# Bot Crossing

Útulný lokální dashboard, který zobrazuje tvoje relace Claude Code jako malou kolonii na hexagonální mapě.
Podrobný plán a ověřený formát dat: [PLAN.md](PLAN.md).

> **Stav: fáze 4 z 5** — 3D kolonie se živými změnami (hooky + WebSocket) a animovanými dělníky.
> Denní/noční cyklus a dopilování přijdou ve fázi 5.

## Požadavky

- Node.js 20.19+ nebo 22.12+ (Windows, macOS i Linux)
- Claude Code, který už má nějaké relace v `~/.claude/projects/`

## Spuštění

```bash
cd bot-crossing
npm install
npm run dev
```

Pak otevři v prohlížeči <http://127.0.0.1:4545>. Jeden proces obsluhuje API i stránku, na jednom portu.

- **Otevřít** zkopíruje do schránky příkaz `cd "<projekt>" && claude --resume <id>` (na Windows se místo `&&` použije `;`). Vlož ho do terminálu.
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
- Vše se kreslí lokálně, scéna nestahuje nic z internetu (žádné fonty, textury ani HDR z CDN).

Rychlá kontrola v terminálu bez serveru:

```bash
npm run list
```

Ukázková kolonie s falešnými relacemi ve všech stavech (tvoje skutečná data se vůbec nečtou):

```bash
npm run demo
```

## Hooky (živé události)

Bez hooků aplikace funguje, ale stav jen odhaduje ze souborů relací (zpoždění až 2 s a „Potřebuje tě“ pozná jen částečně, viz níže). S hooky Claude Code pošle každou událost okamžitě na `http://127.0.0.1:4545/hook`.

**Nastavení (jednou):**

1. Otevři [`hooks/bot-crossing-hooks.json`](hooks/bot-crossing-hooks.json).
2. Otevři svůj soubor nastavení Claude Code: macOS `~/.claude/settings.json`, Windows `%USERPROFILE%\.claude\settings.json`. **Aplikace ho sama nikdy neupravuje.**
3. Zkopíruj obsah klíče `"hooks"` do svého nastavení:
   - nemáš-li tam ještě `"hooks"`, vlož celý blok;
   - máš-li už nějaké hooky pro stejnou událost (např. `"Stop"`), **přidej** náš objekt do jejího pole, nic nemaž.
4. Ověř (jen čte, nic nemění):
   ```bash
   npm run hooks:status
   ```
5. Spusť novou relaci Claude Code (u už běžících relací si nejsem jistý, jestli změnu nastavení načtou samy, proto je raději restartuj).

Pokud spouštíš Bot Crossing na jiném portu (`PORT=…`), změň port i v URL hooků.

**Odebrání:** ze `settings.json` smaž u každé události objekt s `"url": "http://127.0.0.1:4545/hook"` (a prázdná pole po něm). `npm run hooks:status` pak ukáže samé ✗.

**Když Bot Crossing neběží:** Claude Code pracuje normálně dál, hooky nic neblokují (ověřeno). U každé události ale vypíše krátkou hlášku typu `hook [http hook] failed: … ECONNREFUSED`. Claude Code neumí tichý režim pro selhání hooku. Pokud tě to ruší, máš dvě možnosti:

- hooky odeber, když dashboard nepoužíváš, nebo
- použij **tichou záložní variantu** [`hooks/bot-crossing-hooks-command.json`](hooks/bot-crossing-hooks-command.json). Spouští malý Node skript [`hooks/send-event.mjs`](hooks/send-event.mjs), který data ořeže, pošle je a vždy skončí bez chyby. Nevýhoda: u každé události se spustí Node (desítky ms). V souboru nahraď `/ABSOLUTNI/CESTA/K/bot-crossing` skutečnou cestou; na Windows např. (zápis uvnitř JSON) `node \"C:\\Users\\ty\\bot-crossing\\hooks\\send-event.mjs\"`. Tuto variantu použij i se starší verzí Claude Code, která nezná hooky typu `http`.

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
- Jediný soubor, který aplikace zapisuje: `bot-crossing/.data/state.json` (příznaky archivace).
- Server poslouchá jen na `127.0.0.1` a odmítá požadavky s cizím `Host` nebo `Origin` (platí i pro WebSocket).
- `/hook` přijme jen `application/json` bez hlavičky `Origin`, takže webová stránka v prohlížeči nemůže podvrhnout události.
- Žádná odchozí síťová komunikace, žádná telemetrie.

## Testy

```bash
npm test
npm run typecheck
```

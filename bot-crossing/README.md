# Bot Crossing

Útulný lokální dashboard, který zobrazuje tvoje relace Claude Code jako malou kolonii na hexagonální mapě.
Podrobný plán a ověřený formát dat: [PLAN.md](PLAN.md).

> **Stav: fáze 3 z 5** — backend čte existující relace, v prohlížeči je 3D hexagonální kolonie (a 2D seznam).
> Živé hooky, WebSocket a animovaní dělníci přijdou ve fázi 4.

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
- Budovy rostou s množstvím práce (od 40 a 200 volání nástrojů přibude modul).
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

## API (fáze 1)

| Metoda | Cesta | Co vrací |
|---|---|---|
| GET | `/api/sessions` | seznam relací, seřazený: potřebuje tě → zablokováno → pracuje → nečinné → hotovo |
| GET | `/api/sessions/:id` | detail: poslední nástroje, poslední zprávy, časová osa |
| GET | `/api/health` | odkud se čte, kolik relací, chyby čtení |
| POST | `/api/sessions/:id/archive` | archivovat (→ Hotovo); odmítne, pokud relace pracuje |
| POST | `/api/sessions/:id/unarchive` | zrušit archivaci |

## Nastavení (proměnné prostředí, vše volitelné)

| Proměnná | Výchozí | Význam |
|---|---|---|
| `PORT` | `4545` | port serveru |
| `BC_DAYS` | `7` | načítat relace změněné za posledních N dní |
| `BC_WORKING_SEC` | `30` | aktivita v tomto okně = Pracuje |
| `BC_OPEN_TOOL_MIN` | `10` | nástroj bez výsledku se počítá jako Pracuje nejvýše tolik minut |
| `BC_BLOCKED_STRICT` | vypnuto | `1` = Zablokováno jen tehdy, když agent po chybě ukončil tah |
| `CLAUDE_CONFIG_DIR` | `~/.claude` | stejná proměnná, jakou používá Claude Code |

Na Windows v PowerShellu: `$env:PORT=4546; npm run dev`

## Bezpečnost a soukromí

- Soubory v `~/.claude` se **jen čtou** (otevírají se výhradně pro čtení). Nic se tam nezapisuje, nepřesouvá ani nemaže.
- Jediný soubor, který aplikace zapisuje: `bot-crossing/.data/state.json` (příznaky archivace).
- Server poslouchá jen na `127.0.0.1` a odmítá požadavky s cizím `Host` nebo `Origin`.
- Žádná odchozí síťová komunikace, žádná telemetrie.

## Testy

```bash
npm test
npm run typecheck
```

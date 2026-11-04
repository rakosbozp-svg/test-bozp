# Bot Crossing

Útulný lokální dashboard, který zobrazuje tvoje relace Claude Code jako malou kolonii na hexagonální mapě.
Podrobný plán a ověřený formát dat: [PLAN.md](PLAN.md).

> **Stav: fáze 1 z 5** — backend čte existující relace a vrací je přes REST API s vypočteným stavem.
> 2D seznam, 3D kolonie, hooky a WebSocket přijdou v dalších fázích.

## Požadavky

- Node.js 20 nebo novější (Windows, macOS i Linux)
- Claude Code, který už má nějaké relace v `~/.claude/projects/`

## Spuštění

```bash
cd bot-crossing
npm install
npm run dev
```

Pak otevři v prohlížeči <http://127.0.0.1:4545/api/sessions>.

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

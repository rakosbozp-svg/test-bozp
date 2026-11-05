# Bot Crossing — Plán (čeká na schválení)

## 0. Kde se to ověřovalo (přečti nejdřív)

Průzkum proběhl v **linuxovém cloudovém kontejneru** s **Claude Code 2.1.318**, ne na tvém Windows/Macu.
V kontejneru byl přesně **jeden** záznam relace, a to relace, která napsala tento plán. Všechna tvrzení o formátu
pocházejí z toho souboru a z textů uvnitř nainstalovaného programu `claude`. Na tvém počítači:

- může být starší nebo novější verze Claude Code a názvy polí se mohou lišit → parser je tolerantní (neznámé typy záznamů přeskočí, chybějící pole nevadí);
- Windows a macOS jsem **přímo neviděl**. Cesty řeším přes `os.homedir()` a `path.join`, což je standard, ale po fázi 1 si to prosím spusť u sebe a řekni mi, jestli seznam relací sedí.

Hodnocení: ✅ ověřeno na disku · 🔎 viděno jen v programu (ne na disku) · ❓ neověřeno.

---

## 1. Co Claude Code skutečně ukládá

### 1.1 Umístění

| Cesta | Co to je | Stav |
|---|---|---|
| `~/.claude/projects/<zakódovaná-cesta>/<sessionId>.jsonl` | Jeden soubor na relaci, JSON Lines, jen se připisuje na konec | ✅ |
| `<zakódovaná-cesta>` | cesta k projektu, kde je každý znak kromě písmen a číslic nahrazen `-` (`/home/user/test-bozp` → `-home-user-test-bozp`). **Nejde spolehlivě převést zpět**, proto aplikace bere skutečnou cestu z pole `cwd` uvnitř záznamů | ✅ (Windows tvar `C--Users-…` ❓) |
| `…/<sessionId>/subagents/agent-<id>.jsonl` | Záznamy subagentů | 🔎 (tady nebyly) |
| `~/.claude/sessions/<pid>.json` | Živý seznam **běžících** procesů CLI: `pid, sessionId, cwd, status ("busy"/"idle"/"waiting"), updatedAt, version` | ✅ soubor viděn, ale nedokumentovaný a interní |
| proměnná `CLAUDE_CONFIG_DIR` | Přepíše `~/.claude`. Aplikace ji respektuje | 🔎 |

### 1.2 Typy záznamů (jeden JSON objekt na řádek)

Společná pole konverzačních záznamů: `type, uuid, parentUuid, timestamp (ISO), sessionId, cwd, version, gitBranch, isSidechain, entrypoint`.

| `type` | Užitečná pole | Na co |
|---|---|---|
| `user` s `message.content` jako **text** a `origin.kind:"human"` | text zadání | název relace (první zadání), „poslední zprávy“ |
| `user` s `message.content[]` typu `tool_result` | `tool_use_id`, `is_error`, navíc `toolUseResult` (objekt, nebo při chybě **text** začínající `"Error: …"`) | úspěch/selhání nástroje → Zablokováno |
| `assistant` | `message.model`, bloky `message.content[]`: `text`, `thinking`, `tool_use{id,name,input}` | model, poslední volání nástrojů, poslední zprávy |
| `custom-title` / `ai-title` | `customTitle` / `aiTitle` | přednostní název, pokud existuje 🔎 |
| `last-prompt` | `lastPrompt` | záložní název |
| `queue-operation`, `attachment`, `tools-used`, `atis-latch`, `summary`, `file-history-snapshot`, `pr-link`, `agent-name` | — | ignoruje se |

**Co ze souboru relace zjistit nejde:**
- „Čeká na povolení“ se nezapisuje, dokud je dotaz otevřený. `tool_use` bez `tool_result` vypadá stejně, ať nástroj dlouho běží, nebo čeká na tvé schválení. **Živé „Potřebuje tě“ proto vyžaduje hooky.**
- Claude Code **nemá pro lokální relace stav „archivováno“**. Archivace bude funkce Bot Crossing, uložená v jeho vlastním souboru.

### 1.3 Hooky (nainstalovaná verze 2.1.318)

Všech 33 událostí v programu: `PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, UserPromptSubmit, UserPromptExpansion, SessionStart, SessionEnd, Stop, StopFailure, SubagentStart, SubagentStop, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, PermissionRequest, PermissionDenied, Setup, TeammateIdle, TaskCreated, TaskCompleted, Elicitation, ElicitationResult, ConfigChange, WorktreeCreate, WorktreeRemove, InstructionsLoaded, CwdChanged, FileChanged, DirectoryAdded, MessageDisplay` 🔎

**Existují nativní HTTP hooky:** `{ "type": "http", "url": "...", "timeout": <s>, "headers": {...} }` pošle vstupní JSON hooku metodou POST na danou adresu 🔎.
Takže **žádný skript ani curl** a stejná konfigurace funguje na Windows i macOS. Selhání hooku Claude ve výchozím stavu neblokuje (`onFailure: "block"` se musí zapnout výslovně) 🔎. Ve fázi 4 to ověřím s vypnutým backendem.

Co Claude Code posílá (společné): `session_id, transcript_path, cwd, permission_mode, hook_event_name`, plus podle události:

| Událost | Pole navíc | Význam pro nás |
|---|---|---|
| `UserPromptSubmit` | `prompt` | začal tah → Pracuje |
| `PreToolUse` / `PostToolUse` | `tool_name, tool_input, tool_use_id` (+ `tool_response`) | Pracuje |
| `PostToolUseFailure` | `tool_name, error, is_interrupt` | Zablokováno (pokud nejde o přerušení) |
| `PermissionRequest` | `tool_name, tool_input` | Potřebuje tě |
| `Notification` | `notification_type` ∈ `permission_prompt, idle_prompt, elicitation_dialog, auth_success, …`, `message` | Potřebuje tě (povolení/dotaz) |
| `Stop` | `last_assistant_message` | **skončil tah**, ne relace |
| `StopFailure` | — | tah spadl na chybě API → Zablokováno |
| `SessionEnd` | `reason` | proces CLI skončil |
| `SubagentStart` / `SubagentStop` | `agent_id, agent_type` | další dělník u budovy |

⚠️ **Rozdíly oproti zadání:**
1. **`Stop` se spouští na konci každého tahu**, ne při konci relace. Relace končí událostí `SessionEnd`.
2. HTTP hooky posílají **celý** obsah události (včetně `tool_input` a `last_assistant_message`). Backend si nechá jen `session_id, cwd, událost, tool_name, notification_type, příznak chyby` a vlastní čas přijetí, zbytek okamžitě zahodí. Události samy čas neobsahují, proto ho doplní backend. Pokud chceš ořezání ještě *předtím*, než data opustí Claude Code, existuje záloha: command hook s ~15řádkovým Node skriptem. Je to víc dílů, takže ho nedoporučuji.
3. Typ hooku `http` potřebuje novější Claude Code. Ve verzi 2.1.318 jsem ho ověřil, ale **nevím, od které verze existuje** ❓. README bude obsahovat záložní variantu s command hookem.

Hooky se nastavují v `~/.claude/settings.json` (uživatel) nebo `.claude/settings.json` (projekt):
```json
{ "hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [ { "type": "http", "url": "http://127.0.0.1:4545/hook", "timeout": 2 } ] } ] } }
```
Dodám to jako `bot-crossing/hooks/bot-crossing-hooks.json` a sloučíš si to sám. **Do tvého nastavení nesahám.** Backend vždy odpoví `200 {}`, takže odpověď hooku nikdy nic nepovolí, nezakáže ani nezmění.

---

## 2. Zdroje dat

1. **Historie (při startu + průběžně):** projde `projects/*/*.jsonl` změněné za posledních 7 dní (nastavitelné). Čte **jen pro čtení**, řádek po řádku. Rozepsaný poslední řádek nevadí. Výsledky se cachují podle `(mtime, velikost)` a každé 2 s se dočte jen nový konec souboru.
2. **Živě (hooky):** `POST /hook` → log událostí v paměti pro každou relaci (posledních 200) → odeslání přes WebSocket.
3. **Volitelný bonus:** `~/.claude/sessions/*.json`, aby bylo vidět, jestli proces relace ještě běží. Je to nedokumentované, takže chybějící nebo změněný soubor se prostě ignoruje.

Spojuje se podle `sessionId`. Pro stav mají přednost události z hooků (jsou čerstvější), soubor relace dodá název, model, zprávy a historii nástrojů.

**Záruky:** soubory se otevírají jen pro čtení. Nic pod `~/.claude` se nezapisuje, nepřesouvá ani nemaže. Server poslouchá jen na `127.0.0.1` a odmítne požadavky, jejichž `Host` není localhost (ochrana proti DNS rebindingu). Žádná odchozí síťová volání ani telemetrie. Stav archivace je v `bot-crossing/.data/state.json` (v .gitignore).

---

## 3. Logika stavů (vyhodnocuje se shora, platí první shoda)

| Stav | Pravidlo | Vzhled |
|---|---|---|
| **Hotovo (Shipped)** | klikl jsi v Bot Crossing na Archivovat (jde, když relace zrovna nepracuje) | vlajka |
| **Potřebuje tě** | poslední `PermissionRequest` / `Notification(permission_prompt \| elicitation_dialog)`, po kterém nepřišlo `PreToolUse`/`PostToolUse`/`UserPromptSubmit`/`Stop` | žlutá tečka, pulzování, připnuto nahoře v UI |
| **Zablokováno** | poslední výsledek nástroje je selhání (`PostToolUseFailure` bez přerušení, nebo `is_error:true` v souboru), nebo `StopFailure`, a po něm nepřišel úspěšný nástroj ani nové zadání | červená tečka, kouř |
| **Pracuje** | jakákoli aktivita za posledních 30 s, **nebo** otevřené `PreToolUse` bez odpovídajícího `Post*` (třeba dlouhý build) | zelená tečka, kladiva |
| **Nečinné** | všechno ostatní („jsi na tahu“, když poslední tah skončil `Stop`) | dělníci sedí |

Bez hooků lze ze samotného souboru určit Pracuje, Zablokováno, Nečinné a Hotovo. Stav Potřebuje tě **nelze** (viz 1.2) a UI ukáže upozornění „hooky nejsou připojené“.

Známá slabina: `is_error` se nastavuje i u neškodných selhání (`grep` bez výsledku, povolení, které jsi zamítl). Stav Zablokováno tak může být „hlučný“. Udělám přepínač: „Zablokováno jen tehdy, když tah skončil hned po chybě“.

Horní lišta: **staví se** (Pracuje) / **potřebuje tě** / **zablokováno** / **hotovo** / **posádka** (pracující relace × 2 dělníci + 1 za každého běžícího subagenta).

---

## 4. Architektura (jedna instalace, jeden příkaz)

```
bot-crossing/
  package.json         # npm install && npm run dev
  server/              # TypeScript spouštěný přes tsx
    index.ts           # Express + ws + Vite middleware → JEDEN proces, JEDEN port (4545)
    transcripts.ts     # čtení a parsování JSONL, jen pro čtení
    hooks.ts           # příjem POST /hook
    status.ts          # pravidla stavů (s unit testy)
  src/                 # Vite + React + TS + react-three-fiber + drei
  hooks/bot-crossing-hooks.json
  README.md
```
Závislosti: `express, ws, react, react-dom, three, @react-three/fiber, @react-three/drei` + vývojové: `vite, @vitejs/plugin-react, typescript, tsx`. Žádná databáze, žádné concurrently, žádná knihovna na správu stavu.

API: `GET /api/sessions`, `GET /api/sessions/:id`, `POST /api/sessions/:id/archive` (a `/unarchive`), `POST /hook`, `WS /ws`.

Testování tady: tvoje skutečné relace nevidím, takže budu testovat na skutečném souboru relace z tohoto kontejneru, na umělých vzorcích ve stejném ověřeném formátu a hooky nasimuluji falešnými POST požadavky.

---

## 5. Rozhodnutí, která potřebuji od tebe (moje doporučení první)

1. **Co spustí stav Hotovo?** Doporučení: ruční tlačítko Archivovat, dostupné, kdykoli relace nepracuje. `SessionEnd` jen označí budovu jako „zavřenou“ (zhasnou světla), vlajku nepřidá automaticky.
2. **Je dokončený tah („jsi na tahu“) stav Potřebuje tě?** Doporučení: **ne**, nechat Nečinné. Jinak každá tichá relace zežloutne a skutečné žádosti o povolení se v tom ztratí.
3. **Tlačítko Otevřít.** Doporučení: zkopírovat do schránky `cd "<projekt>" && claude --resume <id>`. To funguje spolehlivě na Windows i macOS. Spustit terminál z prohlížeče spolehlivě nejde.
4. **Umístění.** Doporučení: složka `bot-crossing/` v tomto repozitáři (jsou v něm i jiné nesouvisející projekty), větev `claude/festive-franklin-gto0qg`.
5. **Port.** Výchozí `4545`, dá se změnit přes `PORT=`.

Pořadí stavby podle tvého zadání: fáze 1→5, po každé zastavím.

---

## 6. Ověřeno ve fázi 4 (skutečný běh Claude Code 2.1.318 s `--settings hooks/bot-crossing-hooks.json`)

- ✅ Hooky typu `http` fungují: POST s `Content-Type: application/json`, bez hlavičky `Origin`.
- ✅ Skutečné pořadí při dvou paralelních voláních Bash (jedno povolené, druhé vyžadující povolení):
  `UserPromptSubmit → PreToolUse → PreToolUse → PermissionRequest → PostToolUse → Stop → SessionEnd`.
- ✅ `PermissionRequest` **nemá** `tool_use_id` → žádost se páruje s otevřenými voláními stejného nástroje.
- ✅ Zamítnuté volání v režimu `-p` neposlalo `PostToolUseFailure` ani `PermissionDenied`; čistí to až `Stop`.
- ✅ Klíče payloadů: společné `session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, effort, hook_event_name`;
  `PostToolUse` navíc `tool_response, duration_ms`; `Stop` navíc `stop_hook_active, last_assistant_message, background_tasks, session_crons`; `SessionEnd` má `reason`.
- ✅ Když backend neběží, Claude Code doběhne normálně (exit 0), ale vypíše `… hook [http hook] failed: … (ECONNREFUSED)`.
  `onFailure` zná jen `continue` (výchozí) a `block`; tichý režim neexistuje.
- 🔎 Registr `~/.claude/sessions/<pid>.json`: `status` je `"waiting"` (s `waitingFor`: „input needed“, dialog, žádost sandboxu…), jinak `"busy"` (běží tah) nebo `"idle"`.
  Nevyzkoušeno živě s dialogem povolení, odvozeno z kódu programu. Používá se jen jako doplněk.
- ❓ Neověřeno: jak se hláška o selhání hooku zobrazuje v interaktivním terminálu (viděl jsem jen režim `-p`); zda běžící relace načte změnu `settings.json` bez restartu.

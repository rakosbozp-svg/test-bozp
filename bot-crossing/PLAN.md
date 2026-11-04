# Bot Crossing — Plan (awaiting approval)

## 0. Where this was verified (read this first)

This research ran in a **Linux cloud container** with **Claude Code 2.1.318**, not on your Windows or Mac machine.
That container held exactly **one** transcript, the session that wrote this plan. Every format claim below
comes from that file plus the strings inside the installed `claude` binary. On your machine:

- your Claude Code version may be older or newer, so field names can differ → the parser is defensive (unknown record types are skipped, missing fields are allowed);
- Windows and macOS were **not** inspected directly. Path handling uses `os.homedir()` and `path.join`, which is standard, but please run phase 1 on your machine and tell me if the session list looks wrong.

Rating per claim: ✅ verified on disk · 🔎 seen in the binary only (not on disk) · ❓ unverified.

---

## 1. What Claude Code actually stores

### 1.1 Locations

| Path | What it is | Status |
|---|---|---|
| `~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` | One transcript per session, append-only JSON Lines | ✅ |
| `<encoded-cwd>` | cwd with every non-alphanumeric char replaced by `-` (`/home/user/test-bozp` → `-home-user-test-bozp`). **Lossy**, so the app reads the real path from the `cwd` field inside records | ✅ (Windows form `C--Users-…` ❓) |
| `~/.claude/projects/<encoded-cwd>/<sessionId>/subagents/agent-<id>.jsonl` | Subagent (Task) transcripts | 🔎 (not present here) |
| `~/.claude/sessions/<pid>.json` | Live registry of **running** CLI processes: `pid, sessionId, cwd, status ("busy"/"idle"/"waiting"), updatedAt, version` | ✅ file seen, but undocumented and internal |
| `CLAUDE_CONFIG_DIR` env var | Overrides `~/.claude`. The app honours it | 🔎 |

### 1.2 Transcript record types (one JSON object per line)

Fields common to conversation records: `type, uuid, parentUuid, timestamp (ISO), sessionId, cwd, version, gitBranch, isSidechain, entrypoint`.

| `type` | Useful fields | Used for |
|---|---|---|
| `user` with `message.content` **string** and `origin.kind:"human"` | the prompt text | session title (first one), "last messages" |
| `user` with `message.content[]` of `tool_result` | `tool_use_id`, `is_error`, plus top-level `toolUseResult` (object, or a **string** starting `"Error: …"` on failure) | tool success/failure → Blocked |
| `assistant` | `message.model`, `message.content[]` blocks: `text`, `thinking`, `tool_use{id,name,input}` | model, recent tool calls, last messages |
| `custom-title` / `ai-title` | `customTitle` / `aiTitle` | preferred title if present 🔎 |
| `last-prompt` | `lastPrompt` | fallback title |
| `queue-operation` | `operation:"enqueue"`, `content` | ignored |
| `attachment` | `attachment.type` (hook_success, environment, …) | ignored |
| `tools-used`, `atis-latch`, `summary`, `file-history-snapshot`, `pr-link`, `agent-name` | — | ignored |

**What the transcript cannot tell us:**
- "Waiting for permission" is not written down while the prompt is open. A `tool_use` without a `tool_result` looks the same whether the tool is long-running or waiting for your approval. **Live "Needs you" therefore requires hooks.**
- Claude Code has **no "archived" concept for local sessions**. Archive is a Bot Crossing feature, stored in Bot Crossing's own file.

### 1.3 Hooks (installed version 2.1.318)

All 33 events in the binary: `PreToolUse, PostToolUse, PostToolUseFailure, PostToolBatch, Notification, UserPromptSubmit, UserPromptExpansion, SessionStart, SessionEnd, Stop, StopFailure, SubagentStart, SubagentStop, PreCompact, PostCompact, PreModelSwitch, PostModelSwitch, PermissionRequest, PermissionDenied, Setup, TeammateIdle, TaskCreated, TaskCompleted, Elicitation, ElicitationResult, ConfigChange, WorktreeCreate, WorktreeRemove, InstructionsLoaded, CwdChanged, FileChanged, DirectoryAdded, MessageDisplay` 🔎

**Native HTTP hooks exist:** `{ "type": "http", "url": "...", "timeout": <sec>, "headers": {...} }` POSTs the hook's input JSON to the URL 🔎.
That means **no script and no curl**, so the same config works on Windows and macOS. Failures don't block Claude by default (`onFailure: "block"` is opt-in) 🔎. I'll confirm that with the backend switched off in phase 4.

Payload Claude Code sends (common): `session_id, transcript_path, cwd, permission_mode, hook_event_name`, plus per event:

| Event | Extra fields | Meaning for us |
|---|---|---|
| `UserPromptSubmit` | `prompt` | turn started → Working |
| `PreToolUse` / `PostToolUse` | `tool_name, tool_input, tool_use_id` (+ `tool_response`) | Working |
| `PostToolUseFailure` | `tool_name, error, is_interrupt` | Blocked (unless interrupt) |
| `PermissionRequest` | `tool_name, tool_input` | Needs you |
| `Notification` | `notification_type` ∈ `permission_prompt, idle_prompt, elicitation_dialog, auth_success, …`, `message` | Needs you (permission/elicitation) |
| `Stop` | `last_assistant_message` | **turn finished**, not session finished |
| `StopFailure` | — | turn died on an API error → Blocked |
| `SessionEnd` | `reason` | the CLI process exited |
| `SubagentStart` / `SubagentStop` | `agent_id, agent_type` | extra worker on the building |

⚠️ **Differences from your spec:**
1. **`Stop` fires at the end of every turn**, not when the session ends. The session ends at `SessionEnd`.
2. HTTP hooks send the **whole** payload (including `tool_input` and `last_assistant_message`). The backend keeps only `session_id, cwd, event, tool_name, notification_type, error flag` plus its own receive timestamp, and drops the rest immediately. Payloads carry no timestamp of their own, so the backend adds one. If you want the trimming to happen *before* the data leaves Claude Code, there's a fallback: a command hook running a ~15-line Node script. It's more moving parts, so I'm not recommending it.
3. The `http` hook type needs a recent Claude Code. I verified it in 2.1.318 but **don't know the minimum version** ❓. The README will include the command-hook fallback.

Hooks are configured in `~/.claude/settings.json` (user) or `.claude/settings.json` (project):
```json
{ "hooks": { "PreToolUse": [ { "matcher": "*", "hooks": [ { "type": "http", "url": "http://127.0.0.1:4545/hook", "timeout": 2 } ] } ] } }
```
I'll ship this as `bot-crossing/hooks/bot-crossing-hooks.json` for you to merge yourself. **I won't touch your settings.** The backend always answers `200 {}`, so a hook response can never allow, deny or alter anything.

---

## 2. Data sources

1. **History (startup + polling):** scan `projects/*/*.jsonl` changed in the last 7 days (configurable). Read **read-only**, line by line. A half-written last line is tolerated. Results are cached by `(mtime, size)` and re-read incrementally from the last byte offset every 2 s.
2. **Live (hooks):** `POST /hook` → in-memory event log per session (last 200 events) → WebSocket push.
3. **Optional bonus:** `~/.claude/sessions/*.json` to know whether a session's process is still alive. It's undocumented, so a missing or changed file is simply ignored.

Merged by `sessionId`. Hook events are fresher and win for status; the transcript provides title, model, messages and tool history.

**Guarantees:** files are only ever opened for reading. Nothing under `~/.claude` is written, moved or deleted. The server binds to `127.0.0.1` and rejects requests whose `Host` isn't localhost (DNS-rebinding guard). There are no outbound network calls and no telemetry. Archive state lives in `bot-crossing/.data/state.json` (gitignored).

---

## 3. Status logic (evaluated top-down, first match wins)

| Status | Rule | Visual |
|---|---|---|
| **Shipped** | you clicked Archive in Bot Crossing (allowed when the session isn't Working) | flag |
| **Needs you** | latest `PermissionRequest` / `Notification(permission_prompt \| elicitation_dialog)` with no later `PreToolUse`/`PostToolUse`/`UserPromptSubmit`/`Stop` | yellow dot, pulse, pinned at the top of the UI |
| **Blocked** | latest tool outcome is a failure (`PostToolUseFailure` without interrupt, or transcript `is_error:true`), or `StopFailure`, with no successful tool or new prompt after it | red dot, smoke |
| **Working** | any activity in the last 30 s, **or** an open `PreToolUse` with no matching `Post*` (a long build, for example) | green dot, hammering |
| **Idle** | everything else ("your move" when the last turn ended with `Stop`) | workers sit |

Without hooks, the transcript alone can yield Working, Blocked, Idle and Shipped. It **cannot** yield Needs you (see 1.2), and the UI will show a "hooks not connected" hint.

Known weak spot: `is_error` is also set for harmless failures (a `grep` with no match, or a permission you denied). That can make Blocked noisy. I'll make it switchable: "Blocked only if the turn ended right after the error".

Top bar: **building** (Working) / **need you** / **blocked** / **shipped** / **crew** (Working sessions × 2 workers + 1 per running subagent).

---

## 4. Architecture (one install, one command)

```
bot-crossing/
  package.json         # npm install && npm run dev
  server/              # TypeScript run with tsx
    index.ts           # Express + ws + Vite middleware → ONE process, ONE port (4545)
    transcripts.ts     # read-only JSONL scanner/parser
    hooks.ts           # POST /hook receiver
    status.ts          # status rules (unit-tested)
  src/                 # Vite + React + TS + react-three-fiber + drei
  hooks/bot-crossing-hooks.json
  README.md
```
Dependencies: `express, ws, react, react-dom, three, @react-three/fiber, @react-three/drei` + dev: `vite, @vitejs/plugin-react, typescript, tsx`. No database, no concurrently, no state library.

API: `GET /api/sessions`, `GET /api/sessions/:id`, `POST /api/sessions/:id/archive` (and `/unarchive`), `POST /hook`, `WS /ws`.

Testing here: I can't see your real sessions, so I'll test against this container's real transcript plus synthetic fixtures in the verified format, and simulate hooks with fake POSTs.

---

## 5. Decisions I need from you (my recommendation first)

1. **"Shipped" trigger.** Recommendation: Archive is a manual button available any time the session isn't Working. `SessionEnd` just marks the building "closed" (lights off) without auto-flagging it.
2. **Is a finished turn ("your move") Needs you?** Recommendation: **no**, keep it Idle. Otherwise every quiet session turns yellow and real permission prompts drown in the noise.
3. **The "Open" button.** Recommendation: copy `cd "<project>" && claude --resume <id>` to the clipboard. That's reliable on Windows and macOS. Launching a terminal from a browser isn't.
4. **Location.** Recommendation: build it in the `bot-crossing/` subfolder of this repo (the repo already has unrelated projects), on branch `claude/festive-franklin-gto0qg`.
5. **Port.** Default `4545`, overridable with `PORT=`.

Build order as you specified: phases 1→5, stopping after each.

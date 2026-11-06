/**
 * Bot Crossing backend. Listens on 127.0.0.1 only.
 * One process serves the REST API, the hook receiver, the WebSocket and the frontend (Vite in
 * middleware mode), all on one port.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Request, Response, NextFunction } from 'express';
import { config } from './config.ts';
import { SessionService } from './sessions.ts';

const service = new SessionService();
const app = express();

// --- Local-only guards -------------------------------------------------------
const allowedHosts = new Set([`127.0.0.1:${config.port}`, `localhost:${config.port}`, `[::1]:${config.port}`]);

/** Rejects requests whose Host isn't localhost (DNS-rebinding guard). */
function localHostOnly(req: Request, res: Response, next: NextFunction) {
  if (!allowedHosts.has(String(req.headers.host))) return res.status(403).json({ error: 'Bot Crossing only answers on localhost' });
  next();
}

/** For state-changing requests: a browser page from another site must not be able to trigger them. */
function sameOriginOnly(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (!allowedHosts.has(new URL(origin).host)) return res.status(403).json({ error: 'Cross-origin request refused' });
    } catch {
      return res.status(403).json({ error: 'Bad Origin header' });
    }
  }
  next();
}

app.disable('x-powered-by');
app.use(localHostOnly);

// --- Hook receiver ---------------------------------------------------------------
// Claude Code POSTs every hook event here. We ALWAYS answer `200 {}`: an empty object is a no-op
// for every hook type, so this endpoint can never allow, deny or change anything Claude does.
const HOOK_PARSE_LIMIT = 1 << 20; // payloads above 1 MiB (big tool outputs) are not JSON-parsed
const field = (raw: string, name: string) => new RegExp(`"${name}"\\s*:\\s*("(?:[^"\\\\]|\\\\.){0,1024}"|true|false)`).exec(raw)?.[1];

app.post('/hook', express.text({ type: () => true, limit: '64mb' }), (req, res) => {
  res.json({});
  // Browsers can't send application/json cross-site without a CORS preflight (which we never
  // grant), and Claude Code sends no Origin — so this blocks web pages from faking events.
  if (req.headers.origin || !String(req.headers['content-type'] ?? '').includes('application/json')) {
    service.hooks.ignored++;
    return;
  }
  const raw = typeof req.body === 'string' ? req.body : '';
  let body: unknown;
  if (raw.length <= HOOK_PARSE_LIMIT) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = undefined;
    }
  } else {
    // Huge payload: pull out just the few fields we keep, without parsing the whole thing.
    const pick: Record<string, unknown> = {};
    for (const k of ['session_id', 'hook_event_name', 'cwd', 'tool_name', 'tool_use_id', 'notification_type', 'is_interrupt', 'agent_id']) {
      const v = field(raw, k);
      if (v !== undefined) pick[k] = JSON.parse(v);
    }
    body = pick;
  }
  const ev = service.hooks.ingestRaw(body);
  if (process.env.BC_DEBUG_HOOKS === '1') {
    // Debug aid: event name, content type and payload KEYS only — never values.
    const keys = body && typeof body === 'object' ? Object.keys(body as object).join(',') : '-';
    console.log(`[hook] ${ev ? ev.event : 'IGNORED'} ct=${req.headers['content-type']} bytes=${raw.length} keys=${keys}`);
  }
  if (ev) schedulePush();
});
app.use('/hook', ((_err, _req, res, _next) => {
  if (!res.headersSent) res.json({});
}) as express.ErrorRequestHandler);

app.use(express.json({ limit: '1mb' }));

// --- API -------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    claudeDir: config.claudeDir,
    projectsDir: config.projectsDir,
    lookbackDays: config.lookbackDays,
    sessions: service.transcripts.sessions().length,
    readErrors: service.transcripts.lastErrors,
    hooks: meta(),
  });
});

app.get('/api/sessions', (_req, res) => {
  res.json(service.list());
});

app.get('/api/sessions/:id', (req, res) => {
  const d = service.detail(String(req.params.id));
  if (!d) return res.status(404).json({ error: 'Unknown session' });
  res.json(d);
});

app.post('/api/sessions/:id/archive', sameOriginOnly, (req, res) => {
  const s = service.transcripts.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Unknown session' });
  const current = service.summarize(s);
  if (current.status === 'working') return res.status(409).json({ error: 'Session is working; archive it once it stops' });
  service.state.setArchived(s.id, true);
  schedulePush();
  res.json(service.summarize(s));
});

app.post('/api/sessions/:id/unarchive', sameOriginOnly, (req, res) => {
  const s = service.transcripts.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Unknown session' });
  service.state.setArchived(s.id, false);
  schedulePush();
  res.json(service.summarize(s));
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

// --- WebSocket: push session changes the moment they happen ----------------------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
let lastSignature = '';
let pushTimer: NodeJS.Timeout | undefined;

function meta() {
  const h = service.hooks;
  return {
    received: h.received,
    ignored: h.ignored,
    lastHookAt: h.lastHookAt ? new Date(h.lastHookAt).toISOString() : null,
    projectsDir: config.projectsDir,
    lookbackDays: config.lookbackDays,
  };
}

function snapshot() {
  return JSON.stringify({ type: 'sessions', sessions: service.list(), meta: meta() });
}

/** Sends the session list to all clients if anything meaningful changed. */
function pushIfChanged(force = false) {
  const list = service.list();
  // "seconds ago" changes every second; the client computes it itself, so ignore it here.
  const signature = JSON.stringify(list.map((s) => ({ ...s, lastActivityAgoSec: undefined })));
  if (!force && signature === lastSignature) return;
  lastSignature = signature;
  const msg = JSON.stringify({ type: 'sessions', sessions: list, meta: meta() });
  for (const c of wss.clients) if (c.readyState === c.OPEN) c.send(msg);
}

function schedulePush() {
  if (pushTimer) return;
  pushTimer = setTimeout(() => {
    pushTimer = undefined;
    pushIfChanged();
  }, 80);
}

wss.on('connection', (ws: WebSocket) => {
  ws.send(snapshot());
  ws.on('message', () => {
    /* clients don't send anything; ignore */
  });
});

// --- Start -----------------------------------------------------------------------
const appUrl = `http://${config.host}:${config.port}`;

/** Opens the dashboard in the default browser (only for `npm start` / the launchers). */
function openBrowser() {
  if (process.env.BC_OPEN_BROWSER !== '1') return;
  const [cmd, args] =
    process.platform === 'darwin' ? ['open', [appUrl]] : process.platform === 'win32' ? ['explorer', [appUrl]] : ['xdg-open', [appUrl]];
  try {
    spawn(cmd, args as string[], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
  } catch {
    /* no browser available: the URL is printed anyway */
  }
}

async function main() {
  await service.refresh();
  setInterval(() => {
    service
      .refresh()
      .then(() => pushIfChanged())
      .catch((e) => console.error('[bot-crossing] refresh failed:', e));
  }, config.pollMs).unref?.();

  const server = http.createServer(app);

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/ws') return; // e.g. Vite's hot-reload socket: Vite handles it
    const origin = req.headers.origin;
    let originOk = !origin;
    try {
      originOk ||= allowedHosts.has(new URL(origin!).host);
    } catch {
      originOk = false;
    }
    if (!allowedHosts.has(String(req.headers.host)) || !originOk) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  // Frontend: Vite dev server as middleware (hot reload), sharing our HTTP server and port.
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    root: config.appRoot,
    configFile: `${config.appRoot}/vite.config.ts`,
    appType: 'spa',
    server: { middlewareMode: true, ws: { server } },
    logLevel: 'warn',
  });
  app.use(vite.middlewares);

  server.on('error', async (e: any) => {
    if (e.code === 'EADDRINUSE') {
      // Already running (e.g. launcher double-clicked twice)? Then just open it.
      const ours = await fetch(`${appUrl}/api/health`, { signal: AbortSignal.timeout(1000) })
        .then((r) => r.ok && r.json())
        .then((j) => Boolean(j && j.claudeDir))
        .catch(() => false);
      if (ours) {
        console.log(`\n  Bot Crossing už běží → ${appUrl}\n`);
        openBrowser();
        process.exit(0);
      }
      console.error(`Port ${config.port} je obsazený jiným programem. Spusť s jiným: PORT=4546 npm start`);
    } else console.error(e);
    process.exit(1);
  });
  server.listen(config.port, config.host, () => {
    const n = service.transcripts.sessions().length;
    console.log(`\n  Bot Crossing  →  http://${config.host}:${config.port}`);
    console.log(`  Čtu (jen pro čtení): ${config.projectsDir}`);
    console.log(`  ${n} relací za posledních ${config.lookbackDays} dní`);
    for (const e of service.transcripts.lastErrors) console.log(`  ! ${e}`);
    console.log(`  Hooky: npm run hooks:status   ·   Ukončení: Ctrl+C`);
    console.log('');
    openBrowser();
  });
}

main();

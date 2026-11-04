/**
 * Bot Crossing backend. Listens on 127.0.0.1 only.
 * One process serves the REST API and the frontend (Vite in middleware mode), on one port.
 */
import http from 'node:http';
import express from 'express';
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
  res.json(service.summarize(s));
});

app.post('/api/sessions/:id/unarchive', sameOriginOnly, (req, res) => {
  const s = service.transcripts.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Unknown session' });
  service.state.setArchived(s.id, false);
  res.json(service.summarize(s));
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

// --- Start -----------------------------------------------------------------------
async function main() {
  await service.refresh();
  setInterval(() => {
    service.refresh().catch((e) => console.error('[bot-crossing] refresh failed:', e));
  }, config.pollMs).unref?.();

  const server = http.createServer(app);

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

  server.on('error', (e: any) => {
    if (e.code === 'EADDRINUSE') console.error(`Port ${config.port} je obsazený. Spusť s jiným: PORT=4546 npm run dev`);
    else console.error(e);
    process.exit(1);
  });
  server.listen(config.port, config.host, () => {
    const n = service.transcripts.sessions().length;
    console.log(`\n  Bot Crossing  →  http://${config.host}:${config.port}`);
    console.log(`  Čtu (jen pro čtení): ${config.projectsDir}`);
    console.log(`  ${n} relací za posledních ${config.lookbackDays} dní`);
    for (const e of service.transcripts.lastErrors) console.log(`  ! ${e}`);
    console.log('');
  });
}

main();

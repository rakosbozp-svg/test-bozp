/**
 * Bot Crossing's own state (archive flags), stored in bot-crossing/.data/state.json.
 * This is the ONLY file the app ever writes. It never lives under ~/.claude.
 */
import fs from 'node:fs';
import path from 'node:path';

interface StateFile {
  archived: Record<string, string>; // sessionId -> ISO time archived
}

export class AppState {
  private data: StateFile = { archived: {} };
  private file: string;

  constructor(dataDir: string) {
    this.file = path.join(dataDir, 'state.json');
    try {
      const j = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (j && typeof j.archived === 'object') this.data.archived = j.archived;
    } catch {
      // first run or unreadable: start empty
    }
  }

  archivedAt(id: string): string | undefined {
    return this.data.archived[id];
  }

  setArchived(id: string, archived: boolean): void {
    if (archived) this.data.archived[id] = new Date().toISOString();
    else delete this.data.archived[id];
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

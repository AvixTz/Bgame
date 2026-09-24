// Management from the server shell (never over the web):
//   docker exec bgame-api node src/admin.mjs stats
//   docker exec bgame-api node src/admin.mjs list
//   docker exec bgame-api node src/admin.mjs reset-pin "<name>" "<school>" <new-4-digit-code>
//   docker exec bgame-api node src/admin.mjs delete "<name>" "<school>"
//   docker exec bgame-api node src/admin.mjs export "<name>" "<school>"      (JSON to stdout, e.g. a parent's request)
//   docker exec bgame-api node src/admin.mjs backup /data/backups/bgame-YYYYMMDD.sqlite
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openDb } from './db.mjs';
import { hashPin, normalize, pinProblem } from './security.mjs';

const db = openDb(join(process.env.DATA_DIR ?? '/data', 'bgame.sqlite'));
const [cmd, a, b, c] = process.argv.slice(2);
const find = (name, school) => db.prepare('SELECT * FROM players WHERE name_key = ? AND school_key = ?').get(normalize(name), normalize(school));
const fmt = (t) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');

switch (cmd) {
  case 'stats': {
    const n = (sql) => db.prepare(sql).get().n;
    console.log({ players: n('SELECT COUNT(*) n FROM players'), active7d: db.prepare('SELECT COUNT(*) n FROM players WHERE last_seen > ?').get(Date.now() - 7 * 86400000).n, attempts: n('SELECT COUNT(*) n FROM attempts'), sessions: n('SELECT COUNT(*) n FROM sessions') });
    break;
  }
  case 'list':
    for (const p of db.prepare('SELECT name, school, created_at, last_seen, locked_until FROM players ORDER BY school, name').all())
      console.log(`${p.school} | ${p.name} | נוצר ${fmt(p.created_at)} | נראה ${fmt(p.last_seen)}${p.locked_until > Date.now() ? ' | נעול' : ''}`);
    break;
  case 'reset-pin': {
    const p = find(a, b);
    if (!p) { console.error('לא נמצא'); process.exit(1); }
    if (pinProblem(c)) { console.error('קוד חייב להיות 4 ספרות ולא פשוט מדי'); process.exit(1); }
    db.prepare('UPDATE players SET pin_hash = ?, failed = 0, locked_until = 0 WHERE id = ?').run(hashPin(c), p.id);
    db.prepare('DELETE FROM sessions WHERE player_id = ?').run(p.id);
    console.log('הקוד עודכן, וכל המכשירים של הילד התנתקו');
    break;
  }
  case 'delete': {
    const p = find(a, b);
    if (!p) { console.error('לא נמצא'); process.exit(1); }
    db.prepare('DELETE FROM players WHERE id = ?').run(p.id);
    console.log('נמחק לגמרי (כולל התקדמות וכניסות)');
    break;
  }
  case 'export': {
    const p = find(a, b);
    if (!p) { console.error('לא נמצא'); process.exit(1); }
    const doc = db.prepare('SELECT json FROM docs WHERE player_id = ?').get(p.id);
    const attempts = db.prepare('SELECT json FROM attempts WHERE player_id = ? ORDER BY at').all(p.id).map((r) => JSON.parse(r.json));
    console.log(JSON.stringify({ name: p.name, school: p.school, created: p.created_at, doc: doc ? JSON.parse(doc.json) : null, attempts }, null, 2));
    break;
  }
  case 'backup': {
    if (!a) { console.error('usage: backup <file>'); process.exit(1); }
    mkdirSync(dirname(a), { recursive: true });
    db.exec(`VACUUM INTO '${a.replace(/'/g, "''")}'`);
    console.log(`backup: ${a}`);
    break;
  }
  default:
    console.log('commands: stats | list | reset-pin <name> <school> <pin> | delete <name> <school> | export <name> <school> | backup <file>');
}
db.close();

import Database from "better-sqlite3";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
export class QqState {
  readonly db: Database.Database;
  constructor(file: string) {
    if (file !== ":memory:")
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    this.db = new Database(file);
    if (file !== ":memory:") chmodSync(file, 0o600);
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,at INTEGER);CREATE TABLE IF NOT EXISTS counts(actor TEXT,minute INTEGER,n INTEGER,PRIMARY KEY(actor,minute));CREATE TABLE IF NOT EXISTS answers(id TEXT PRIMARY KEY,actor TEXT,at INTEGER,vote INTEGER);`,
    );
  }
  claim(id: string, actor: string, now = Date.now()) {
    return this.db.transaction(() => {
      if (
        !this.db
          .prepare("INSERT OR IGNORE INTO events VALUES (?,?)")
          .run(id, now).changes
      )
        return false;
      const minute = Math.floor(now / 60000),
        row = this.db
          .prepare("SELECT n FROM counts WHERE actor=? AND minute=?")
          .get(actor, minute) as { n: number } | undefined;
      if ((row?.n || 0) >= 10) return false;
      this.db
        .prepare(
          "INSERT INTO counts VALUES (?,?,1) ON CONFLICT(actor,minute) DO UPDATE SET n=n+1",
        )
        .run(actor, minute);
      return true;
    })();
  }
  save(id: string, actor: string) {
    this.db
      .prepare("INSERT INTO answers VALUES (?,?,?,NULL)")
      .run(id, actor, Date.now());
  }
  vote(id: string, actor: string, value: boolean) {
    return (
      this.db
        .prepare("UPDATE answers SET vote=? WHERE id=? AND actor=?")
        .run(Number(value), id, actor).changes === 1
    );
  }
  prune(now = Date.now()) {
    this.db.prepare("DELETE FROM events WHERE at<?").run(now - 86400000);
    this.db
      .prepare("DELETE FROM counts WHERE minute<?")
      .run(Math.floor(now / 60000) - 1);
    this.db.prepare("DELETE FROM answers WHERE at<?").run(now - 7 * 86400000);
  }
  close() {
    this.db.close();
  }
}

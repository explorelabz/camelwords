import * as SQLite from "expo-sqlite";
import type { Data } from "../domain/types";
import { words, books } from "../content/catalog";
let db: SQLite.SQLiteDatabase;
async function database() {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("camelwords.db");
  await db.execAsync(
    `PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS app_snapshot (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS words (word_key TEXT PRIMARY KEY, book_key TEXT NOT NULL, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS books (book_key TEXT PRIMARY KEY,json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS pending_events (event_id TEXT PRIMARY KEY,json TEXT NOT NULL);`,
  );
  await db.withTransactionAsync(async () => {
    for (const w of words)
      await db.runAsync(
        "INSERT OR IGNORE INTO words VALUES (?,?,?)",
        w.key,
        w.book,
        JSON.stringify(w),
      );
    for (const b of books)
      await db.runAsync(
        "INSERT OR IGNORE INTO books VALUES (?,?)",
        b.key,
        JSON.stringify(b),
      );
  });
  return db;
}
export async function load(): Promise<Data | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ json: string }>(
    "SELECT json FROM app_snapshot WHERE id=1",
  );
  return row ? JSON.parse(row.json) : null;
}
export async function save(data: Data) {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      "INSERT OR REPLACE INTO app_snapshot VALUES (1,?)",
      JSON.stringify(data),
    );
    await db.runAsync("DELETE FROM pending_events");
    for (const e of data.events.filter((e) => data.outbox.includes(e.id)))
      await db.runAsync(
        "INSERT INTO pending_events VALUES (?,?)",
        e.id,
        JSON.stringify(e),
      );
  });
}

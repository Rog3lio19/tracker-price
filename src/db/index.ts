import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema.ts";

const databaseUrl = process.env.DATABASE_URL ?? "data/tracker.db";
mkdirSync(dirname(databaseUrl), { recursive: true });

const sqlite = new Database(databaseUrl);
// WAL permite que la app web y el worker lean/escriban la misma DB a la vez
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
// Si el otro proceso tiene un lock, espera hasta 5s en vez de fallar
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

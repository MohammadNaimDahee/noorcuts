import Database from "better-sqlite3";
import path from "path";
import type { Template, RenderJob } from "@/types";

const DB_PATH = path.join(process.cwd(), "noorcuts.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      background_type TEXT NOT NULL DEFAULT 'color',
      background_color TEXT NOT NULL DEFAULT '#000000',
      background_image TEXT,
      arabic_font_size INTEGER NOT NULL DEFAULT 48,
      translation_font_size INTEGER NOT NULL DEFAULT 24,
      arabic_color TEXT NOT NULL DEFAULT '#FFFFFF',
      translation_color TEXT NOT NULL DEFAULT '#CCCCCC',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS render_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL DEFAULT '',
      surah INTEGER NOT NULL,
      ayah_start INTEGER NOT NULL,
      ayah_end INTEGER NOT NULL,
      reciter_id TEXT NOT NULL,
      template_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output_path TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (template_id) REFERENCES templates(id)
    );
  `);

  // Insert default templates if none exist
  const count = database
    .prepare("SELECT COUNT(*) as count FROM templates")
    .get() as { count: number };

  // Add user_id column if missing (migration for existing DBs)
  const columns = database.prepare("PRAGMA table_info(render_history)").all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === "user_id")) {
    database.exec("ALTER TABLE render_history ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  }

  if (count.count === 0) {
    const insert = database.prepare(
      `INSERT INTO templates (name, background_type, background_color, arabic_font_size, translation_font_size, arabic_color, translation_color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    // 1. Classic Dark - elegant black with gold accents
    insert.run("Classic Dark", "color", "#0a0a14", 52, 28, "#FFFFFF", "#C8C0B0");

    // 2. Midnight Blue - deep navy with silver text
    insert.run("Midnight Blue", "color", "#0a1628", 52, 28, "#E8E4DC", "#8899AA");

    // 3. Desert Sand - warm dark brown tones
    insert.run("Desert Sand", "color", "#1a1008", 50, 26, "#F5E6C8", "#C4A87A");

    // 4. Emerald Night - dark green with light text
    insert.run("Emerald Night", "color", "#061210", 52, 28, "#E0F0E8", "#7ABAAA");

    // 5. Royal Purple - deep purple with cream text
    insert.run("Royal Purple", "color", "#10081a", 50, 26, "#F0E8F5", "#B09AC4");

    // 6. Pure White - clean minimal light theme
    insert.run("Pure White", "color", "#F5F3EE", 50, 26, "#1A1A2E", "#555555");

    // 7. Warm Charcoal - dark gray with warm white
    insert.run("Warm Charcoal", "color", "#1C1C1C", 52, 28, "#F8F0E0", "#A09888");

    // 8. Ocean Deep - dark teal
    insert.run("Ocean Deep", "color", "#081418", 50, 26, "#D8F0F0", "#68A0A8");
  }
}

// Template queries
export function getTemplates(): Template[] {
  const rows = getDb()
    .prepare("SELECT * FROM templates ORDER BY id")
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToTemplate);
}

export function getTemplate(id: number): Template | null {
  const row = getDb()
    .prepare("SELECT * FROM templates WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToTemplate(row) : null;
}

function rowToTemplate(row: Record<string, unknown>): Template {
  return {
    id: row.id as number,
    name: row.name as string,
    backgroundType: row.background_type as "color" | "image",
    backgroundColor: row.background_color as string,
    backgroundImage: (row.background_image as string) || null,
    arabicFontSize: row.arabic_font_size as number,
    translationFontSize: row.translation_font_size as number,
    arabicColor: row.arabic_color as string,
    translationColor: row.translation_color as string,
    createdAt: row.created_at as string,
  };
}

// Render history queries
export function createRenderJob(
  surah: number,
  ayahStart: number,
  ayahEnd: number,
  reciterId: string,
  templateId: number,
  userId: string
): number {
  const result = getDb()
    .prepare(
      `INSERT INTO render_history (user_id, surah, ayah_start, ayah_end, reciter_id, template_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(userId, surah, ayahStart, ayahEnd, reciterId, templateId);
  return Number(result.lastInsertRowid);
}

export function updateRenderJob(
  id: number,
  updates: Partial<Pick<RenderJob, "status" | "outputPath" | "errorMessage">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (updates.status !== undefined) {
    sets.push("status = ?");
    values.push(updates.status);
    if (updates.status === "completed" || updates.status === "failed") {
      sets.push("completed_at = datetime('now')");
    }
  }
  if (updates.outputPath !== undefined) {
    sets.push("output_path = ?");
    values.push(updates.outputPath);
  }
  if (updates.errorMessage !== undefined) {
    sets.push("error_message = ?");
    values.push(updates.errorMessage);
  }

  values.push(id);
  getDb()
    .prepare(`UPDATE render_history SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
}

export function getRenderHistory(userId: string): RenderJob[] {
  const rows = getDb()
    .prepare("SELECT * FROM render_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    id: row.id as number,
    surah: row.surah as number,
    ayahStart: row.ayah_start as number,
    ayahEnd: row.ayah_end as number,
    reciterId: row.reciter_id as string,
    templateId: row.template_id as number,
    status: row.status as RenderJob["status"],
    outputPath: (row.output_path as string) || null,
    errorMessage: (row.error_message as string) || null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) || null,
  }));
}

// Reciter discovery is now handled by src/lib/quran.ts getReciters()

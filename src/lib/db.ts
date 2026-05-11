import path from "path";
import fs from "fs";
import type { Template, RenderJob } from "@/types";
import type { Project, TransitionEffect } from "@/types";

const DB_PATH = path.join(process.cwd(), "noorcuts.db");
const OUTPUT_DIR = path.join(process.cwd(), "output");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getDb(): any {
  if (db) return db;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3");
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  return db;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runMigrations(database: any): void {
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
      project_id INTEGER,
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
      expires_at TEXT,
      FOREIGN KEY (template_id) REFERENCES templates(id),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      surah INTEGER,
      ayah_start INTEGER,
      ayah_end INTEGER,
      reciter_id TEXT,
      template_id INTEGER,
      format TEXT DEFAULT 'vertical',
      arabic_font TEXT DEFAULT 'amiri-quran',
      word_highlight INTEGER DEFAULT 0,
      audio_waveform INTEGER DEFAULT 0,
      transition_effect TEXT DEFAULT 'none',
      calligraphy_entrance INTEGER DEFAULT 0,
      surah_intro INTEGER DEFAULT 0,
      data_source TEXT DEFAULT 'local',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations for existing DBs
  const rhCols = database.prepare("PRAGMA table_info(render_history)").all() as Array<{ name: string }>;
  if (!rhCols.some((c) => c.name === "user_id")) {
    database.exec("ALTER TABLE render_history ADD COLUMN user_id TEXT NOT NULL DEFAULT ''");
  }
  if (!rhCols.some((c) => c.name === "project_id")) {
    database.exec("ALTER TABLE render_history ADD COLUMN project_id INTEGER");
  }
  if (!rhCols.some((c) => c.name === "expires_at")) {
    database.exec("ALTER TABLE render_history ADD COLUMN expires_at TEXT");
  }

  // Migrations for projects table
  const pCols = database.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  if (!pCols.some((c) => c.name === "word_highlight")) {
    database.exec("ALTER TABLE projects ADD COLUMN word_highlight INTEGER DEFAULT 0");
  }
  if (!pCols.some((c) => c.name === "audio_waveform")) {
    database.exec("ALTER TABLE projects ADD COLUMN audio_waveform INTEGER DEFAULT 0");
  }
  if (!pCols.some((c) => c.name === "transition_effect")) {
    database.exec("ALTER TABLE projects ADD COLUMN transition_effect TEXT DEFAULT 'none'");
  }
  if (!pCols.some((c) => c.name === "calligraphy_entrance")) {
    database.exec("ALTER TABLE projects ADD COLUMN calligraphy_entrance INTEGER DEFAULT 0");
  }
  if (!pCols.some((c) => c.name === "surah_intro")) {
    database.exec("ALTER TABLE projects ADD COLUMN surah_intro INTEGER DEFAULT 0");
  }
  if (!pCols.some((c) => c.name === "data_source")) {
    database.exec("ALTER TABLE projects ADD COLUMN data_source TEXT DEFAULT 'local'");
  }

  // Mark any stale "rendering" jobs as failed (server restarted while they were running)
  database.exec(
    "UPDATE render_history SET status = 'failed', error_message = 'Server restarted during render' WHERE status = 'rendering'"
  );

  // Insert default templates if none exist
  const count = database
    .prepare("SELECT COUNT(*) as count FROM templates")
    .get() as { count: number };

  if (count.count === 0) {
    const insert = database.prepare(
      `INSERT INTO templates (name, background_type, background_color, arabic_font_size, translation_font_size, arabic_color, translation_color)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );

    insert.run("Classic Dark", "color", "#0a0a14", 52, 28, "#FFFFFF", "#C8C0B0");
    insert.run("Midnight Blue", "color", "#0a1628", 52, 28, "#E8E4DC", "#8899AA");
    insert.run("Desert Sand", "color", "#1a1008", 50, 26, "#F5E6C8", "#C4A87A");
    insert.run("Emerald Night", "color", "#061210", 52, 28, "#E0F0E8", "#7ABAAA");
    insert.run("Royal Purple", "color", "#10081a", 50, 26, "#F0E8F5", "#B09AC4");
    insert.run("Pure White", "color", "#F5F3EE", 50, 26, "#1A1A2E", "#555555");
    insert.run("Warm Charcoal", "color", "#1C1C1C", 52, 28, "#F8F0E0", "#A09888");
    insert.run("Ocean Deep", "color", "#081418", 50, 26, "#D8F0F0", "#68A0A8");
    // New templates
    insert.run("Crimson Dusk", "color", "#1a0808", 52, 28, "#FFE8E0", "#D4908A");
    insert.run("Ivory Parchment", "color", "#F0E8D8", 50, 26, "#2A1A0A", "#7A6A4A");
    insert.run("Obsidian", "color", "#0A0A0A", 54, 30, "#FFFFFF", "#888888");
    insert.run("Forest Canopy", "color", "#0A1A0A", 50, 26, "#E0F0D8", "#8AB878");
    insert.run("Amber Glow", "color", "#1A1000", 52, 28, "#FFE8B0", "#E0A030");
    insert.run("Slate Blue", "color", "#1A1E28", 50, 26, "#E0E8F0", "#7890B0");
    insert.run("Rose Gold", "color", "#1A1018", 52, 28, "#FFE8F0", "#D4A0B8");
    insert.run("Moonlight", "color", "#14141E", 50, 26, "#F0F0FF", "#A0A0D0");
    // Minimalist templates
    insert.run("Minimal Snow", "color", "#FAFAFA", 46, 24, "#1A1A1A", "#999999");
    insert.run("Minimal Ink", "color", "#111111", 46, 24, "#EEEEEE", "#666666");
    insert.run("Minimal Stone", "color", "#E8E4E0", 46, 24, "#333333", "#888880");
    insert.run("Minimal Fog", "color", "#D0D4D8", 46, 24, "#1A1E22", "#606870");
    insert.run("Minimal Cloud", "color", "#F0F4F8", 46, 24, "#2A3040", "#8090A0");
    insert.run("Minimal Sand", "color", "#EAE0D0", 46, 24, "#2A2218", "#908068");
    insert.run("Minimal Ash", "color", "#282828", 46, 24, "#D8D8D8", "#707070");
    insert.run("Minimal Pearl", "color", "#F8F0F4", 46, 24, "#2A1A22", "#907080");
  }
}

// ═══════ Templates ═══════

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

// ═══════ Render History ═══════

export function createRenderJob(
  surah: number,
  ayahStart: number,
  ayahEnd: number,
  reciterId: string,
  templateId: number,
  userId: string,
  projectId?: number
): number {
  // Expires 30 minutes from now
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO render_history (user_id, project_id, surah, ayah_start, ayah_end, reciter_id, template_id, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(userId, projectId ?? null, surah, ayahStart, ayahEnd, reciterId, templateId, expiresAt);
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

export function getRenderHistory(userId: string, projectId?: number): RenderJob[] {
  let query = "SELECT * FROM render_history WHERE user_id = ?";
  const params: unknown[] = [userId];

  if (projectId !== undefined) {
    query += " AND project_id = ?";
    params.push(projectId);
  }

  query += " ORDER BY created_at DESC LIMIT 50";

  const rows = getDb()
    .prepare(query)
    .all(...params) as Array<Record<string, unknown>>;
  return rows.map(rowToRenderJob);
}

function rowToRenderJob(row: Record<string, unknown>): RenderJob {
  return {
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
    projectId: (row.project_id as number) || null,
    expiresAt: (row.expires_at as string) || null,
  };
}

// ═══════ Projects ═══════

export function createProject(userId: string, name: string, description?: string, dataSource?: string): number {
  const result = getDb()
    .prepare(
      `INSERT INTO projects (user_id, name, description, data_source) VALUES (?, ?, ?, ?)`
    )
    .run(userId, name, description || "", dataSource || "local");
  return Number(result.lastInsertRowid);
}

export function getProjects(userId: string): Project[] {
  const rows = getDb()
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC")
    .all(userId) as Array<Record<string, unknown>>;
  return rows.map(rowToProject);
}

export function getProject(id: number, userId: string): Project | null {
  const row = getDb()
    .prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?")
    .get(id, userId) as Record<string, unknown> | undefined;
  return row ? rowToProject(row) : null;
}

export function updateProject(
  id: number,
  userId: string,
  updates: Partial<Omit<Project, "id" | "userId" | "createdAt">>
): void {
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if (updates.name !== undefined) { sets.push("name = ?"); values.push(updates.name); }
  if (updates.description !== undefined) { sets.push("description = ?"); values.push(updates.description); }
  if (updates.surah !== undefined) { sets.push("surah = ?"); values.push(updates.surah); }
  if (updates.ayahStart !== undefined) { sets.push("ayah_start = ?"); values.push(updates.ayahStart); }
  if (updates.ayahEnd !== undefined) { sets.push("ayah_end = ?"); values.push(updates.ayahEnd); }
  if (updates.reciterId !== undefined) { sets.push("reciter_id = ?"); values.push(updates.reciterId); }
  if (updates.templateId !== undefined) { sets.push("template_id = ?"); values.push(updates.templateId); }
  if (updates.format !== undefined) { sets.push("format = ?"); values.push(updates.format); }
  if (updates.arabicFont !== undefined) { sets.push("arabic_font = ?"); values.push(updates.arabicFont); }
  if (updates.wordHighlight !== undefined) { sets.push("word_highlight = ?"); values.push(updates.wordHighlight ? 1 : 0); }
  if (updates.audioWaveform !== undefined) { sets.push("audio_waveform = ?"); values.push(updates.audioWaveform ? 1 : 0); }
  if (updates.transitionEffect !== undefined) { sets.push("transition_effect = ?"); values.push(updates.transitionEffect); }
  if (updates.calligraphyEntrance !== undefined) { sets.push("calligraphy_entrance = ?"); values.push(updates.calligraphyEntrance ? 1 : 0); }
  if (updates.surahIntro !== undefined) { sets.push("surah_intro = ?"); values.push(updates.surahIntro ? 1 : 0); }
  if (updates.dataSource !== undefined) { sets.push("data_source = ?"); values.push(updates.dataSource); }

  values.push(id, userId);
  getDb()
    .prepare(`UPDATE projects SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`)
    .run(...values);
}

export function deleteProject(id: number, userId: string): void {
  getDb()
    .prepare("DELETE FROM projects WHERE id = ? AND user_id = ?")
    .run(id, userId);
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: row.id as number,
    userId: row.user_id as string,
    name: row.name as string,
    description: (row.description as string) || "",
    dataSource: ((row.data_source as string) || "local") as "local" | "quran.com",
    surah: (row.surah as number) || null,
    ayahStart: (row.ayah_start as number) || null,
    ayahEnd: (row.ayah_end as number) || null,
    reciterId: (row.reciter_id as string) || null,
    templateId: (row.template_id as number) || null,
    format: (row.format as string) || "vertical",
    arabicFont: (row.arabic_font as string) || "amiri-quran",
    wordHighlight: !!(row.word_highlight as number),
    audioWaveform: !!(row.audio_waveform as number),
    transitionEffect: (row.transition_effect as TransitionEffect) || "none",
    calligraphyEntrance: !!(row.calligraphy_entrance as number),
    surahIntro: !!(row.surah_intro as number),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ═══════ Cleanup expired renders ═══════

export function cleanupExpiredRenders(): number {
  const now = new Date().toISOString();
  const expired = getDb()
    .prepare(
      "SELECT id, output_path, user_id FROM render_history WHERE expires_at IS NOT NULL AND expires_at < ? AND output_path IS NOT NULL"
    )
    .all(now) as Array<{ id: number; output_path: string; user_id: string }>;

  let cleaned = 0;
  for (const row of expired) {
    // Delete the file
    if (row.output_path && fs.existsSync(row.output_path)) {
      try {
        fs.unlinkSync(row.output_path);
        cleaned++;
      } catch {
        // ignore file delete errors
      }
    }
    // Mark as expired in DB
    getDb()
      .prepare("UPDATE render_history SET status = 'expired', output_path = NULL WHERE id = ?")
      .run(row.id);
  }

  // Clean up empty user directories
  if (fs.existsSync(OUTPUT_DIR)) {
    const userDirs = fs.readdirSync(OUTPUT_DIR);
    for (const dir of userDirs) {
      const dirPath = path.join(OUTPUT_DIR, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath);
        if (files.length === 0) {
          fs.rmdirSync(dirPath);
        }
      }
    }
  }

  return cleaned;
}

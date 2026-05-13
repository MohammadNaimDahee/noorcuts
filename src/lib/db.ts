import path from "path";
import fs from "fs";
import { Pool } from "pg";
import type { Template, RenderJob } from "@/types";
import type { Project, TransitionEffect } from "@/types";

const OUTPUT_DIR = path.join(process.cwd(), "output");

let migrated = false;
let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query(text: string, params?: unknown[]) {
  const client = getPool();
  return client.query(text, params);
}

async function runMigrations(): Promise<void> {
  if (migrated) return;

  await query(`
    CREATE TABLE IF NOT EXISTS templates (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      background_type TEXT NOT NULL DEFAULT 'color',
      background_color TEXT NOT NULL DEFAULT '#000000',
      background_image TEXT,
      arabic_font_size INTEGER NOT NULL DEFAULT 48,
      translation_font_size INTEGER NOT NULL DEFAULT 32,
      arabic_color TEXT NOT NULL DEFAULT '#FFFFFF',
      translation_color TEXT NOT NULL DEFAULT '#CCCCCC',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
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
      word_highlight BOOLEAN DEFAULT false,
      audio_waveform BOOLEAN DEFAULT false,
      transition_effect TEXT DEFAULT 'none',
      calligraphy_entrance BOOLEAN DEFAULT false,
      surah_intro BOOLEAN DEFAULT false,
      data_source TEXT DEFAULT 'local',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS render_history (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT '',
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      surah INTEGER NOT NULL,
      ayah_start INTEGER NOT NULL,
      ayah_end INTEGER NOT NULL,
      reciter_id TEXT NOT NULL,
      template_id INTEGER NOT NULL REFERENCES templates(id),
      status TEXT NOT NULL DEFAULT 'pending',
      output_path TEXT,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ
    )
  `);

  // Mark any stale "rendering" jobs as failed (server restarted while they were running)
  await query(`
    UPDATE render_history SET status = 'failed', error_message = 'Server restarted during render'
    WHERE status = 'rendering'
  `);

  // Insert default templates if none exist
  const { rows } = await query(`SELECT COUNT(*) as count FROM templates`);
  if (Number(rows[0].count) === 0) {
    const templates = [
      ["Classic Dark", "color", "#0a0a14", 52, 34, "#FFFFFF", "#C8C0B0"],
      ["Midnight Blue", "color", "#0a1628", 52, 34, "#E8E4DC", "#8899AA"],
      ["Desert Sand", "color", "#1a1008", 50, 32, "#F5E6C8", "#C4A87A"],
      ["Emerald Night", "color", "#061210", 52, 34, "#E0F0E8", "#7ABAAA"],
      ["Royal Purple", "color", "#10081a", 50, 32, "#F0E8F5", "#B09AC4"],
      ["Pure White", "color", "#F5F3EE", 50, 32, "#1A1A2E", "#555555"],
      ["Warm Charcoal", "color", "#1C1C1C", 52, 34, "#F8F0E0", "#A09888"],
      ["Ocean Deep", "color", "#081418", 50, 32, "#D8F0F0", "#68A0A8"],
      ["Crimson Dusk", "color", "#1a0808", 52, 34, "#FFE8E0", "#D4908A"],
      ["Ivory Parchment", "color", "#F0E8D8", 50, 32, "#2A1A0A", "#7A6A4A"],
      ["Obsidian", "color", "#0A0A0A", 54, 36, "#FFFFFF", "#888888"],
      ["Forest Canopy", "color", "#0A1A0A", 50, 32, "#E0F0D8", "#8AB878"],
      ["Amber Glow", "color", "#1A1000", 52, 34, "#FFE8B0", "#E0A030"],
      ["Slate Blue", "color", "#1A1E28", 50, 32, "#E0E8F0", "#7890B0"],
      ["Rose Gold", "color", "#1A1018", 52, 34, "#FFE8F0", "#D4A0B8"],
      ["Moonlight", "color", "#14141E", 50, 32, "#F0F0FF", "#A0A0D0"],
      ["Minimal Snow", "color", "#FAFAFA", 46, 30, "#1A1A1A", "#999999"],
      ["Minimal Ink", "color", "#111111", 46, 30, "#EEEEEE", "#666666"],
      ["Minimal Stone", "color", "#E8E4E0", 46, 30, "#333333", "#888880"],
      ["Minimal Fog", "color", "#D0D4D8", 46, 30, "#1A1E22", "#606870"],
      ["Minimal Cloud", "color", "#F0F4F8", 46, 30, "#2A3040", "#8090A0"],
      ["Minimal Sand", "color", "#EAE0D0", 46, 30, "#2A2218", "#908068"],
      ["Minimal Ash", "color", "#282828", 46, 30, "#D8D8D8", "#707070"],
      ["Minimal Pearl", "color", "#F8F0F4", 46, 30, "#2A1A22", "#907080"],
    ];

    for (const [name, bgType, bgColor, arabicSize, transSize, arabicColor, transColor] of templates) {
      await query(
        `INSERT INTO templates (name, background_type, background_color, arabic_font_size, translation_font_size, arabic_color, translation_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [name, bgType, bgColor, arabicSize, transSize, arabicColor, transColor]
      );
    }
  }

  migrated = true;
}

// Ensure migrations run before any query
async function ensureDb(): Promise<void> {
  await runMigrations();
}

// ═══════ Templates ═══════

export async function getTemplates(): Promise<Template[]> {
  await ensureDb();
  const { rows } = await query(`SELECT * FROM templates ORDER BY id`);
  return rows.map(rowToTemplate);
}

export async function getTemplate(id: number): Promise<Template | null> {
  await ensureDb();
  const { rows } = await query(`SELECT * FROM templates WHERE id = $1`, [id]);
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
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

export async function createRenderJob(
  surah: number,
  ayahStart: number,
  ayahEnd: number,
  reciterId: string,
  templateId: number,
  userId: string,
  projectId?: number
): Promise<number> {
  await ensureDb();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const pid = projectId ?? null;
  const { rows } = await query(
    `INSERT INTO render_history (user_id, project_id, surah, ayah_start, ayah_end, reciter_id, template_id, status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)
     RETURNING id`,
    [userId, pid, surah, ayahStart, ayahEnd, reciterId, templateId, expiresAt]
  );
  return rows[0].id as number;
}

export async function updateRenderJob(
  id: number,
  updates: Partial<Pick<RenderJob, "status" | "outputPath" | "errorMessage">>
): Promise<void> {
  await ensureDb();
  const sets: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.status !== undefined) {
    sets.push(`status = $${paramIdx++}`);
    values.push(updates.status);
    if (updates.status === "completed" || updates.status === "failed" || updates.status === "cancelled") {
      sets.push(`completed_at = NOW()`);
    }
  }
  if (updates.outputPath !== undefined) {
    sets.push(`output_path = $${paramIdx++}`);
    values.push(updates.outputPath);
  }
  if (updates.errorMessage !== undefined) {
    sets.push(`error_message = $${paramIdx++}`);
    values.push(updates.errorMessage);
  }

  values.push(id);
  await query(`UPDATE render_history SET ${sets.join(", ")} WHERE id = $${paramIdx}`, values);
}

export async function getRenderHistory(userId: string, projectId?: number): Promise<RenderJob[]> {
  await ensureDb();
  let rows;
  if (projectId !== undefined) {
    const result = await query(
      `SELECT * FROM render_history WHERE user_id = $1 AND project_id = $2
       ORDER BY created_at DESC LIMIT 50`,
      [userId, projectId]
    );
    rows = result.rows;
  } else {
    const result = await query(
      `SELECT * FROM render_history WHERE user_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    rows = result.rows;
  }
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

export async function createProject(userId: string, name: string, description?: string, dataSource?: string): Promise<number> {
  await ensureDb();
  const desc = description || "";
  const ds = dataSource || "local";
  const { rows } = await query(
    `INSERT INTO projects (user_id, name, description, data_source)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, name, desc, ds]
  );
  return rows[0].id as number;
}

export async function getProjects(userId: string): Promise<Project[]> {
  await ensureDb();
  const { rows } = await query(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
  return rows.map(rowToProject);
}

export async function getProject(id: number, userId: string): Promise<Project | null> {
  await ensureDb();
  const { rows } = await query(
    `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return rows.length > 0 ? rowToProject(rows[0]) : null;
}

export async function updateProject(
  id: number,
  userId: string,
  updates: Partial<Omit<Project, "id" | "userId" | "createdAt">>
): Promise<void> {
  await ensureDb();
  const sets: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (updates.name !== undefined) { sets.push(`name = $${paramIdx++}`); values.push(updates.name); }
  if (updates.description !== undefined) { sets.push(`description = $${paramIdx++}`); values.push(updates.description); }
  if (updates.surah !== undefined) { sets.push(`surah = $${paramIdx++}`); values.push(updates.surah); }
  if (updates.ayahStart !== undefined) { sets.push(`ayah_start = $${paramIdx++}`); values.push(updates.ayahStart); }
  if (updates.ayahEnd !== undefined) { sets.push(`ayah_end = $${paramIdx++}`); values.push(updates.ayahEnd); }
  if (updates.reciterId !== undefined) { sets.push(`reciter_id = $${paramIdx++}`); values.push(updates.reciterId); }
  if (updates.templateId !== undefined) { sets.push(`template_id = $${paramIdx++}`); values.push(updates.templateId); }
  if (updates.format !== undefined) { sets.push(`format = $${paramIdx++}`); values.push(updates.format); }
  if (updates.arabicFont !== undefined) { sets.push(`arabic_font = $${paramIdx++}`); values.push(updates.arabicFont); }
  if (updates.wordHighlight !== undefined) { sets.push(`word_highlight = $${paramIdx++}`); values.push(updates.wordHighlight); }
  if (updates.audioWaveform !== undefined) { sets.push(`audio_waveform = $${paramIdx++}`); values.push(updates.audioWaveform); }
  if (updates.transitionEffect !== undefined) { sets.push(`transition_effect = $${paramIdx++}`); values.push(updates.transitionEffect); }
  if (updates.calligraphyEntrance !== undefined) { sets.push(`calligraphy_entrance = $${paramIdx++}`); values.push(updates.calligraphyEntrance); }
  if (updates.surahIntro !== undefined) { sets.push(`surah_intro = $${paramIdx++}`); values.push(updates.surahIntro); }
  if (updates.dataSource !== undefined) { sets.push(`data_source = $${paramIdx++}`); values.push(updates.dataSource); }

  values.push(id, userId);
  const idIdx = paramIdx++;
  const userIdx = paramIdx;
  await query(`UPDATE projects SET ${sets.join(", ")} WHERE id = $${idIdx} AND user_id = $${userIdx}`, values);
}

export async function deleteProject(id: number, userId: string): Promise<void> {
  await ensureDb();
  await query(`DELETE FROM projects WHERE id = $1 AND user_id = $2`, [id, userId]);
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
    wordHighlight: !!(row.word_highlight),
    audioWaveform: !!(row.audio_waveform),
    transitionEffect: (row.transition_effect as TransitionEffect) || "none",
    calligraphyEntrance: !!(row.calligraphy_entrance),
    surahIntro: !!(row.surah_intro),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ═══════ Cleanup expired renders ═══════

export async function cleanupExpiredRenders(): Promise<number> {
  await ensureDb();
  const now = new Date().toISOString();
  const { rows: expired } = await query(
    `SELECT id, output_path, user_id FROM render_history
     WHERE expires_at IS NOT NULL AND expires_at < $1 AND output_path IS NOT NULL`,
    [now]
  );

  let cleaned = 0;
  for (const row of expired) {
    const outputPath = row.output_path as string;
    if (outputPath && fs.existsSync(outputPath)) {
      try {
        fs.unlinkSync(outputPath);
        cleaned++;
      } catch {
        // ignore file delete errors
      }
    }
    await query(`UPDATE render_history SET status = 'expired', output_path = NULL WHERE id = $1`, [row.id]);
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

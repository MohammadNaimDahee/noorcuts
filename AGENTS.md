# AGENTS.md - Noorcuts AI Agent Guide

## Project Summary

Noorcuts is a personal local web app that generates Quran recitation shorts (9:16 vertical MP4 videos) with Arabic text and English translations, synced to recitation audio. It replaces a manual CapCut workflow.

## Tech Stack

- **Next.js** (App Router) with **TypeScript**
- **Remotion** for declarative video composition (React-based)
- **FFmpeg** for final encoding, audio muxing, compression
- **SQLite** for local database (better-sqlite3)
- Local JSON for Quran text and translations
- Local audio files for recitation

## Architecture

This is a **monorepo single Next.js app** with Remotion integrated. There is no separate backend service. API routes in Next.js handle render jobs and data queries.

### Key Directories

- `src/app/` - Next.js pages and API routes
- `src/remotion/` - Remotion video compositions (these are React components that define video frames)
- `src/components/` - Dashboard UI components
- `src/lib/` - Shared utilities (database, FFmpeg, Quran data, render logic)
- `src/types/` - TypeScript type definitions
- `data/` - Quran JSON data and ayah timestamp files
- `public/audio/` - Recitation audio files
- `public/backgrounds/` - Background images for videos
- `public/fonts/` - Custom fonts (Arabic + English)
- `output/` - Rendered MP4 files (gitignored)

## Coding Conventions

- TypeScript strict mode, no `any` types
- Use Next.js App Router conventions (server components by default, `"use client"` only when needed)
- Remotion compositions go in `src/remotion/` and are plain React components
- Database access only through `src/lib/db.ts` helper functions
- All file paths use path.join, never string concatenation
- Use named exports, not default exports (except Next.js pages)
- Error handling: throw descriptive errors, never silently swallow

## Remotion Specifics

- Video format: 1080x1920 (9:16 vertical)
- FPS: 30
- Compositions are registered in `src/remotion/Root.tsx`
- Each composition receives props via `inputProps` (ayah data, audio source, style config)
- Use `useCurrentFrame()` and `useVideoConfig()` for animation timing
- Use `<Audio>` component from Remotion for audio sync
- Render is triggered server-side using `@remotion/renderer` (bundle + renderMedia)

## Quran Data

- Source file: `data/quran.json`
- Structure: array of objects with `{ surah: number, ayah: number, arabic: string, translation_en: string }`
- Loaded via `src/lib/quran.ts` utility functions
- Never modify the source JSON at runtime

## Audio and Timestamps

- Each reciter has a SQLite DB file in `data/` (e.g. `data/ayah-recitation-abdur-rahman-as-sudais-recitation.db`)
- DB schema: `verses (surah_number INTEGER, ayah_number INTEGER, audio_url TEXT, duration INTEGER, segments TEXT)`
- `audio_url` points to CDN audio for each individual ayah (e.g. `https://audio.qurancdn.com/Sudais/mp3/001001.mp3`)
- `duration` is in seconds
- `segments` is a JSON array of word-level timing: `[[wordStart, wordEnd, startMs, endMs], ...]`
- Reciter discovery is automatic: any `.db` file in `data/` (excluding `noorcuts.db`) is treated as a reciter DB
- Audio is fetched from the CDN URLs stored in the DB; no local audio files needed
- Timestamps are derived from the reciter DB, not manually entered

## Database (SQLite)

- File: `noorcuts.db` at project root
- Managed via `better-sqlite3`
- Tables: templates, render_history
- Migrations are plain SQL files in `src/lib/migrations/`
- No ORM; use raw SQL via prepared statements

## Rendering Pipeline

1. Frontend sends render request to `/api/render` with params (surah, ayah range, reciter, style)
2. API route bundles the Remotion composition using `bundle()`
3. API route calls `renderMedia()` with input props
4. FFmpeg post-processing (compression, format adjustments) via `src/lib/ffmpeg.ts`
5. Output saved to `output/` directory
6. Response returns download URL

## Common Tasks

### Adding a new video template
1. Create a new composition component in `src/remotion/`
2. Register it in `src/remotion/Root.tsx`
3. Add its config to the template selector in the dashboard

### Adding a new translation language
1. Add translation field to `data/quran.json` (e.g., `translation_fr`)
2. Update types in `src/types/index.ts`
3. Update the Remotion composition to accept and display the new field

### Adding a new reciter
1. Add audio files to `public/audio/{reciter_name}/`
2. Add timestamp files to `data/timestamps/{reciter_name}/`
3. Register the reciter in the database or config

## Do NOT

- Do not use external APIs for Quran data during rendering; everything is local
- Do not use `default export` except for Next.js page components
- Do not store rendered videos in git; `output/` is gitignored
- Do not modify `data/quran.json` at runtime
- Do not use client-side rendering for Remotion compositions meant for export; they render server-side via `@remotion/renderer`
- Do not install CapCut SDK or any CapCut-related packages

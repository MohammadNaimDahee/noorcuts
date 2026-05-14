import { getQfOAuthConfig } from "./qf-oauth";

// Cached content API token (client_credentials — no refresh token, just re-request)
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getContentToken(): Promise<string> {
  // Return cached if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const { authBaseUrl, clientId, clientSecret, apiBaseUrl } = getQfOAuthConfig();

  const res = await fetch(`${authBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: "grant_type=client_credentials&scope=content",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to get content token: ${res.status} ${err}`);
  }

  const data = await res.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.accessToken;
}

async function qfContentFetch(path: string): Promise<Response> {
  const { apiBaseUrl, clientId } = getQfOAuthConfig();
  const token = await getContentToken();
  const url = `${apiBaseUrl}${path}`;

  const res = await fetch(url, {
    headers: {
      "x-auth-token": token,
      "x-client-id": clientId,
    },
  });

  // On 401, clear cache, retry once
  if (res.status === 401) {
    cachedToken = null;
    const newToken = await getContentToken();
    return fetch(`${apiBaseUrl}${path}`, {
      headers: {
        "x-auth-token": newToken,
        "x-client-id": clientId,
      },
    });
  }

  return res;
}

// --- Content API helpers ---

export interface QfChapter {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_complex: string;
  name_arabic: string;
  verses_count: number;
  pages: number[];
  translated_name: { language_name: string; name: string };
}

export async function getChapters(language?: string): Promise<QfChapter[]> {
  const lang = language ? `?language=${language}` : "";
  const res = await qfContentFetch(`/api/v4/chapters${lang}`);
  if (!res.ok) throw new Error(`Failed to fetch chapters: ${res.status}`);
  const data = await res.json();
  return data.chapters;
}

export interface QfWord {
  id: number;
  position: number;
  audio_url: string;
  char_type_name: string;
  text_uthmani?: string;
  text?: string;
  translation: { text: string; language_name: string };
  transliteration: { text: string; language_name: string };
}

export interface QfTranslation {
  resource_id: number;
  text: string;
}

export interface QfVerse {
  id: number;
  verse_number: number;
  verse_key: string;
  text_uthmani: string;
  text_uthmani_simple: string;
  text_imlaei: string;
  text_imlaei_simple: string;
  words: QfWord[];
  translations?: QfTranslation[];
}

export async function getVersesByChapter(
  chapterNumber: number,
  options?: {
    page?: number;
    perPage?: number;
    translations?: string; // comma-separated resource IDs e.g. "131" for Sahih International
    language?: string;
    words?: boolean;
    fields?: string;
    translationFields?: string;
    wordFields?: string;
  }
): Promise<{ verses: QfVerse[]; pagination: { per_page: number; current_page: number; next_page: number | null; total_pages: number; total_records: number } }> {
  const params = new URLSearchParams();
  if (options?.page) params.set("page", String(options.page));
  if (options?.perPage) params.set("per_page", String(options.perPage));
  if (options?.translations) params.set("translations", options.translations);
  if (options?.language) params.set("language", options.language);
  if (options?.words !== undefined) params.set("words", String(options.words));
  if (options?.fields) params.set("fields", options.fields);
  if (options?.translationFields) params.set("translation_fields", options.translationFields);
  if (options?.wordFields) params.set("word_fields", options.wordFields);

  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await qfContentFetch(`/api/v4/verses/by_chapter/${chapterNumber}${query}`);
  if (!res.ok) throw new Error(`Failed to fetch verses: ${res.status}`);
  return res.json();
}

/**
 * Fetch translations from the PUBLIC Quran.com API (not authenticated).
 * The authenticated content API on prelive does not return translations,
 * so we fall back to the public API which always works.
 */
async function fetchPublicTranslations(
  chapterNumber: number,
  translationId: string = "20"
): Promise<Map<string, string>> {
  const translationMap = new Map<string, string>();
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${chapterNumber}?translations=${translationId}&translation_fields=text&fields=verse_key&per_page=50&page=${page}`
    );
    if (!res.ok) break;
    const data = await res.json();
    for (const v of data.verses) {
      if (v.translations?.[0]?.text) {
        translationMap.set(v.verse_key, v.translations[0].text);
      }
    }
    if (!data.pagination.next_page) break;
    page = data.pagination.next_page;
  }

  return translationMap;
}

// Fetch ALL verses for a chapter (handles pagination)
// Uses PUBLIC API (no auth) to ensure translation param is respected
export async function getAllVersesByChapter(
  chapterNumber: number,
  translations: string = "20" // 20 = Saheeh International
): Promise<QfVerse[]> {
  const allVerses: QfVerse[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("per_page", "50");
    params.set("translations", translations);
    params.set("words", "true");
    params.set("fields", "text_uthmani,text_imlaei_simple");
    params.set("translation_fields", "text");
    params.set("word_fields", "text_uthmani,text,char_type_name,translation");

    const res = await fetch(
      `https://api.quran.com/api/v4/verses/by_chapter/${chapterNumber}?${params.toString()}`
    );
    if (!res.ok) throw new Error(`Failed to fetch verses: ${res.status}`);
    const data = await res.json();
    allVerses.push(...data.verses);

    if (!data.pagination.next_page) break;
    page = data.pagination.next_page;
  }

  return allVerses;
}

// --- Audio / Reciters ---

export interface QfRecitation {
  id: number;
  reciter_name: string;
  style: string | null;
  translated_name: { language_name: string; name: string };
}

export async function getRecitations(language?: string): Promise<QfRecitation[]> {
  const lang = language ? `?language=${language}` : "";
  const res = await qfContentFetch(`/api/v4/resources/recitations${lang}`);
  if (!res.ok) throw new Error(`Failed to fetch recitations: ${res.status}`);
  const data = await res.json();
  return data.recitations;
}

export interface QfAudioFile {
  verse_key: string;
  url: string;
  segments?: number[][];
}

export async function getRecitationAudioFiles(
  recitationId: number,
  chapterNumber: number
): Promise<QfAudioFile[]> {
  const allFiles: QfAudioFile[] = [];
  let page = 1;

  while (true) {
    const res = await qfContentFetch(`/api/v4/recitations/${recitationId}/by_chapter/${chapterNumber}?fields=segments&per_page=50&page=${page}`);
    if (!res.ok) throw new Error(`Failed to fetch audio files: ${res.status}`);
    const data = await res.json();
    allFiles.push(...data.audio_files);

    if (!data.pagination?.next_page) break;
    page = data.pagination.next_page;
  }

  return allFiles;
}

export interface QfTimestamp {
  timestamp_from: number;
  timestamp_to: number;
}

export async function getAudioTimestamp(
  recitationId: number,
  options: { chapterNumber?: number; verseKey?: string }
): Promise<QfTimestamp> {
  const params = new URLSearchParams();
  if (options.chapterNumber) params.set("chapter_number", String(options.chapterNumber));
  if (options.verseKey) params.set("verse_key", options.verseKey);

  const res = await qfContentFetch(`/api/v4/audio/reciters/${recitationId}/timestamp_ranges?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch timestamp: ${res.status}`);
  const data = await res.json();
  return data.result;
}

// --- Translations list ---

export interface QfTranslationResource {
  id: number;
  name: string;
  author_name: string;
  language_name: string;
}

export async function getTranslationResources(language?: string): Promise<QfTranslationResource[]> {
  const lang = language ? `?language=${language}` : "";
  const res = await qfContentFetch(`/api/v4/resources/translations${lang}`);
  if (!res.ok) throw new Error(`Failed to fetch translations: ${res.status}`);
  const data = await res.json();
  return data.translations;
}

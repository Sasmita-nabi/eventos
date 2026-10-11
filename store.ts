import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createSeed } from "./seed";
import { ApiError } from "./errors";
import type { AppMeta, StoreData } from "./types";

const runtime = globalThis as typeof globalThis & { __eventosLock?: Promise<void>; __eventosInit?: Promise<void> };
const dataFile = () => process.env.EVENTOS_DATA_FILE || path.join(process.cwd(), "data", "state.json");
export const useSupabase = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function supabase(method: string, query: string, body?: unknown) {
  const response = await fetch(`${process.env.SUPABASE_URL!.replace(/\/$/, "")}/rest/v1/eventos_state${query}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json", Prefer: "return=representation",
    },
    ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    if (response.status === 409 && method === "POST") return [];
    throw new ApiError(503, `Supabase persistence failed (${response.status}). Check the server credentials and run docs/supabase.sql.`);
  }
  return response.json();
}
async function initialize() {
  if (useSupabase()) {
    const rows = await supabase("GET", "?id=eq.main&select=state,revision");
    if (!rows.length) await supabase("POST", "", { id: "main", revision: 0, state: createSeed() });
    return;
  }
  await mkdir(path.dirname(dataFile()), { recursive: true });
  try { await readFile(/*turbopackIgnore: true*/ dataFile(), "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(dataFile(), JSON.stringify(createSeed(), null, 2), { flag: "wx" }).catch(err => { if (err.code !== "EEXIST") throw err; });
  }
}
async function ensure() {
  if (!runtime.__eventosInit) runtime.__eventosInit = initialize().catch(error => { runtime.__eventosInit = undefined; throw error; });
  await runtime.__eventosInit;
}
export async function readStore(): Promise<StoreData> {
  await ensure();
  if (useSupabase()) {
    const rows = await supabase("GET", "?id=eq.main&select=state,revision");
    if (!rows[0]) throw new ApiError(503, "The EventOS state row is missing.");
    return { ...rows[0].state, revision: rows[0].revision };
  }
  return JSON.parse(await readFile(/*turbopackIgnore: true*/ dataFile(), "utf8"));
}
async function persist(data: StoreData, previousRevision: number) {
  if (useSupabase()) {
    const rows = await supabase("PATCH", `?id=eq.main&revision=eq.${previousRevision}`, { state: data, revision: data.revision, updated_at: new Date().toISOString() });
    if (!rows.length) throw new ApiError(409, "Another operation updated this event. Refresh and try again.");
  } else {
    const tmp = `${dataFile()}.${crypto.randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2));
    await rename(tmp, dataFile());
  }
}
/** Serializes local writes; Supabase also uses a cross-instance revision CAS. */
export async function mutateStore<T>(operation: (data: StoreData) => T | Promise<T>): Promise<{ result: T; data: StoreData }> {
  const previous = runtime.__eventosLock || Promise.resolve();
  let release!: () => void;
  runtime.__eventosLock = new Promise<void>(resolve => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    const data = await readStore();
    const before = JSON.stringify(data);
    const revision = data.revision;
    const result = await operation(data);
    if (before !== JSON.stringify(data)) {
      data.revision = revision + 1;
      await persist(data, revision);
    }
    return { result, data };
  } finally { release(); }
}
export function appMeta(): AppMeta {
  const required = ["NOTION_API_KEY", "NOTION_EVENTS_DATA_SOURCE_ID", "NOTION_TASKS_DATA_SOURCE_ID", "NOTION_RESOURCES_DATA_SOURCE_ID", "NOTION_PEOPLE_DATA_SOURCE_ID"];
  const missing = required.filter(key => !process.env[key]);
  return {
    persistence: useSupabase() ? "supabase" : "local", notionConfigured: missing.length === 0, notionMissing: missing,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY),
    aiProvider: process.env.GEMINI_API_KEY ? "Gemini" : process.env.OPENAI_API_KEY ? "OpenAI" : "Rule-based", demoMode: missing.length > 0,
  };
}

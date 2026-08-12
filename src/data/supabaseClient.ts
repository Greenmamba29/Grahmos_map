import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config";

/**
 * Null when Supabase env vars are not configured — the app then runs
 * entirely on the bundled demo dataset + IndexedDB (pure offline mode).
 */
export const supabase: SupabaseClient | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey)
    : null;

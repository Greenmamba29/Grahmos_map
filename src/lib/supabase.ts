import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, hasSupabase } from '@/lib/config';

/**
 * Null when Supabase is not configured, which is a supported mode: the app then
 * runs entirely on the IndexedDB snapshot and the bundled seed registry.
 */
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'resilience-maps' } },
    })
  : null;

export { hasSupabase };

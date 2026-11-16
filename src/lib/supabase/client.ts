import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { performanceFetch } from '@/lib/live/transport';
import { setMemorySession } from '@/lib/live/cache';

let observed: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  const client = createBrowserClient(supabaseUrl, supabaseAnonKey, { global: { fetch: performanceFetch } });
  if (typeof window !== 'undefined' && observed !== client) {
    observed = client;
    client.auth.onAuthStateChange((_event, session) => { setMemorySession(session?.user.id ?? null); });
  }
  return client;
}

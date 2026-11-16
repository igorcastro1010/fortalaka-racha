import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/roles";
import { isInvalidSession } from './session-error';

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user }, error: authError,
  } = await supabase.auth.getUser();

  if (authError && !isInvalidSession(authError)) throw new Error('A verificação de acesso está temporariamente indisponível. Tente novamente.');

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url, role, active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  if (error) throw new Error('A leitura do perfil está temporariamente indisponível. Tente novamente.');

  return { user, profile };
}

import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/auth/roles";

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, name, email, role, active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile };
}

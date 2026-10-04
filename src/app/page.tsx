import { redirect } from "next/navigation";
import { FortalakaApp } from "@/components/app/FortalakaApp";
import { getCurrentUserProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function HomePage() {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }

  const { user, profile } = await getCurrentUserProfile();

  if (!user || !profile) {
    redirect("/login");
  }

  if (!profile.active) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return <FortalakaApp profile={profile} />;
}

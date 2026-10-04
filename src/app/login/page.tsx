import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUserProfile } from "@/lib/auth/get-profile";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) {
    return <LoginForm initialError="Configure as variaveis do Supabase para entrar." />;
  }

  const { user, profile } = await getCurrentUserProfile();

  if (user && profile?.active) {
    redirect("/");
  }

  if (user && profile && !profile.active) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    return <LoginForm initialError="Seu acesso esta desativado. Procure um dos organizadores." />;
  }

  return <LoginForm />;
}

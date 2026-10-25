import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/SignupForm";
import { getCurrentUserProfile } from "@/lib/auth/get-profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function CadastroPage() {
  if (!isSupabaseConfigured()) {
    return <SignupForm initialError="O cadastro esta indisponivel no momento. Tente novamente mais tarde." />;
  }

  const { user, profile } = await getCurrentUserProfile();

  if (user && profile?.active) {
    redirect("/");
  }

  return <SignupForm />;
}

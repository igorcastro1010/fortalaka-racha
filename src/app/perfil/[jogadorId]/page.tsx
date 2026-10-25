import { redirect } from "next/navigation";
import { FortalakaApp } from "@/components/app/FortalakaApp";
import { getCurrentUserProfile } from "@/lib/auth/get-profile";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function PlayerPage({ params }: { params: Promise<{ jogadorId: string }> }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !profile?.active) redirect("/login");
  const { jogadorId } = await params;
  return <FortalakaApp profile={profile} initialPlayerId={jogadorId} />;
}

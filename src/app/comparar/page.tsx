import { PlayerComparison } from "@/components/players/PlayerComparison";
import { getCurrentUserProfile } from "@/lib/auth/get-profile";
import { isOrganizer } from "@/lib/auth/roles";
import { redirect } from "next/navigation";

export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { profile } = await getCurrentUserProfile();
  if (!profile?.active) redirect("/login");
  return <main className="mx-auto min-h-screen max-w-[640px] bg-background p-5 text-neutral-950"><PlayerComparison viewerId={profile.id} organizer={isOrganizer(profile)} initialA={typeof params.jogadorA === "string" ? params.jogadorA : ""} initialB={typeof params.jogadorB === "string" ? params.jogadorB : ""} /></main>;
}

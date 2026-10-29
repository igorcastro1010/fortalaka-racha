import { redirect, notFound } from 'next/navigation';
import { getCurrentUserProfile } from '@/lib/auth/get-profile';
import { createClient } from '@/lib/supabase/server';
import { validPlayerId } from '@/lib/players/public-profile';
import { NotificationRound } from '@/components/notifications/NotificationRound';

export default async function NotificationRoundPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.active) redirect('/login');
  const { id } = await params;
  if (!validPlayerId(id)) notFound();
  const { destino } = await searchParams;
  const client = await createClient();
  const { data, error } = await client.from('rachas').select('id').order('data', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Não foi possível consultar a rodada.');
  if (data?.id === id) redirect(`/?tab=${typeof destino === 'string' && ['racha','teams','results','evaluate'].includes(destino) ? destino : 'results'}`);
  return <main className="mx-auto min-h-screen max-w-[640px] bg-background p-5 text-neutral-950"><NotificationRound key={id} roundId={id} /></main>;
}

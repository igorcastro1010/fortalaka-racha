import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { getCurrentUserProfile } from '@/lib/auth/get-profile';
import { redirect } from 'next/navigation';

export default async function NotificationsPage() {
  const { profile } = await getCurrentUserProfile();
  if (!profile?.active) redirect('/login');
  return <main className="mx-auto min-h-screen max-w-[640px] bg-background p-5 text-neutral-950"><NotificationCenter /></main>;
}

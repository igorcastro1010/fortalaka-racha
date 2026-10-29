import { createClient } from '@/lib/supabase/client';

export type AppNotification = { id: string; round_id: string | null; title: string; body: string; destination: 'racha' | 'teams' | 'results' | 'evaluate' | 'profile'; created_at: string; read_at: string | null };
export const NOTIFICATIONS_PAGE_SIZE = 20;
export async function getNotifications(offset = 0) {
  const { data, error } = await createClient().from('notifications')
    .select('id,round_id,title,body,destination,created_at,read_at').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + NOTIFICATIONS_PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []) as AppNotification[];
  return { rows: rows.slice(0, NOTIFICATIONS_PAGE_SIZE), hasMore: rows.length > NOTIFICATIONS_PAGE_SIZE };
}
export async function getUnreadCount() {
  const { count, error } = await createClient().from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
export async function markNotificationsRead(ids: string[] | null = null) {
  const { error } = await createClient().rpc('marcar_notificacoes_lidas', { p_ids: ids });
  if (error) throw error;
}
export function notificationHref(notification: Pick<AppNotification, 'round_id' | 'destination'>) {
  return notification.destination === 'profile' || !notification.round_id ? `/?tab=${notification.destination}`
    : `/rodadas/${encodeURIComponent(notification.round_id)}?destino=${notification.destination}`;
}

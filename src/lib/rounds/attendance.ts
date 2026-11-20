import { createClient } from '@/lib/supabase/client';
import { invalidateLive } from '@/lib/live/refresh';

export type Attendance = { id: string; nome: string; avatar_url: string | null; presente: boolean | null; avaliacoes: number };

export async function getAttendance(roundId: string): Promise<Attendance[]> {
  const { data, error } = await createClient().rpc('ler_presencas_rodada', { p_racha: roundId });
  if (error) throw new Error('Não foi possível carregar as presenças.');
  return data ?? [];
}

export async function setAttendance(roundId: string, player: Attendance, present: boolean) {
  const { error } = await createClient().rpc('registrar_presenca', {
    p_racha: roundId, p_jogador: player.id, p_presente: present, p_avaliacoes_esperadas: player.avaliacoes,
  });
  if (error) {
    if (error.message.includes('PRESENCA_DESATUALIZADA')) throw new Error('As avaliações mudaram. Atualize as presenças e tente novamente.');
    if (error.message.includes('PRESENCA_COM_EVENTOS')) throw new Error('Este jogador tem gols ou assistências na rodada. Confira os eventos antes de registrar a falta.');
    throw new Error('Não foi possível registrar a presença. Tente novamente.');
  }
  invalidateLive(['round', 'ratings', 'statistics', 'matches']);
}

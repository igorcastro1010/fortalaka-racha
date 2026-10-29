import { createClient } from '@/lib/supabase/client';
import { getRoundHonours, type HonourMatch } from './achievements';

/** Leitura em lotes, sem consultas por jogador ou por partida. Não persiste totais. */
export async function getPlayerRoundHonours(playerId: string, signal?: AbortSignal) {
  const client = createClient();
  const rows: HonourMatch[] = [];
  const pageSize = 200;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('partidas')
      .select('id,racha_id,status,time_a_id,time_b_id,rachas!inner(estado),partida_jogadores(jogador_id,time_id,participou),eventos_partida(jogador_id,tipo,quantidade)')
      .eq('status', 'finalizada').eq('rachas.estado', 'finalizado').order('id').range(offset, offset + pageSize - 1).abortSignal(signal ?? new AbortController().signal);
    if (error) throw error;
    rows.push(...(data ?? []) as unknown as HonourMatch[]);
    if ((data?.length ?? 0) < pageSize) break;
  }
  return getRoundHonours(rows, playerId);
}

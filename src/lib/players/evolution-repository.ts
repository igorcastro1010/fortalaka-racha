import { createClient } from '@/lib/supabase/client';
import { withReadSignal } from '@/lib/live/read-signal';
import type { EvolutionSummary, HistoryPage, MatchHistory, RatingPoint, RoundHistory } from './evolution';

type Sections = { resumo: EvolutionSummary; partidas: HistoryPage<MatchHistory>; rodadas: HistoryPage<RoundHistory>; notas: HistoryPage<RatingPoint> };
export async function getPlayerEvolution<K extends keyof Sections>(playerId: string, section: K, page = 0, signal?: AbortSignal): Promise<Sections[K]> {
  const { data, error } = await withReadSignal(createClient().rpc('ler_evolucao_jogador', {
    p_jogador: playerId, p_secao: section, p_pagina: page,
  }), signal);
  if (error) throw new Error('Não foi possível carregar a evolução.');
  if (!data || (section === 'resumo' ? !data.stats || !data.overall || !data.marcos : !Array.isArray(data.items))) {
    throw new Error('Evolução indisponível.');
  }
  return data as Sections[K];
}

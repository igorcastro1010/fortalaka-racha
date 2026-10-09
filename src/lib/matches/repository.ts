import { createClient } from "@/lib/supabase/client";

export type PlayerStatistics = {
  jogador_id: string;
  nome: string;
  avatar_url: string | null;
  jogos: number;
  gols: number;
  assistencias: number;
  vitorias: number;
  nota_geral_100: number | null;
  quantidade_avaliacoes: number;
};
export type MatchPlayer = { jogador_id: string; nome: string; avatar_url: string | null; time_id: string; participou: boolean; gols: number; assistencias: number };
export type Match = {
  id: string;
  versao: number;
  timeAId: string;
  timeBId: string;
  timeA: string;
  timeB: string;
  placarA: number;
  placarB: number;
  status: "aberta" | "finalizada" | "cancelada";
  createdAt: string | null;
  finalizadaAt: string | null;
  jogadores: MatchPlayer[];
};
export type MatchesState = { times: { id: string; nome: string }[]; partidas: Match[] };

function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(error.code === "PGRST202" ? "Execute o SQL de partidas e estatísticas no Supabase." : error.message);
}
export async function getPlayerStatistics(playerId?: string): Promise<PlayerStatistics[]> {
  const { data, error } = await createClient().rpc("ler_estatisticas_jogadores", { p_jogador: playerId ?? null });
  check(error);
  return (data ?? []) as PlayerStatistics[];
}
export async function getRoundMatches(roundId: string): Promise<MatchesState> {
  const { data, error } = await createClient().rpc("ler_partidas_rodada", { p_racha: roundId });
  check(error);
  return data as MatchesState;
}
export async function createMatch(roundId: string, teamA: string, teamB: string) {
  const { data, error } = await createClient().rpc("criar_partida", { p_racha: roundId, p_time_a: teamA, p_time_b: teamB });
  check(error); return data as string;
}
export async function saveMatch(match: Match, status: Match["status"]) {
  const { data, error } = await createClient().rpc("salvar_partida", {
    p_partida: match.id, p_versao: match.versao, p_placar_a: match.placarA, p_placar_b: match.placarB, p_status: status,
    p_jogadores: match.jogadores.map(({ jogador_id, participou, gols, assistencias }) => ({ jogador_id, participou, gols, assistencias })),
  });
  check(error); return data as { aviso: string | null };
}

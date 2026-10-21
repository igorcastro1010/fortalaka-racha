import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrawTeam, TeamPlayer } from "@/lib/teams/draw";
import { getCurrentRoundDetails } from "@/lib/rounds/repository";

export type RoundParticipant = TeamPlayer & {
  jogadorId: string | null;
  type: "goleiro" | "linha" | "suplente";
  status: "confirmado" | "ausente" | "removido";
};

export type RoundStatus = "aberto" | "lista_fechada" | "times_confirmados" | "em_andamento" | "finalizado";

export type RoundTeamsState = {
  roundId: string;
  roundName: string;
  status: RoundStatus;
  goalkeepers: RoundParticipant[];
  fieldPlayers: RoundParticipant[];
  teams: DrawTeam[];
  confirmed: boolean;
  version: number;
};

function checkError(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (error.code === "PGRST202" || error.message.includes("versao")) {
    throw new Error("Instale o SQL de validação do sorteio no Supabase antes de continuar.");
  }
  throw new Error(error.message);
}

export async function getCurrentRoundTeamsState(supabase: SupabaseClient): Promise<RoundTeamsState | null> {
  const round = await getCurrentRoundDetails(supabase);
  if (!round) return null;
  const { data, error } = await supabase.rpc("ler_times_rodada", {});
  checkError(error);
  const state = data as RoundTeamsState | null;
  if (!state || state.roundId !== round.roundId || state.status !== round.status) {
    throw new Error("A rodada mudou durante a consulta. Atualize os times e tente novamente.");
  }
  return {
    ...state,
    fieldPlayers: round.participants.filter(player => player.status === "confirmado" && player.type !== "suplente"),
  };
}

export async function saveDraftTeams(supabase: SupabaseClient, roundId: string, teams: DrawTeam[], version: number) {
  const { error } = await supabase.rpc("salvar_rascunho_times", {
    p_racha: roundId, p_versao: version,
    p_times: teams.map((t) => ({ numero: t.number, nome: t.name, jogadores: t.players.map((p) => p.id), goleiro: t.goalkeeper?.id ?? null })),
  });
  checkError(error);
}

export async function confirmTeams(supabase: SupabaseClient, roundId: string, version: number) {
  const { error } = await supabase.rpc("confirmar_rascunho_times", { p_racha: roundId, p_versao: version });
  checkError(error);
}

export async function updateRoundStatus(supabase: SupabaseClient, roundId: string, status: RoundStatus) {
  const { error } = await supabase.rpc("alterar_estado_rodada", { p_racha: roundId, p_estado: status });
  checkError(error);
}

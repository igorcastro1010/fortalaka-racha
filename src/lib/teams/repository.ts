import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrawTeam, TeamPlayer } from "@/lib/teams/draw";

export type RoundParticipant = TeamPlayer & {
  jogadorId: string | null;
  type: "goleiro" | "linha" | "suplente";
  status: "confirmado" | "ausente" | "removido";
};

export type RoundStatus = "aberto" | "lista_fechada" | "times_confirmados" | "finalizado";

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
  const { data, error } = await supabase.rpc("ler_times_rodada", {});
  checkError(error);
  return data as RoundTeamsState | null;
}

export async function saveDraftTeams(supabase: SupabaseClient, roundId: string, teams: DrawTeam[], version: number) {
  const { error } = await supabase.rpc("salvar_rascunho_times", {
    p_racha: roundId, p_versao: version,
    p_times: teams.map((t) => ({ numero: t.number, nome: t.name, jogadores: t.players.map((p) => p.id) })),
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

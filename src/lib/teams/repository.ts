import { createClient } from "@/lib/supabase/client";
import type { DrawTeam, Participant, Round, RoundDetail } from "./draw";

function databaseError(error: { code?: string; message: string }) {
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code ?? "")) {
    return new Error("A estrutura do sorteio ainda não foi instalada no Supabase. Execute o SQL de sorteio para habilitar esta tela.");
  }
  return new Error(error.message);
}

export async function listRounds(): Promise<Round[]> {
  const { data, error } = await createClient().from("rodadas")
    .select("id,nome,data,versao,confirmado").order("data", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (error) throw databaseError(error);
  return data ?? [];
}

export async function loadRound(id: string): Promise<RoundDetail> {
  // RPC fornece um snapshot consistente e impede leitura de times não confirmados por jogadores.
  const { data, error } = await createClient().rpc("ler_sorteio", { p_rodada: id });
  if (error) throw databaseError(error);
  return data as RoundDetail;
}

export async function createRound(nome: string, data: string): Promise<string> {
  const result = await createClient().rpc("criar_rodada", { p_nome: nome.trim(), p_data: data });
  if (result.error) throw databaseError(result.error);
  return result.data as string;
}

export async function saveParticipants(round: Round, participants: Participant[]) {
  const { error } = await createClient().rpc("salvar_participantes", {
    p_rodada: round.id, p_versao: round.versao, p_participantes: participants,
  });
  if (error) throw databaseError(error);
}

export async function confirmTeams(round: Round, teams: DrawTeam[]) {
  const { error } = await createClient().rpc("confirmar_times", {
    p_rodada: round.id, p_versao: round.versao, p_times: teams,
  });
  if (error) throw databaseError(error);
}

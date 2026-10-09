import { createClient } from "@/lib/supabase/client";

export type EvaluationPlayer = {
  jogador_id: string;
  nome: string;
  avatar_url: string | null;
  avaliado: boolean;
  passe: number | null;
  chute: number | null;
  velocidade: number | null;
  defesa: number | null;
  fisico: number | null;
};

export type EvaluationState = {
  roundId: string;
  roundName: string;
  roundStatus: string;
  open: boolean;
  canEvaluate: boolean;
  teamId: string | null;
  players: EvaluationPlayer[];
};

export type EvaluationProgress = {
  total: number;
  respondentes: number;
  abertas: boolean;
};

export type EvaluationScores = {
  passe: number;
  chute: number;
  velocidade: number;
  defesa: number;
  fisico: number;
};

function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(error.code === "PGRST202" ? "Execute o SQL de avaliacoes no Supabase." : error.message);
}

export async function getEvaluationState(): Promise<EvaluationState | null> {
  const { data, error } = await createClient().rpc("ler_avaliacoes_rodada");
  check(error);
  return data as EvaluationState | null;
}

export async function saveEvaluation(roundId: string, playerId: string, scores: EvaluationScores) {
  const { error } = await createClient().rpc("salvar_avaliacao", {
    p_racha: roundId,
    p_avaliado: playerId,
    p_passe: scores.passe,
    p_chute: scores.chute,
    p_velocidade: scores.velocidade,
    p_defesa: scores.defesa,
    p_fisico: scores.fisico,
  });
  check(error);
}

export async function getEvaluationProgress(roundId: string): Promise<EvaluationProgress> {
  const { data, error } = await createClient().rpc("ler_progresso_avaliacoes", { p_racha: roundId });
  check(error);
  return data as EvaluationProgress;
}

export async function setRoundEvaluationsOpen(roundId: string, open: boolean): Promise<EvaluationProgress> {
  const { data, error } = await createClient().rpc("alterar_avaliacoes_rodada", { p_racha: roundId, p_abertas: open });
  check(error);
  return data as EvaluationProgress;
}

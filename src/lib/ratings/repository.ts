import { createClient } from "@/lib/supabase/client";
import { withReadSignal } from '@/lib/live/read-signal';

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

export type EvaluationPending = { id: string; nome: string; avatar_url: string | null; respondidas: number; total: number };

export async function getEvaluationPending(roundId: string, signal?: AbortSignal): Promise<EvaluationPending[]> {
  const { data, error } = await withReadSignal(createClient().rpc("ler_pendencias_avaliacoes", { p_racha: roundId }), signal);
  check(error);
  return (data ?? []) as EvaluationPending[];
}

export type EvaluationScores = {
  passe: number;
  chute: number;
  velocidade: number;
  defesa: number;
  fisico: number;
};

export type EvaluationDetail = {
  avaliador_id: string; avaliador_nome: string; avaliador_avatar: string | null;
  avaliado_id: string; avaliado_nome: string; avaliado_avatar: string | null;
  avaliado: boolean; updated_at: string | null;
} & { [K in keyof EvaluationScores]: number | null };

export async function getEvaluationDetails(roundId: string, signal?: AbortSignal): Promise<EvaluationDetail[]> {
  const { data, error } = await withReadSignal(createClient().rpc('ler_detalhes_avaliacoes', { p_racha: roundId }), signal);
  if (error) throw new Error('Não foi possível carregar os detalhes das avaliações.');
  return (data ?? []) as EvaluationDetail[];
}

export async function getEvaluationRounds(signal?: AbortSignal): Promise<{ id: string; nome: string; data: string | null }[]> {
  const { data, error } = await withReadSignal(createClient().from('rachas').select('id,nome,data').order('data', { ascending: false }).limit(100), signal);
  if (error) throw new Error('Não foi possível carregar as rodadas.');
  return data ?? [];
}

function check(error: { message: string; code?: string } | null) {
  if (error) throw new Error(error.code === "PGRST202" ? "Execute o SQL de avaliacoes no Supabase." : error.message);
}

export async function getEvaluationState(roundId?: string, signal?: AbortSignal): Promise<EvaluationState | null> {
  const { data, error } = await withReadSignal(createClient().rpc("ler_avaliacoes_atual", { p_racha: roundId ?? null }), signal);
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

export async function getEvaluationProgress(roundId: string, signal?: AbortSignal): Promise<EvaluationProgress> {
  const { data, error } = await withReadSignal(createClient().rpc("ler_progresso_avaliacoes", { p_racha: roundId }), signal);
  check(error);
  return data as EvaluationProgress;
}

export async function setRoundEvaluationsOpen(roundId: string, open: boolean): Promise<EvaluationProgress> {
  const { data, error } = await createClient().rpc("alterar_avaliacoes_rodada", { p_racha: roundId, p_abertas: open });
  check(error);
  return data as EvaluationProgress;
}

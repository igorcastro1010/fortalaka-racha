import { readMemory } from './cache';
import { createClient } from '@/lib/supabase/client';
import { getCurrentRoundDetails } from '@/lib/rounds/repository';
import { getRoundMatches } from '@/lib/matches/repository';
import { withReadSignal } from './read-signal';
import { getEvaluationState, getEvaluationProgress, getEvaluationPending } from '@/lib/ratings/repository';

export const ROUND_DOMAINS = ['round', 'profile', 'payments'] as const;
export async function readRoundView(signal?: AbortSignal, client = createClient()) {
  return retryView(() => readMemory('current-round', ROUND_DOMAINS, next => getCurrentRoundDetails(client, next), signal), signal);
}
export function readMatchesView(id: string, signal?: AbortSignal) {
  return retryView(() => readMemory(`matches:${id}`, ['matches'], next => getRoundMatches(id, next), signal), signal);
}

export async function readAvatarView(id: string, signal?: AbortSignal) {
  return retryView(() => readMemory(`avatar:${id}`, ['profile'], async next => {
    const { data, error } = await withReadSignal(createClient().from('profiles').select('avatar_url').eq('id', id).single(), next);
    if (error) throw new Error('Não foi possível carregar sua foto.');
    return (data?.avatar_url ?? null) as string | null;
  }, signal), signal);
}

export function readEvaluationView(id?: string, signal?: AbortSignal) {
  return retryView(() => readMemory(`evaluations:${id ?? 'current'}`, ['round', 'ratings', 'teams', 'matches'], next => getEvaluationState(id, next), signal), signal);
}
export function readEvaluationProgressView(id: string, signal?: AbortSignal) {
  return retryView(() => readMemory(`evaluation-progress:${id}`, ['round', 'ratings'], next => getEvaluationProgress(id, next), signal), signal);
}
export function readEvaluationPendingView(id: string, signal?: AbortSignal) {
  return retryView(() => readMemory(`evaluation-pending:${id}`, ['round', 'ratings'], next => getEvaluationPending(id, next), signal), signal);
}

export async function retryView<T>(load: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  for (;;) {
    try { return await load(); }
    catch (error) { if (signal?.aborted || !(error instanceof Error) || error.name !== 'AbortError') throw error; }
  }
}

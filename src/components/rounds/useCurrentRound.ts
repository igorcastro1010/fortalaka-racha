"use client";

import { useViewData } from '@/components/live/useViewData';
import { getCurrentRoundDetails } from '@/lib/rounds/repository';
import { createClient } from '@/lib/supabase/client';
import { ROUND_DOMAINS } from '@/lib/live/reads';

export function useCurrentRound(live = true) {
  const state = useViewData('current-round', ROUND_DOMAINS, signal => getCurrentRoundDetails(createClient(), signal), live);
  return { round: state.data, loading: state.loading, error: state.error, retry: state.reload };
}

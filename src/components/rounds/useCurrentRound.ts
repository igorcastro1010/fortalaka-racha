"use client";

import { useCallback, useEffect, useState } from "react";
import { getCurrentRoundDetails, type RoundDetails } from "@/lib/rounds/repository";
import { createClient } from "@/lib/supabase/client";
import { useLiveRefresh } from '@/components/live/useLiveRefresh';

export function useCurrentRound(live = true) {
  const [round, setRound] = useState<RoundDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(value => value + 1), []);
  useLiveRefresh(async isCurrent => {
    const data = await getCurrentRoundDetails(createClient());
    if (isCurrent()) {
      setRound(current => JSON.stringify(current) === JSON.stringify(data) ? current : data);
      setError(''); setLoading(false);
    }
  }, live && !loading);

  useEffect(() => {
    let active = true;
    async function read() {
      setLoading(true);
      setError("");
      try {
        const data = await getCurrentRoundDetails(createClient());
        if (active) setRound(data);
      } catch {
        if (active) setError("Não foi possível carregar a rodada.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void read();
    return () => { active = false; };
  }, [revision]);

  return { round, loading, error, retry };
}

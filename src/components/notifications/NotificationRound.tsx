"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getHistoricalRound, type HistoricalRound } from '@/lib/results/round-history';
import { PostRoundSummary } from '@/components/results/PostRoundSummary';

export function NotificationRound({ roundId }: { roundId: string }) {
  const [data, setData] = useState<HistoricalRound | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    getHistoricalRound(roundId).then(result => { if (active) { setData(result); setError(''); } })
      .catch(() => { if (active) setError('Esta rodada não está disponível no histórico. Volte ao app para consultar a rodada atual.'); });
    return () => { active = false; };
  }, [roundId, attempt]);
  return <section className="space-y-4"><Link href="/notificacoes" className="fk-secondary">← Voltar aos avisos</Link><h1 className="text-3xl font-black">Rodada do aviso</h1>{!data && !error && <p role="status">Carregando rodada...</p>}{error && <div role="alert"><p>{error}</p><button className="fk-secondary mt-3" onClick={() => setAttempt(n => n + 1)}>Tentar novamente</button></div>}{data && <PostRoundSummary roundId={roundId} date={data.round.data} matches={data.matches} historical participants={data.participants} />}</section>;
}

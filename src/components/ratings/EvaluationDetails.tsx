"use client";

import { useEffect, useState } from 'react';
import { PlayerIdentity } from '@/components/players/PlayerIdentity';
import { LoadingCards } from '@/components/ui/ScreenState';
import { getEvaluationDetails, getEvaluationRounds, type EvaluationDetail } from '@/lib/ratings/repository';
import { subscribeLiveRefresh } from '@/lib/live/refresh';

const criteria = [['passe', 'Passe'], ['chute', 'Chute'], ['velocidade', 'Velocidade'], ['defesa', 'Defesa'], ['fisico', 'Físico']] as const;

export function EvaluationDetails({ roundId }: { roundId: string }) {
  const [open, setOpen] = useState(false);
  return <details className="min-w-0 border-t border-zinc-200" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-12 cursor-pointer content-center font-bold">Detalhes das avaliações</summary>
    {open && <DetailContent roundId={roundId} />}
  </details>;
}

function DetailContent({ roundId }: { roundId: string }) {
  const [selected, setSelected] = useState(roundId);
  const [rounds, setRounds] = useState<Awaited<ReturnType<typeof getEvaluationRounds>>>([]);
  const [rows, setRows] = useState<EvaluationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roundError, setRoundError] = useState('');
  const [retry, setRetry] = useState(0);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void getEvaluationRounds(controller.signal).then(data => {
      if (!controller.signal.aborted) { setRounds(data); setRoundError(''); }
    }).catch(() => { if (!controller.signal.aborted) setRoundError('Não foi possível carregar as rodadas.'); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    let sequence = 0;
    async function load() {
      const request = ++sequence;
      // Keep expanded rows mounted during background refresh to preserve scroll.
      setError('');
      try {
        const data = await getEvaluationDetails(selected, controller.signal);
        if (!controller.signal.aborted && request === sequence) setRows(data);
      } catch {
        if (!controller.signal.aborted && request === sequence) { setRows([]); setError('Não foi possível carregar as notas. Tente novamente.'); }
      } finally {
        if (!controller.signal.aborted && request === sequence) setLoading(false);
      }
    }
    void load();
    const unsubscribe = subscribeLiveRefresh(load, ['ratings', 'round', 'teams', 'matches', 'profile'], false);
    return () => { controller.abort(); unsubscribe(); };
  }, [selected, retry]);

  const senders = [...new Map(rows.map(row => [row.avaliador_id, row.avaliador_nome])).entries()];
  const recipients = [...new Map(rows.map(row => [row.avaliado_id, row.avaliado_nome])).entries()];
  const visible = rows.filter(row => (!sender || row.avaliador_id === sender) && (!recipient || row.avaliado_id === recipient));
  const groups = [...new Set(visible.map(row => row.avaliador_id))].map(id => visible.filter(row => row.avaliador_id === id));
  return <div className="min-w-0 space-y-4 pb-4">
    <label className="block text-sm font-bold">Rodada
      <select value={selected} onChange={event => { setSelected(event.target.value); setRows([]); setLoading(true); setSender(''); setRecipient(''); }} className="mt-1 min-h-12 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-3">
        {!rounds.some(round => round.id === roundId) && <option value={roundId}>Rodada atual</option>}
        {rounds.map(round => <option key={round.id} value={round.id}>{round.data ? round.data.split('-').reverse().join('/') : 'Sem data'} · {round.nome}</option>)}
      </select>
    </label>
    {roundError && <p role="alert" className="text-sm text-red-700">{roundError}</p>}
    {loading ? <LoadingCards label="Carregando notas..." /> : error ? <p role="alert" className="text-sm text-red-700">{error}</p> : <>
      {rows.length > 0 && <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-bold">Quem avaliou<select value={sender} onChange={event => setSender(event.target.value)} className="mt-1 min-h-12 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2"><option value="">Todos</option>{senders.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label className="min-w-0 text-sm font-bold">Quem recebeu<select value={recipient} onChange={event => setRecipient(event.target.value)} className="mt-1 min-h-12 w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2"><option value="">Todos</option>{recipients.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      </div>}
      {groups.length === 0 && <p className="py-3 text-sm text-zinc-600">Nenhuma avaliação encontrada para esta seleção.</p>}
      {groups.map(group => <details key={`${selected}:${group[0].avaliador_id}`} className="min-w-0 border-b border-zinc-200">
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-bold"><span className="break-words">{group[0].avaliador_nome}</span><span className="ml-2 text-xs font-normal text-zinc-600">{group.filter(row => row.avaliado).length}/{group.length} enviadas</span></summary>
        <ul className="divide-y divide-zinc-100">{group.map(row => <li key={row.avaliado_id} className="min-w-0 space-y-3 py-3">
          <PlayerIdentity playerId={row.avaliado_id} name={row.avaliado_nome} avatarUrl={row.avaliado_avatar} size="sm" className="min-w-0 text-sm font-bold" />
          {row.avaliado ? <dl className="grid grid-cols-3 gap-x-2 gap-y-3">{criteria.map(([key, label]) => <div key={key} className="min-w-0"><dt className="text-xs text-zinc-600">{label}</dt><dd className="text-lg font-black tabular-nums">{row[key]}<span className="text-xs font-normal text-zinc-500"> / 5</span></dd></div>)}</dl> : <p className="text-sm font-bold text-zinc-500">Pendente</p>}
        </li>)}</ul>
      </details>)}
    </>}
    {(error || roundError) && <button onClick={() => { setLoading(rows.length === 0); setRetry(value => value + 1); }} className="fk-secondary min-h-12 rounded-lg border border-zinc-300 px-4 font-bold">Tentar novamente</button>}
  </div>;
}

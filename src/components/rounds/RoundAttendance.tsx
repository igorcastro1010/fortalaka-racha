"use client";

import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { PlayerIdentity } from '@/components/players/PlayerIdentity';
import { useConfirmation } from '@/components/ui/useConfirmation';
import { getAttendance, setAttendance, type Attendance } from '@/lib/rounds/attendance';

export function RoundAttendance({ roundId }: { roundId: string }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const { confirm, confirmationDialog } = useConfirmation();
  useEffect(() => {
    if (!open) return;
    let active = true;
    getAttendance(roundId).then(data => { if (active) setPlayers(data); })
      .catch(() => { if (active) setError('Não foi possível carregar as presenças.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, roundId, retry]);

  async function change(player: Attendance, present: boolean) {
    if (saving.current || player.presente === present) return;
    saving.current = true;
    setBusy(true); setMessage(''); setError('');
    try {
      if (!present && !await confirm({ title: `Registrar falta de ${player.nome}?`, description: `${player.avaliacoes} avaliações enviadas ou recebidas serão invalidadas e arquivadas. A falta não gera nota zero. Pagamentos e placares serão preservados.` })) return;
      await setAttendance(roundId, player, present);
      setPlayers(await getAttendance(roundId));
      setMessage(present ? 'Presença registrada.' : 'Falta registrada.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a presença.'); }
    finally { saving.current = false; setBusy(false); }
  }

  return <section className="fk-section">
    <details onToggle={event => { const expanded = event.currentTarget.open; if (expanded === open) return; if (expanded) { setLoading(true); setError(''); } setOpen(expanded); }}>
      <summary className="min-h-11 cursor-pointer content-center font-bold">Presença dos jogadores</summary>
      {open && <div aria-busy={loading || busy}>
        {loading ? <p role="status" className="py-3 text-sm">Carregando presenças...</p> : players.map(player => <div key={player.id} className="border-b border-zinc-200 py-3">
          <PlayerIdentity playerId={player.id} name={player.nome} avatarUrl={player.avatar_url} size="md" />
          <p className="mt-2 text-sm text-zinc-600">{player.presente === null ? 'Não conferida' : player.presente ? 'Presente' : 'Faltou'}</p>
          <div role="group" aria-label={`Presença de ${player.nome}`} className="mt-2 grid grid-cols-2 gap-2">
            {[true, false].map(present => {
              const label = present ? 'Presente' : 'Faltou';
              const Icon = present ? Check : X;
              return <button key={label} type="button" aria-label={`${label}: ${player.nome}`} aria-pressed={player.presente === present} aria-disabled={busy} onClick={() => void change(player, present)} className={`flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 aria-disabled:opacity-60 ${player.presente === present ? 'border-red-700 bg-red-50 text-red-700' : 'border-zinc-300 bg-white text-zinc-700'}`}><Icon size={18} aria-hidden="true" />{label}</button>;
            })}
          </div>
        </div>)}
        {!loading && !error && players.length === 0 && <p className="py-3 text-sm">Nenhum jogador nesta rodada.</p>}
        {error && <div role="alert" className="py-3 text-sm text-red-700">{error}<button className="fk-secondary mt-2" disabled={busy || loading} onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}>Atualizar presenças</button></div>}
        <p role="status" className="min-h-12 py-3 text-sm">{message}</p>
      </div>}
    </details>
    {confirmationDialog}
  </section>;
}

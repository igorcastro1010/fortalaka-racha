"use client";

import { useEffect, useState } from 'react';
import { PlayerIdentity } from '@/components/players/PlayerIdentity';
import { useConfirmation } from '@/components/ui/useConfirmation';
import { getAttendance, setAttendance, type Attendance } from '@/lib/rounds/attendance';

export function RoundAttendance({ roundId }: { roundId: string }) {
  const [open, setOpen] = useState(false);
  const [players, setPlayers] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (busy || player.presente === present) return;
    setBusy(true); setMessage(''); setError('');
    try {
      if (!present && !await confirm({ title: `Registrar falta de ${player.nome}?`, description: `${player.avaliacoes} avaliações enviadas ou recebidas serão invalidadas e arquivadas. A falta não gera nota zero. Pagamentos e placares serão preservados.` })) return;
      await setAttendance(roundId, player, present);
      setPlayers(await getAttendance(roundId));
      setMessage(present ? 'Presença registrada.' : 'Falta registrada. Avaliações invalidadas quando existentes.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar a presença.'); }
    finally { setBusy(false); }
  }

  return <section className="fk-section">
    <details onToggle={event => { const expanded = event.currentTarget.open; if (expanded === open) return; if (expanded) { setLoading(true); setError(''); } setOpen(expanded); }}>
      <summary className="min-h-11 cursor-pointer content-center font-bold">Presença dos jogadores</summary>
      {open && <div aria-busy={loading || busy}>
        {loading ? <p role="status" className="py-3 text-sm">Carregando presenças...</p> : players.map(player => <div key={player.id} className="border-b border-zinc-200 py-3">
          <PlayerIdentity playerId={player.id} name={player.nome} avatarUrl={player.avatar_url} size="md" />
          <label className="mt-2 block text-sm">Presença de {player.nome}
            <select className="fk-field mt-1 w-full" value={player.presente === null ? '' : player.presente ? 'presente' : 'faltou'} disabled={busy} onChange={event => void change(player, event.target.value === 'presente')}>
              <option value="" disabled>Não conferida</option><option value="presente">Presente</option><option value="faltou">Faltou</option>
            </select>
          </label>
        </div>)}
        {!loading && !error && players.length === 0 && <p className="py-3 text-sm">Nenhum jogador nesta rodada.</p>}
        {error && <div role="alert" className="py-3 text-sm text-red-700">{error}<button className="fk-secondary mt-2" disabled={busy || loading} onClick={() => { setLoading(true); setError(''); setRetry(value => value + 1); }}>Atualizar presenças</button></div>}
        {message && <p role="status" className="py-3 text-sm">{message}</p>}
      </div>}
    </details>
    {confirmationDialog}
  </section>;
}

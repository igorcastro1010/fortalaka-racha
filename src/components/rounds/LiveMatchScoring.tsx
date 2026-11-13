"use client";

import { useRef, useState } from "react";
import { Check, Minus, Plus, Undo2 } from "lucide-react";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { getRoundMatches, saveMatch, type Match, type MatchesState } from "@/lib/matches/repository";

export function LiveMatchScoring({ match, roundId, disabled, roundClosed, onSaved, onFinish, onClose, onCancel, onGoalLimit, penaltyRequired, penaltyWinner, onPenaltyWinner }: {
  match: Match; roundId: string; disabled: boolean; roundClosed: boolean;
  onSaved: (state: MatchesState) => void; onFinish: () => void; onClose: () => void; onCancel: () => void;
  onGoalLimit: (name: string) => void;
  penaltyRequired: boolean; penaltyWinner: string; onPenaltyWinner: (id: string) => void;
}) {
  const [team, setTeam] = useState(match.timeAId);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState<{ before: Match; version: number } | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const blocked = busy || disabled || Boolean(error);
  const teams = [{ id: match.timeAId, label: match.timeA, score: "placarA" as const }, { id: match.timeBId, label: match.timeB, score: "placarB" as const }];

  async function persist(next: Match, label: string, reversing = false) {
    if (lock.current || disabled || error) return;
    lock.current = true; setBusy(true); setNotice("");
    try {
      await saveMatch(next, match.status);
      const data = await getRoundMatches(roundId);
      const updated = data.partidas.find(item => item.id === match.id);
      onSaved(data);
      // A second organizer may have edited between the write and this read.
      const ownVersion = updated?.status === match.status && updated.versao === match.versao + 1;
      setUndo(!reversing && ownVersion ? { before: structuredClone(match), version: updated.versao } : null);
      setNotice(ownVersion ? label : "Partida atualizada. Confira os lançamentos.");
      const hit = teams.find(item => match[item.score] === 1 && next[item.score] === 2);
      if (match.status === "aberta" && !roundClosed && hit && ownVersion) onGoalLimit(hit.label);
    } catch (e) {
      console.error("Falha no lançamento ao vivo", e);
      setUndo(null);
      setError("Não foi possível confirmar o lançamento. Atualize a partida antes de continuar.");
    } finally { lock.current = false; setBusy(false); }
  }

  async function reload() {
    if (lock.current || disabled) return;
    lock.current = true; setBusy(true);
    try { onSaved(await getRoundMatches(roundId)); setUndo(null); setError(""); setNotice("Partida atualizada."); }
    catch (e) { console.error("Falha ao reler partida", e); setError("Não foi possível atualizar a partida. Tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }

  function event(playerId: string, field: "gols" | "assistencias", delta: number) {
    const player = match.jogadores.find(item => item.jogador_id === playerId);
    if (!player?.participou || player[field] + delta < 0) return;
    const next = { ...match, jogadores: match.jogadores.map(item => item.jogador_id === playerId ? { ...item, [field]: item[field] + delta } : item) };
    void persist(next, `${field === "gols" ? "Gol" : "Assistência"} de ${player.nome} ${delta > 0 ? (field === "gols" ? "registrado" : "registrada") : (field === "gols" ? "corrigido" : "corrigida")}.`);
  }

  return <section aria-label={match.status === "aberta" ? "Súmula ao vivo" : "Editar resultado"} className="min-w-0 space-y-4" aria-busy={busy}>
    <div className="flex items-center justify-between gap-2 border-b border-zinc-200 pb-3">
      <h3 className="text-xl font-black">{match.status === "aberta" ? "Súmula ao vivo" : "Editar resultado"}</h3><span className="text-xs font-bold text-red-700">{{ aberta: "EM ANDAMENTO", finalizada: "FINALIZADA", cancelada: "CANCELADA" }[match.status]}</span>
    </div>
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
      {teams.map((item, index) => <div key={item.id} className={index ? "col-start-3 row-start-1 text-center" : "col-start-1 row-start-1 text-center"}>
        <p className="min-h-10 break-words text-sm font-bold">{item.label}</p>
        <p className="py-2 text-5xl font-black tabular-nums">{match[item.score]}</p>
        <div className="flex justify-center gap-3">
          <button disabled={blocked || match[item.score] === 0} title={`Diminuir placar de ${item.label}`} aria-label={`Diminuir placar de ${item.label}`} onClick={() => void persist({ ...match, [item.score]: match[item.score] - 1 }, "Placar atualizado.")} className="flex h-11 w-11 items-center justify-center border border-zinc-300 disabled:opacity-40"><Minus size={18} /></button>
          <button disabled={blocked} title={`Aumentar placar de ${item.label}`} aria-label={`Aumentar placar de ${item.label}`} onClick={() => void persist({ ...match, [item.score]: match[item.score] + 1 }, "Placar atualizado.")} className="flex h-11 w-11 items-center justify-center bg-zinc-950 text-white disabled:opacity-40"><Plus size={18} /></button>
        </div>
      </div>)}
      <span className="col-start-2 row-start-1 text-xl text-zinc-500">×</span>
    </div>
    <ViewTabs label="Time em lançamento" value={team} onChange={setTeam} items={teams} />
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_64px_64px] gap-2 border-b border-zinc-200 py-2 text-xs font-bold"><span>Jogador</span><span className="text-center">Gols</span><span className="text-center">Assist.</span></div>
      {match.jogadores.filter(player => player.time_id === team && player.participou).map(player => <div key={player.jogador_id} className="grid grid-cols-[minmax(0,1fr)_64px_64px] items-center gap-2 border-b border-zinc-200 py-3">
        <PlayerIdentity playerId={player.jogador_id} name={player.nome} avatarUrl={player.avatar_url} size="sm" className="min-w-0 text-sm font-bold" />
        {(["gols", "assistencias"] as const).map(field => <div key={field} className="flex flex-wrap items-center justify-end">
          <span className="w-5 text-center text-sm font-bold tabular-nums">{player[field]}</span>
          <button disabled={blocked} title={`Adicionar ${field === "gols" ? "gol" : "assistência"}`} aria-label={`Adicionar ${field} de ${player.nome}`} onClick={() => event(player.jogador_id, field, 1)} className="flex h-11 w-11 items-center justify-center rounded bg-red-700 text-white disabled:opacity-40"><Plus size={19} /></button>
          {correcting && <button disabled={blocked || !player[field]} title="Remover um lançamento" aria-label={`Diminuir ${field} de ${player.nome}`} onClick={() => event(player.jogador_id, field, -1)} className="mt-1 flex h-11 w-11 items-center justify-center rounded border border-zinc-300 disabled:opacity-40"><Minus size={18} /></button>}
        </div>)}
      </div>)}
      {!match.jogadores.some(player => player.time_id === team && player.participou) && <p className="py-3 text-sm text-zinc-600">Nenhum participante neste time.</p>}
    </div>
    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={correcting} onChange={e => setCorrecting(e.target.checked)} className="h-5 w-5 accent-red-700" />Corrigir lançamentos</label>
    <details className="border-y border-zinc-200 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">Ajustar participantes</summary>
      {match.jogadores.map(player => <label key={player.jogador_id} className="flex min-h-12 items-center justify-between gap-3 border-t border-zinc-100 py-2 text-sm">
        <span className="min-w-0 break-words">{player.nome}</span><input aria-label={`Participação de ${player.nome}`} type="checkbox" className="h-5 w-5 shrink-0 accent-red-700" disabled={blocked || roundClosed || (player.participou && player.gols + player.assistencias > 0)} checked={player.participou} onChange={e => void persist({ ...match, jogadores: match.jogadores.map(item => item.jogador_id === player.jogador_id ? { ...item, participou: e.target.checked } : item) }, "Participação atualizada.")} />
      </label>)}
    </details>
    {busy && <p role="status" className="text-sm font-semibold">Salvando lançamento...</p>}
    {error && <div role="alert" className="space-y-2 border-l-2 border-red-600 p-3 text-sm"><p>{error}</p><button disabled={busy} onClick={() => void reload()} className="min-h-11 font-bold underline">Atualizar partida</button></div>}
    {notice && !error && <div className="flex items-center gap-2 bg-emerald-50 p-3 text-emerald-900"><Check size={18} className="shrink-0" /><p role="status" className="min-w-0 flex-1 text-sm">{notice}</p>{undo && undo.version === match.versao && <button disabled={blocked} onClick={() => void persist({ ...undo.before, versao: match.versao }, "Último lançamento desfeito.", true)} className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-bold" title="Desfazer último lançamento"><Undo2 size={18} />Desfazer</button>}</div>}
    {penaltyRequired && <fieldset disabled={blocked} className="space-y-2 border-t border-zinc-200 pt-3"><legend className="text-sm font-bold">Vencedor dos pênaltis alternados</legend>{teams.map(item => <label key={item.id} className="flex min-h-11 items-center gap-2 text-sm font-bold"><input type="radio" name={`penaltis-${match.id}`} checked={penaltyWinner === item.id} onChange={() => onPenaltyWinner(item.id)} className="h-5 w-5 accent-red-700" /><span className="min-w-0 break-words">{item.label}</span></label>)}</fieldset>}
    {match.status === "aberta" && !roundClosed && <button disabled={blocked} onClick={onFinish} className="fk-primary min-h-12 w-full bg-red-700 px-3 text-sm font-black uppercase text-white disabled:opacity-40">Finalizar partida</button>}
    <button disabled={busy || disabled} onClick={onClose} className="fk-secondary min-h-11 w-full text-sm font-bold">Voltar às partidas</button>
    {!roundClosed && match.status !== "cancelada" && <details className="border-t border-zinc-200"><summary className="min-h-11 cursor-pointer content-center text-sm text-zinc-600">Outras ações</summary><button disabled={blocked} onClick={onCancel} className="min-h-11 text-sm font-bold text-red-700">Cancelar partida</button></details>}
  </section>;
}

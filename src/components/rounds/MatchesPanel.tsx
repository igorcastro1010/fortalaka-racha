"use client";

import { useEffect, useMemo, useState } from "react";
import { createMatch, getRoundMatches, saveMatch, type Match, type MatchPlayer, type MatchesState } from "@/lib/matches/repository";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";

const button = "min-h-11 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-bold disabled:opacity-50";

export function MatchesPanel({ roundId, organizer, roundStatus }: { roundId: string; organizer: boolean; roundStatus: string }) {
  const [state, setState] = useState<MatchesState>({ times: [], partidas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [draft, setDraft] = useState<Match | null>(null);

  useEffect(() => {
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (active) { setState(data); setError(""); }
    }).catch(e => {
      if (active) setError(e instanceof Error ? e.message : "Nao foi possivel carregar as partidas.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [roundId, roundStatus]);

  const selectedTeamNames = useMemo(() => ({
    a: state.times.find(team => team.id === teamA)?.nome ?? "Time A",
    b: state.times.find(team => team.id === teamB)?.nome ?? "Time B",
  }), [state.times, teamA, teamB]);

  async function create() {
    if (teamA === teamB) {
      setError("Escolha dois times diferentes.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const id = await createMatch(roundId, teamA, teamB);
      const data = await getRoundMatches(roundId);
      setState(data);
      setDraft(data.partidas.find(match => match.id === id) ?? null);
      setTeamA("");
      setTeamB("");
      setMessage("Partida criada com os jogadores dos times confirmados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel criar a partida.");
    } finally {
      setBusy(false);
    }
  }

  async function save(status: Match["status"]) {
    if (!draft) return;
    if (![draft.placarA, draft.placarB].every(n => Number.isSafeInteger(n) && n >= 0)) {
      setError("Informe placares inteiros maiores ou iguais a zero.");
      return;
    }

    const warning = goalWarning(draft);
    if (warning && !window.confirm(`${warning}\n\nContinuar mesmo assim?`)) {
      return;
    }

    if (status === "finalizada" && draft.status !== "finalizada" && !window.confirm("Finalizar esta partida?\n\nDepois de finalizada, as estatisticas entrarao no ranking.")) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveMatch(draft, status);
      setState(await getRoundMatches(roundId));
      setDraft(null);
      setMessage(result.aviso ? `Partida salva. ${result.aviso}` : status === "finalizada" ? "Partida finalizada. Estatisticas atualizadas." : "Partida salva.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nao foi possivel salvar a partida.");
    } finally {
      setBusy(false);
    }
  }

  function editMatch(match: Match) {
    if (match.status === "finalizada" && !window.confirm("Alterar uma partida finalizada pode modificar o ranking.")) {
      return;
    }
    setDraft(structuredClone(match));
    setError("");
    setMessage("");
  }

  function updatePlayer(id: string, patch: Partial<MatchPlayer>) {
    setDraft(current => current ? { ...current, jogadores: current.jogadores.map(player => player.jogador_id === id ? { ...player, ...patch } : player) } : null);
  }

  function changeScore(key: "placarA" | "placarB", delta: number) {
    setDraft(current => current ? { ...current, [key]: Math.max(0, current[key] + delta) } : null);
  }

  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <div>
      <h3 className="text-xl font-black">Partidas</h3>
      <p className="mt-1 text-xs text-zinc-600">Historico e estatisticas desta rodada</p>
    </div>

    {loading && <p role="status" className="text-sm text-zinc-600">Carregando partidas...</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button className={`${button} mt-2`} disabled={busy} onClick={async () => { try { setState(await getRoundMatches(roundId)); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Nao foi possivel carregar."); } }}>Atualizar partidas</button></div>}
    {message && <p role="status" className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800">{message}</p>}

    {organizer && !loading && state.times.length >= 2 && <details className="rounded-xl border border-zinc-200 p-3">
      <summary className="cursor-pointer text-sm font-bold">+ Nova partida</summary>
      <div className="mt-3 grid gap-2">
        {[{ label: "Time A", value: teamA, change: setTeamA }, { label: "Time B", value: teamB, change: setTeamB }].map(item => <label key={item.label} className="text-xs font-bold">{item.label}
          <select value={item.value} onChange={event => item.change(event.target.value)} disabled={busy} className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2">
            <option value="">Selecionar time</option>
            {state.times.map(team => <option key={team.id} value={team.id}>{team.nome}</option>)}
          </select>
        </label>)}
        <p className="text-center text-xs font-bold text-zinc-600">{selectedTeamNames.a} x {selectedTeamNames.b}</p>
        <button className="min-h-11 rounded-xl bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-50" disabled={busy || !teamA || !teamB || teamA === teamB} onClick={create}>Criar partida</button>
      </div>
    </details>}

    {!loading && !error && !state.partidas.length && <p className="text-sm text-zinc-600">Nenhuma partida registrada.{organizer && state.times.length < 2 ? " Confirme pelo menos dois times para criar uma partida." : ""}</p>}

    {state.partidas.map((match, index) => <article key={match.id} className="rounded-xl border border-zinc-200 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">Partida {index + 1}</p>
      <div className="mt-1 flex items-center justify-between gap-2 text-center">
        <p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeA}</p>
        <p className="shrink-0 text-xl font-black tabular-nums">{match.placarA} x {match.placarB}</p>
        <p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeB}</p>
      </div>
      <p className="mt-2 text-center text-[10px] font-bold uppercase text-zinc-500">{statusLabel(match.status)}</p>
      {match.status === "finalizada" && <p className="mt-1 text-center text-xs font-semibold">{match.placarA === match.placarB ? "Empate" : `Vencedor: ${match.placarA > match.placarB ? match.timeA : match.timeB}`}</p>}
      {match.finalizadaAt && <p className="mt-1 text-center text-[10px] font-semibold text-zinc-500">Finalizada em {formatDateTime(match.finalizadaAt)}</p>}
      <details className="mt-2 text-xs">
        <summary className="min-h-8 cursor-pointer py-2 font-semibold">Participantes e eventos</summary>
        {match.jogadores.map(player => <p key={player.jogador_id} className="border-t border-zinc-100 py-2">{player.nome} - {player.participou ? `${player.gols} gols / ${player.assistencias} assistencias` : "Nao participou"}</p>)}
      </details>
      {organizer && <button disabled={busy} onClick={() => editMatch(match)} className={`${button} mt-2 w-full`}>{match.status === "finalizada" ? "Editar resultado" : "Editar partida"}</button>}
    </article>)}

    {organizer && draft && <div className="space-y-4 rounded-xl border-2 border-red-200 bg-zinc-50 p-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-red-700">Lancamento</p>
        <h4 className="text-base font-black">{draft.timeA} x {draft.timeB}</h4>
        <p className="mt-1 text-xs font-semibold text-zinc-600">{statusLabel(draft.status)}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <ScoreControl label={draft.timeA} value={draft.placarA} disabled={busy} onMinus={() => changeScore("placarA", -1)} onPlus={() => changeScore("placarA", 1)} />
        <span className="pb-4 text-xl font-black">x</span>
        <ScoreControl label={draft.timeB} value={draft.placarB} disabled={busy} onMinus={() => changeScore("placarB", -1)} onPlus={() => changeScore("placarB", 1)} />
      </div>

      <div className="space-y-3">
        <h5 className="text-sm font-black">Participacao</h5>
        {[draft.timeAId, draft.timeBId].map(teamId => <div key={teamId}>
          <p className="mb-2 text-xs font-black uppercase text-zinc-600">{teamId === draft.timeAId ? draft.timeA : draft.timeB}</p>
          {draft.jogadores.filter(player => player.time_id === teamId).map(player => <div key={player.jogador_id} className="flex items-center gap-2 border-t border-zinc-200 py-2">
            <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" />
            <span className="min-w-0 flex-1 break-words text-sm font-bold">{player.nome}</span>
            <label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={busy} checked={player.participou} onChange={event => updatePlayer(player.jogador_id, { participou: event.target.checked, ...(!event.target.checked ? { gols: 0, assistencias: 0 } : {}) })} className="h-5 w-5 accent-red-600" />Participou</label>
          </div>)}
        </div>)}
      </div>

      <EventEditor title="Gols" field="gols" draft={draft} busy={busy} updatePlayer={updatePlayer} />
      <EventEditor title="Assistencias" field="assistencias" draft={draft} busy={busy} updatePlayer={updatePlayer} />

      {goalWarning(draft) && <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{goalWarning(draft)}</p>}

      <div className="grid gap-2">
        <button disabled={busy} onClick={() => save(draft.status)} className={button}>Salvar</button>
        <button disabled={busy} onClick={() => save("finalizada")} className="min-h-12 rounded-xl bg-red-600 text-xs font-black uppercase text-white disabled:opacity-50">Finalizar partida</button>
        <button disabled={busy} className={button} onClick={() => { if (window.confirm("Cancelar esta partida? Ela deixara de contar nas estatisticas.")) void save("cancelada"); }}>Cancelar partida</button>
        <button disabled={busy} className={button} onClick={() => setDraft(null)}>Fechar edicao sem salvar</button>
      </div>
    </div>}
  </section>;
}

function ScoreControl({ label, value, disabled, onMinus, onPlus }: { label: string; value: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  return <div className="text-center">
    <p className="mb-2 min-h-8 break-words text-xs font-black">{label}</p>
    <div className="flex items-center justify-center gap-1">
      <button className="h-11 w-11 rounded-xl border border-zinc-200 bg-white text-xl font-black disabled:opacity-40" disabled={disabled || value <= 0} onClick={onMinus} aria-label={`Diminuir placar de ${label}`}>-</button>
      <span className="min-w-10 text-3xl font-black tabular-nums">{value}</span>
      <button className="h-11 w-11 rounded-xl border border-zinc-200 bg-white text-xl font-black disabled:opacity-40" disabled={disabled} onClick={onPlus} aria-label={`Aumentar placar de ${label}`}>+</button>
    </div>
  </div>;
}

function EventEditor({ title, field, draft, busy, updatePlayer }: { title: string; field: "gols" | "assistencias"; draft: Match; busy: boolean; updatePlayer: (id: string, patch: Partial<MatchPlayer>) => void }) {
  const players = draft.jogadores.filter(player => player.participou);
  return <div className="space-y-2">
    <h5 className="text-sm font-black">{title}</h5>
    {!players.length && <p className="text-xs text-zinc-500">Marque participantes para lancar {title.toLowerCase()}.</p>}
    {players.map(player => <div key={player.jogador_id} className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-zinc-100">
      <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" />
      <span className="min-w-0 flex-1 break-words text-sm font-bold">{player.nome}</span>
      <button className="h-10 w-10 rounded-xl border border-zinc-200 text-lg font-black disabled:opacity-40" disabled={busy || player[field] <= 0} onClick={() => updatePlayer(player.jogador_id, { [field]: player[field] - 1 })} aria-label={`Diminuir ${title.toLowerCase()} de ${player.nome}`}>-</button>
      <span className="w-8 text-center text-base font-black tabular-nums">{player[field]}</span>
      <button className="h-10 w-10 rounded-xl border border-zinc-200 text-lg font-black disabled:opacity-40" disabled={busy} onClick={() => updatePlayer(player.jogador_id, { [field]: player[field] + 1 })} aria-label={`Adicionar ${title.toLowerCase()} de ${player.nome}`}>+</button>
    </div>)}
  </div>;
}

function goalWarning(match: Match) {
  const goalsA = sumGoals(match, match.timeAId);
  const goalsB = sumGoals(match, match.timeBId);
  const warnings = [];
  if (goalsA !== match.placarA) warnings.push(`O placar do ${match.timeA} e ${match.placarA}, mas foram registrados ${goalsA} gols individuais.`);
  if (goalsB !== match.placarB) warnings.push(`O placar do ${match.timeB} e ${match.placarB}, mas foram registrados ${goalsB} gols individuais.`);
  return warnings.join(" ");
}

function sumGoals(match: Match, teamId: string) {
  return match.jogadores.filter(player => player.time_id === teamId && player.participou).reduce((total, player) => total + player.gols, 0);
}

function statusLabel(status: Match["status"]) {
  return {
    aberta: "Em andamento",
    finalizada: "Finalizada",
    cancelada: "Cancelada",
  }[status];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

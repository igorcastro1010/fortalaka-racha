"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createMatch, createNextMatch, getRoundMatches, saveMatch, type Match, type MatchPlayer, type MatchesState } from "@/lib/matches/repository";
import { Minus, Plus, Trophy } from "lucide-react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PostRoundSummary } from "@/components/results/PostRoundSummary";
import { ViewTabs } from "@/components/ui/ViewTabs";

const button = "fk-secondary min-h-11 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-bold disabled:opacity-50";

export function MatchesPanel({ roundId, organizer, roundStatus, roundDate = null, onFinalizedCountChange, onRoundStarted }: {
  roundId: string;
  organizer: boolean;
  roundStatus: string;
  roundDate?: string | null;
  onRoundStarted?: (roundId: string) => void;
  onFinalizedCountChange?: (roundId: string, count: number | null) => void;
}) {
  const [state, setState] = useState<MatchesState>({ times: [], partidas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [draft, setDraft] = useState<Match | null>(null);
  const [goalLimitTeam, setGoalLimitTeam] = useState<string | null>(null);
  const [view, setView] = useState<"auto" | "live" | "history" | "summary">("auto");
  const goalDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (goalLimitTeam) goalDialog.current?.showModal();
    else goalDialog.current?.close();
  }, [goalLimitTeam]);
  const currentStatus = state.roundStatus ?? roundStatus;
  const activeView = view === "auto" ? currentStatus === "finalizado" ? "summary" : "live" : view;
  const canCreate = organizer && ["times_confirmados", "em_andamento"].includes(currentStatus);
  const currentMatch = state.partidas.find(match => match.id === state.fila?.currentMatchId) ?? state.partidas.find(match => match.status === "aberta");
  const teamName = (id: string) => state.times.find(team => team.id === id)?.nome ?? "Time";
  const waiting = state.fila?.order.filter(id => !currentMatch || (id !== currentMatch.timeAId && id !== currentMatch.timeBId)) ?? [];

  useEffect(() => {
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (active) { setState(data); setError(""); }
    }).catch(e => {
      console.error("Falha ao carregar partidas", e);
      if (active) setError("Não foi possível carregar as partidas. Tente novamente.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [roundId, roundStatus]);

  useEffect(() => {
    onFinalizedCountChange?.(roundId, loading || busy || error ? null : state.partidas.filter(match => match.status === "finalizada").length);
  }, [roundId, state.partidas, loading, busy, error, onFinalizedCountChange]);

  const selectedTeamNames = useMemo(() => ({
    a: state.times.find(team => team.id === teamA)?.nome ?? "Time A",
    b: state.times.find(team => team.id === teamB)?.nome ?? "Time B",
  }), [state.times, teamA, teamB]);

  async function refreshMatches() {
    if (busy || draft) return;
    setBusy(true); setError("");
    try { setState(await getRoundMatches(roundId)); }
    catch (e) { console.error("Falha ao atualizar partidas", e); setError("Não foi possível atualizar as partidas. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function create(next = false) {
    if (!canCreate || busy) return;
    if (!next && teamA === teamB) {
      setError("Escolha dois times diferentes.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const id = next && state.fila ? await createNextMatch(roundId, state.fila.version) : await createMatch(roundId, teamA, teamB);
      const data = await getRoundMatches(roundId);
      setState(data);
      if (data.roundStatus === "em_andamento") onRoundStarted?.(roundId);
      setDraft(data.partidas.find(match => match.id === id) ?? null);
      setView("live");
      setTeamA("");
      setTeamB("");
      setMessage("Partida criada com os jogadores dos times confirmados.");
    } catch (e) {
      console.error("Falha ao criar partida", e);
      setError("Não foi possível criar a partida. Atualize e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function save(status: Match["status"], confirmed = false) {
    if (!draft || !organizer || busy) return;
    if (![draft.placarA, draft.placarB].every(n => Number.isSafeInteger(n) && n >= 0)) {
      setError("Informe placares inteiros maiores ou iguais a zero.");
      return;
    }

    if (!confirmed && status === "finalizada" && draft.status !== "finalizada" && !window.confirm("Finalizar esta partida?\n\nDepois de finalizada, as estatisticas entrarao no ranking.")) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await saveMatch(draft, status);
      setState(await getRoundMatches(roundId));
      setDraft(null);
      setGoalLimitTeam(null);
      if (status !== "aberta") setView("history");
      setMessage(result.aviso ? `Partida salva. ${result.aviso}` : status === "finalizada" ? "Partida finalizada. Estatisticas atualizadas." : "Partida salva.");
    } catch (e) {
      console.error("Falha ao salvar partida", e);
      setError("Não foi possível salvar a partida. Seus lançamentos foram mantidos para tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  function editMatch(match: Match) {
    if (match.status === "finalizada" && !window.confirm("Alterar uma partida finalizada pode modificar o ranking.")) {
      return;
    }
    setDraft(structuredClone(match));
    setView("live");
    setError("");
    setMessage("");
  }

  function updatePlayer(id: string, patch: Partial<MatchPlayer>) {
    setDraft(current => current ? { ...current, jogadores: current.jogadores.map(player => player.jogador_id === id ? { ...player, ...patch } : player) } : null);
  }

  function changeScore(key: "placarA" | "placarB", delta: number) {
    if (draft && draft.status === "aberta" && delta > 0 && draft[key] === 1) setGoalLimitTeam(key === "placarA" ? draft.timeA : draft.timeB);
    setDraft(current => current ? { ...current, [key]: Math.max(0, current[key] + delta) } : null);
  }

  return <>
    <ViewTabs label="Visão das partidas" value={activeView} onChange={setView} items={[{ id: "live", label: "Ao vivo" }, { id: "history", label: "Histórico" }, { id: "summary", label: "Resumo" }]} />
    <section className="fk-section flex flex-col gap-4" aria-label="Partidas da rodada">

    {!loading && !error && state.partidas.length > 0 && <p className="text-xs font-bold text-zinc-500">{state.partidas.length} partidas · {state.partidas.filter(match => match.status === "finalizada").length} finalizadas</p>}

    {loading && <LoadingCards label="Carregando partidas..." />}
    {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button className={`${button} mt-2`} disabled={busy} onClick={refreshMatches}>Atualizar partidas</button></div>}
    {message && <p role="status" className="border-l-2 border-red-600 py-2 pl-3 text-sm text-zinc-800">{message}</p>}
    {activeView === "live" && (state.fila || currentMatch) && (["times_confirmados", "em_andamento", "finalizado"].includes(currentStatus)) && !loading && !error && <div className="space-y-4 rounded-lg bg-neutral-950 p-4 text-white">
      <p className="text-xs font-black uppercase text-red-400">{currentMatch ? "EM CAMPO" : currentStatus === "finalizado" ? "FILA PRESERVADA" : "PRÓXIMA PARTIDA"}</p>
      {currentMatch ? <>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
          <div className="min-w-0"><p className="break-words text-xs font-bold text-zinc-300">{currentMatch.timeA}</p><p className="mt-2 text-6xl font-black tabular-nums">{draft?.id === currentMatch.id ? draft.placarA : currentMatch.placarA}</p></div>
          <span className="text-lg font-bold text-zinc-500">×</span>
          <div className="min-w-0"><p className="break-words text-xs font-bold text-zinc-300">{currentMatch.timeB}</p><p className="mt-2 text-6xl font-black tabular-nums">{draft?.id === currentMatch.id ? draft.placarB : currentMatch.placarB}</p></div>
        </div>
        {organizer && draft?.id !== currentMatch.id && <button disabled={busy} onClick={() => editMatch(currentMatch)} className="min-h-12 w-full rounded-lg bg-red-600 px-3 text-xs font-black disabled:opacity-50">LANÇAR PLACAR E EVENTOS</button>}
      </> : <p className="break-words text-center text-lg font-black">{state.fila?.order.slice(0, 2).map(teamName).join(" x ") || "Confirme os times"}</p>}
      {(currentMatch ? waiting : waiting.slice(2)).length > 0 && <div className="border-t border-white/15 pt-3">
        <p className="text-xs font-black uppercase text-zinc-300">Próximos</p>
        <ol className="mt-2 divide-y divide-white/15">{(currentMatch ? waiting : waiting.slice(2)).map((id, index) => <li key={id} className="flex items-center gap-3 py-3">
          <span className="w-5 shrink-0 text-xs font-black text-zinc-300">{index + 1}</span><span className="min-w-0 flex-1 break-words text-sm font-bold">{teamName(id)}</span><span className="text-xs font-semibold text-zinc-300">{index === 0 ? "Próximo" : "Na fila"}</span>
        </li>)}</ol>
      </div>}
      {!currentMatch && canCreate && state.fila && <button disabled={busy || state.fila.order.length < 2} onClick={() => create(true)} className="min-h-12 w-full rounded-lg bg-red-600 px-3 text-xs font-black disabled:opacity-50">{state.partidas.length ? "INICIAR PRÓXIMA PARTIDA" : "INICIAR PRIMEIRA PARTIDA"}</button>}
    </div>}
    <dialog ref={goalDialog} aria-labelledby="goal-limit-title" onCancel={event => { event.preventDefault(); if (!busy) setGoalLimitTeam(null); }} className="fk-sheet fixed inset-x-0 bottom-0 top-auto m-auto w-full max-w-[430px] rounded-t-lg bg-white p-5 shadow-2xl backdrop:bg-black/50 sm:inset-0 sm:w-[calc(100%-32px)] sm:max-w-sm sm:rounded-lg">
      <h3 id="goal-limit-title" className="text-xl font-black">{goalLimitTeam} atingiu 2 gols.</h3><p className="mt-3 text-sm text-zinc-600">Finalizar partida?</p>
      <div className="mt-4 grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => setGoalLimitTeam(null)} className={button}>CONTINUAR</button><button disabled={busy} onClick={() => save("finalizada", true)} className="min-h-12 rounded-lg bg-red-600 text-xs font-black text-white disabled:opacity-50">FINALIZAR</button></div>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
    </dialog>

    {!draft && <button disabled={busy || loading} onClick={refreshMatches} className={`${button} order-4`}>ATUALIZAR PARTIDAS E FILA</button>}

    {activeView === "live" && canCreate && !currentMatch && !draft && !loading && state.times.length >= 2 && <details className="order-3 border-y border-zinc-200 py-2">
      <summary className="min-h-11 cursor-pointer content-center text-center text-xs font-black">ESCOLHER CONFRONTO MANUALMENTE</summary>
      <div className="mt-3 grid gap-2">
        {[{ label: "Time A", value: teamA, change: setTeamA }, { label: "Time B", value: teamB, change: setTeamB }].map(item => <label key={item.label} className="text-xs font-bold">{item.label}
          <select value={item.value} onChange={event => item.change(event.target.value)} disabled={busy} className="fk-field mt-1 h-11 w-full rounded-lg border border-zinc-200 bg-white px-2">
            <option value="">Selecionar time</option>
            {state.times.map(team => <option key={team.id} value={team.id}>{team.nome}</option>)}
          </select>
        </label>)}
        <p className="text-center text-xs font-bold text-zinc-600">{selectedTeamNames.a} x {selectedTeamNames.b}</p>
        <button className="fk-primary min-h-11 rounded-lg bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-50" disabled={busy || !teamA || !teamB || teamA === teamB} onClick={() => create()}>Criar partida</button>
      </div>
    </details>}

    {activeView === "live" && !loading && !error && !state.partidas.length && <EmptyState icon={Trophy} title="Nenhuma partida ainda" description={organizer && state.times.length < 2 ? "Confirme os times para começar. Quando o racha começar, os resultados aparecem aqui." : "Quando o racha começar, os resultados aparecem aqui."} />}
    {activeView === "history" && !loading && !error && !state.partidas.some(match => match.status !== "aberta") && <EmptyState icon={Trophy} title="Histórico vazio" description="As partidas finalizadas ou canceladas aparecem aqui." />}
    {activeView === "summary" && currentStatus !== "finalizado" && !loading && <EmptyState icon={Trophy} title="Resumo após o apito final" description="O resumo estará disponível quando o racha for finalizado." />}
    {currentStatus === "finalizado" && !loading && !error && !busy && !draft && <div hidden={activeView !== "summary"}><PostRoundSummary roundId={roundId} date={roundDate} matches={state.partidas} /></div>}

    {activeView === "history" && state.partidas.map((match, index) => match.status !== "aberta" && <article key={match.id} className="order-2 border-b border-zinc-200 py-4">
      <p className="text-xs font-black uppercase text-zinc-600">Partida {index + 1}</p>
      <div className="mt-1 flex items-center justify-between gap-2 text-center">
        <p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeA}</p>
        <p className="shrink-0 text-xl font-black tabular-nums">{match.placarA} x {match.placarB}</p>
        <p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeB}</p>
      </div>
      <p className="mt-2 text-center text-xs font-bold uppercase text-zinc-600">{statusLabel(match.status)}</p>
      {match.status === "finalizada" && <p className="mt-1 text-center text-xs font-semibold">{match.placarA === match.placarB ? "Empate" : `Vencedor: ${match.placarA > match.placarB ? match.timeA : match.timeB}`}</p>}
      {match.finalizadaAt && <p className="mt-1 text-center text-xs font-semibold text-zinc-600">Finalizada em {formatDateTime(match.finalizadaAt)}</p>}
      <details className="mt-2 text-xs">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">Participantes e eventos</summary>
        {match.jogadores.map(player => <p key={player.jogador_id} className="border-t border-zinc-100 py-2">{player.nome} - {player.participou ? `${player.gols} gols / ${player.assistencias} assistencias` : "Nao participou"}</p>)}
      </details>
      {organizer && <button disabled={busy} onClick={() => editMatch(match)} className={`${button} mt-2 w-full`}>{match.status === "finalizada" ? "Editar resultado" : "Editar partida"}</button>}
    </article>)}

    {activeView === "live" && organizer && draft && <div className="fk-panel order-1 space-y-4 rounded-lg border border-zinc-200 bg-white p-3">
      <div>
        <p className="text-xs font-black uppercase text-red-700">Lançamento</p>
        <h4 className="text-base font-black">{draft.timeA} x {draft.timeB}</h4>
        <p className="mt-1 text-xs font-semibold text-zinc-600">{statusLabel(draft.status)}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <ScoreControl label={draft.timeA} value={draft.placarA} disabled={busy} onMinus={() => changeScore("placarA", -1)} onPlus={() => changeScore("placarA", 1)} />
        <span className="pb-4 text-xl font-black">x</span>
        <ScoreControl label={draft.timeB} value={draft.placarB} disabled={busy} onMinus={() => changeScore("placarB", -1)} onPlus={() => changeScore("placarB", 1)} />
      </div>

      <details className="border-y border-zinc-200 py-2">
        <summary className="min-h-11 cursor-pointer content-center text-xs font-black">Participação · {draft.jogadores.filter(player => player.participou).length} jogadores</summary>
        <div className="mt-2 space-y-3">
        {[draft.timeAId, draft.timeBId].map(teamId => <div key={teamId}>
          <p className="mb-2 text-xs font-black uppercase text-zinc-600">{teamId === draft.timeAId ? draft.timeA : draft.timeB}</p>
          {draft.jogadores.filter(player => player.time_id === teamId).map(player => <div key={player.jogador_id} className="flex items-center gap-2 border-t border-zinc-200 py-2">
            <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" />
            <span className="min-w-0 flex-1 break-words text-sm font-bold">{player.nome}</span>
            <label className="flex min-h-11 items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={busy} checked={player.participou} onChange={event => updatePlayer(player.jogador_id, { participou: event.target.checked, ...(!event.target.checked ? { gols: 0, assistencias: 0 } : {}) })} className="h-5 w-5 accent-red-600" />Participou</label>
          </div>)}
        </div>)}
        </div>
      </details>

      <EventEditor title="Gols" field="gols" draft={draft} busy={busy} updatePlayer={updatePlayer} />
      <EventEditor title="Assistencias" field="assistencias" draft={draft} busy={busy} updatePlayer={updatePlayer} />

      {goalWarning(draft) && <p className="border-l-2 border-amber-500 bg-amber-50 p-3 text-xs font-bold text-amber-800">{goalWarning(draft)}</p>}

      <div className="grid gap-2">
        <button disabled={busy} onClick={() => save(draft.status)} className={button}>Salvar</button>
        <button disabled={busy} onClick={() => save("finalizada")} className="fk-primary min-h-12 rounded-lg bg-red-600 text-xs font-black uppercase text-white disabled:opacity-50">Finalizar partida</button>
        <button disabled={busy} className={button} onClick={() => { if (window.confirm("Cancelar esta partida? Ela deixara de contar nas estatisticas.")) void save("cancelada"); }}>Cancelar partida</button>
        <button disabled={busy} className={button} onClick={() => setDraft(null)}>Fechar edicao sem salvar</button>
      </div>
    </div>}
  </section></>;
}

function ScoreControl({ label, value, disabled, onMinus, onPlus }: { label: string; value: number; disabled: boolean; onMinus: () => void; onPlus: () => void }) {
  return <div className="text-center">
    <p className="mb-2 min-h-8 break-words text-xs font-black">{label}</p>
    <p className="mb-3 text-4xl font-black tabular-nums">{value}</p>
    <div className="grid grid-cols-2 gap-2">
      <button className="flex h-11 items-center justify-center rounded-lg border border-zinc-200 bg-white disabled:opacity-40" disabled={disabled || value <= 0} onClick={onMinus} aria-label={`Diminuir placar de ${label}`} title={`Diminuir placar de ${label}`}><Minus size={20} /></button>
      <button className="flex h-11 items-center justify-center rounded-lg bg-neutral-950 text-white disabled:opacity-40" disabled={disabled} onClick={onPlus} aria-label={`Aumentar placar de ${label}`} title={`Aumentar placar de ${label}`}><Plus size={20} /></button>
    </div>
  </div>;
}

function EventEditor({ title, field, draft, busy, updatePlayer }: { title: string; field: "gols" | "assistencias"; draft: Match; busy: boolean; updatePlayer: (id: string, patch: Partial<MatchPlayer>) => void }) {
  const players = draft.jogadores.filter(player => player.participou);
  return <details className="border-b border-zinc-200 py-2">
    <summary className="min-h-11 cursor-pointer content-center text-xs font-black">{title} · {players.reduce((total, player) => total + player[field], 0)} registrados</summary>
    <div className="mt-2 space-y-2">
    {!players.length && <p className="text-xs text-zinc-500">Marque participantes para lancar {title.toLowerCase()}.</p>}
    {players.map(player => <div key={player.jogador_id} className="flex items-center gap-1 border-t border-zinc-100 py-3">
      <PlayerAvatar name={player.nome} avatarUrl={player.avatar_url} size="sm" />
      <span className="min-w-0 flex-1 break-words text-sm font-bold">{player.nome}</span>
      <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-40" disabled={busy || player[field] <= 0} onClick={() => updatePlayer(player.jogador_id, { [field]: player[field] - 1 })} aria-label={`Diminuir ${title.toLowerCase()} de ${player.nome}`} title={`Diminuir ${title.toLowerCase()}`}><Minus size={18} /></button>
      <span className="w-8 text-center text-base font-black tabular-nums">{player[field]}</span>
      <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 disabled:opacity-40" disabled={busy} onClick={() => updatePlayer(player.jogador_id, { [field]: player[field] + 1 })} aria-label={`Adicionar ${title.toLowerCase()} de ${player.nome}`} title={`Adicionar ${title.toLowerCase()}`}><Plus size={18} /></button>
    </div>)}
    </div>
  </details>;
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

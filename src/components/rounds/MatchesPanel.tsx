"use client";
import { useEffect, useState } from "react";
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
    getRoundMatches(roundId).then(data => { if (active) { setState(data); setError(""); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Não foi possível carregar as partidas."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [roundId, roundStatus]);
  async function create() {
    setBusy(true); setError(""); setMessage("");
    try {
      const id = await createMatch(roundId, teamA, teamB);
      const data = await getRoundMatches(roundId); setState(data); setDraft(data.partidas.find(m => m.id === id) ?? null);
      setMessage("Partida criada com os jogadores dos times confirmados.");
    } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível criar a partida."); }
    finally { setBusy(false); }
  }
  async function save(status: Match["status"]) {
    if (!draft) return;
    if (![draft.placarA, draft.placarB].every(n => Number.isSafeInteger(n) && n >= 0)) { setError("Informe placares inteiros maiores ou iguais a zero."); return; }
    setBusy(true); setError(""); setMessage("");
    try { const result = await saveMatch(draft, status); setState(await getRoundMatches(roundId)); setDraft(null); setMessage(result.aviso ? `Partida salva. ${result.aviso}` : status === "finalizada" ? "Partida finalizada. Estatísticas atualizadas." : "Partida salva."); }
    catch(e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a partida."); }
    finally { setBusy(false); }
  }
  function updatePlayer(id: string, patch: Partial<MatchPlayer>) {
    setDraft(current => current ? { ...current, jogadores: current.jogadores.map(p => p.jogador_id === id ? { ...p, ...patch } : p) } : null);
  }
  return <section className="space-y-3 rounded-[22px] bg-white p-4 ring-1 ring-black/5"><div><h3 className="text-xl font-black">Partidas</h3><p className="mt-1 text-xs text-zinc-600">Resultados desta rodada</p></div>
    {loading && <p role="status" className="text-sm text-zinc-600">Carregando partidas...</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p><button className={`${button} mt-2`} disabled={busy} onClick={async () => { try { setState(await getRoundMatches(roundId)); setError(""); } catch(e) { setError(e instanceof Error ? e.message : "Não foi possível carregar."); } }}>Atualizar partidas</button></div>}
    {message && <p role="status" className="rounded-xl bg-zinc-50 p-3 text-sm text-zinc-800">{message}</p>}
    {organizer && !loading && state.times.length >= 2 && <details className="rounded-xl border border-zinc-200 p-3"><summary className="cursor-pointer text-sm font-bold">+ Nova partida</summary><div className="mt-3 grid gap-2">
      {[{ label: "Time A", value: teamA, change: setTeamA }, { label: "Time B", value: teamB, change: setTeamB }].map(t => <label key={t.label} className="text-xs font-bold">{t.label}<select value={t.value} onChange={e => t.change(e.target.value)} disabled={busy} className="mt-1 h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2"><option value="">Selecionar time</option>{state.times.map(team => <option key={team.id} value={team.id}>{team.nome}</option>)}</select></label>)}
      <button className="min-h-11 rounded-xl bg-red-600 px-3 text-xs font-bold text-white disabled:opacity-50" disabled={busy || !teamA || !teamB || teamA === teamB} onClick={create}>Criar partida</button>
    </div></details>}
    {!loading && !error && !state.partidas.length && <p className="text-sm text-zinc-600">Nenhuma partida registrada.{organizer && state.times.length < 2 ? " Confirme pelo menos dois times para criar uma partida." : ""}</p>}
    {state.partidas.map(match => <article key={match.id} className="rounded-xl border border-zinc-200 p-3"><div className="flex items-center justify-between gap-2 text-center"><p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeA}</p><p className="shrink-0 text-xl font-black tabular-nums">{match.placarA} × {match.placarB}</p><p className="min-w-0 flex-1 break-words text-sm font-black">{match.timeB}</p></div><p className="mt-2 text-center text-[10px] font-bold uppercase text-zinc-500">{match.status}</p>
      {match.status === "finalizada" && <p className="mt-1 text-center text-xs font-semibold">{match.placarA === match.placarB ? "Empate" : `Vencedor: ${match.placarA > match.placarB ? match.timeA : match.timeB}`}</p>}
      <details className="mt-2 text-xs"><summary className="min-h-8 cursor-pointer py-2 font-semibold">Participantes e eventos</summary>{match.jogadores.map(p => <p key={p.jogador_id} className="border-t border-zinc-100 py-2">{p.nome} • {p.participou ? `${p.gols} gols · ${p.assistencias} assistências` : "Não participou"}</p>)}</details>
      {organizer && <button disabled={busy} onClick={() => { setDraft(structuredClone(match)); setError(""); setMessage(""); }} className={`${button} mt-2 w-full`}>{match.status === "finalizada" ? "Corrigir resultado" : "Editar partida"}</button>}
    </article>)}
    {organizer && draft && <div className="space-y-3 rounded-xl border-2 border-red-200 bg-zinc-50 p-3"><h4 className="text-base font-black">Lançamento da partida</h4><div className="grid grid-cols-2 gap-2">{[{ label: draft.timeA, key: "placarA" as const }, { label: draft.timeB, key: "placarB" as const }].map(t => <label key={t.key} className="text-xs font-bold">{t.label}<input type="number" min="0" step="1" disabled={busy} value={Number.isNaN(draft[t.key]) ? "" : draft[t.key]} onChange={e => setDraft({ ...draft, [t.key]: e.target.value === "" ? NaN : Number(e.target.value) })} className="mt-1 h-12 w-full rounded-xl border border-zinc-200 bg-white p-2 text-center text-xl font-black" /></label>)}</div>
      {[draft.timeAId, draft.timeBId].map(teamId => <div key={teamId}><h5 className="mb-2 text-sm font-black">{teamId === draft.timeAId ? draft.timeA : draft.timeB}</h5>{draft.jogadores.filter(p => p.time_id === teamId).map(p => <div key={p.jogador_id} className="space-y-2 border-t border-zinc-200 py-3"><div className="flex items-center gap-2"><PlayerAvatar name={p.nome} avatarUrl={p.avatar_url} size="sm" /><span className="min-w-0 flex-1 break-words text-sm font-bold">{p.nome}</span></div><label className="flex min-h-10 items-center gap-2 text-xs font-semibold"><input type="checkbox" disabled={busy} checked={p.participou} onChange={e => updatePlayer(p.jogador_id, { participou: e.target.checked, ...(!e.target.checked ? { gols: 0, assistencias: 0 } : {}) })} className="h-5 w-5 accent-red-600" />Participou</label><div className="grid grid-cols-2 gap-2">{(["gols", "assistencias"] as const).map(key => <div key={key}><p className="mb-1 text-[10px] font-bold uppercase">{key === "gols" ? "Gols" : "Assistências"}</p><div className="flex items-center justify-between gap-1"><button className={button} aria-label={`Diminuir ${key} de ${p.nome}`} disabled={busy || !p.participou || p[key] === 0} onClick={() => updatePlayer(p.jogador_id, { [key]: p[key] - 1 })}>−</button><span className="text-sm font-bold tabular-nums">{p[key]}</span><button className={button} aria-label={`Adicionar ${key} de ${p.nome}`} disabled={busy || !p.participou} onClick={() => updatePlayer(p.jogador_id, { [key]: p[key] + 1 })}>+</button></div></div>)}</div></div>)}</div>)}
      <div className="grid gap-2"><button disabled={busy} onClick={() => save(draft.status)} className={button}>Salvar</button><button disabled={busy} onClick={() => save("finalizada")} className="min-h-12 rounded-xl bg-red-600 text-xs font-black uppercase text-white disabled:opacity-50">Finalizar partida</button><button disabled={busy} className={button} onClick={() => { if (window.confirm("Cancelar esta partida? Ela deixará de contar nas estatísticas.")) void save("cancelada"); }}>Cancelar partida</button><button disabled={busy} className={button} onClick={() => setDraft(null)}>Fechar edição sem salvar</button></div>
    </div>}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth/roles";
import { isOrganizer } from "@/lib/auth/roles";
import { availabilityError, drawTeams, eligiblePlayers, swapPlayers, validateTeams } from "@/lib/teams/draw";
import type { DrawTeam, Participant, Round, RoundDetail } from "@/lib/teams/draw";
import { confirmTeams, createRound, listRounds, loadRound, saveParticipants } from "@/lib/teams/repository";
import { ParticipantEditor } from "./ParticipantEditor";

const buttonClass = "min-h-12 w-full rounded-[16px] bg-red-600 px-3 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "min-h-12 w-full rounded-[16px] border border-zinc-300 bg-white px-3 py-3 text-sm font-black disabled:opacity-50";

function errorText(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir. Tente novamente."; }

export function TeamsScreen({ profile }: { profile: Profile }) {
  const organizer = isOrganizer(profile) && profile.active;
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    let active = true;
    listRounds().then((data) => {
      if (!active) return;
      setRounds(data); setSelected((current) => current || data[0]?.id || ""); setError("");
    }).catch((e) => { if (active) setError(errorText(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const id = await createRound(name, date);
      const data = await listRounds(); setRounds(data); setSelected(id); setCreating(false); setName(""); setDate("");
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  return (
    <section className="space-y-3.5">
      <div><h2 className="text-[29px] font-black">Times</h2><p className="text-sm font-bold text-zinc-600">4 times de 5 jogadores de linha</p></div>
      {loading && <p role="status">Carregando rodadas...</p>}
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}
        <button className="mt-2 block underline" onClick={() => { setLoading(true); setReload((v) => v + 1); }}>Tentar novamente</button>
      </div>}
      {rounds.length > 0 && <label className="block text-sm font-bold">Rodada
        <select disabled={busy} value={selected} onChange={(e) => {
          if (window.confirm("Trocar de rodada? Um rascunho não confirmado será descartado.")) setSelected(e.target.value);
        }} className="mt-1 w-full rounded-xl border border-zinc-300 bg-white p-3">
          {rounds.map((r) => <option key={r.id} value={r.id}>{r.nome} · {r.data.split("-").reverse().join("/")}</option>)}
        </select>
      </label>}
      {!loading && !error && rounds.length === 0 && <p className="rounded-xl bg-white p-4 text-sm font-bold">Nenhuma rodada cadastrada.{organizer ? " Crie uma rodada para preparar os times." : " Aguarde a organização cadastrar a rodada."}</p>}
      {organizer && !loading && !error && <button className={secondaryClass} onClick={() => setCreating((v) => !v)}>{creating ? "FECHAR NOVA RODADA" : "NOVA RODADA"}</button>}
      {creating && <form onSubmit={handleCreate} className="space-y-3 rounded-[22px] bg-white p-4">
        <label className="block text-sm font-bold">Nome da rodada<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="block text-sm font-bold">Data da rodada<input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <button disabled={busy || !name.trim()} className={buttonClass}>{busy ? "CRIANDO..." : "CRIAR RODADA"}</button>
      </form>}
      {selected && <RoundTeams key={selected} id={selected} organizer={organizer} />}
    </section>
  );
}

function RoundTeams({ id, organizer }: { id: string; organizer: boolean }) {
  const [detail, setDetail] = useState<RoundDetail | null>(null);
  const [draft, setDraft] = useState<DrawTeam[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    loadRound(id).then((data) => { if (active) { setDetail(data); setError(""); } })
      .catch((e) => { if (active) setError(errorText(e)); });
    return () => { active = false; };
  }, [id, reload]);

  function refresh() {
    if ((draft || editing) && !window.confirm("Descartar as alterações não confirmadas e atualizar a rodada?")) return;
    setDraft(null); setEditing(false); setAdjusting(false); setSelectedPlayer(null); setDetail(null); setError(""); setMessage(""); setReload((v) => v + 1);
  }

  function draw() {
    if (!detail || !organizer) return;
    if (detail.rodada.confirmado && !window.confirm("Os times já estão confirmados. Gerar um novo sorteio para substituí-los após a confirmação?")) return;
    if (draft && !window.confirm("Descartar o rascunho atual e sortear novamente?")) return;
    try { setDraft(drawTeams(detail.participantes)); setAdjusting(false); setSelectedPlayer(null); setError(""); setMessage(""); }
    catch (e) { setError(errorText(e)); }
  }

  function selectPlayer(player: string) {
    if (!draft || !adjusting) return;
    if (!selectedPlayer) { setSelectedPlayer(player); return; }
    if (player === selectedPlayer) { setSelectedPlayer(null); return; }
    try { setDraft(swapPlayers(draft, selectedPlayer, player)); setSelectedPlayer(null); setError(""); }
    catch (e) { setError(errorText(e)); }
  }

  async function saveRoster(participants: Participant[]) {
    if (!detail || !organizer) return;
    if ((detail.rodada.confirmado || draft) && !window.confirm("Salvar a lista cancela os times desta rodada. Continuar?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await saveParticipants(detail.rodada, participants);
      setDraft(null); setEditing(false); setAdjusting(false); setSelectedPlayer(null);
      const data = await loadRound(id); setDetail(data); setMessage("Participantes salvos. A rodada está pronta para revisão.");
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  async function confirm() {
    if (!detail || !draft || !organizer) return;
    const validation = validateTeams(draft, detail.participantes);
    if (validation) { setError(validation); return; }
    if (detail.rodada.confirmado && !window.confirm("Substituir os times confirmados desta rodada por esta distribuição?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await confirmTeams(detail.rodada, draft);
      // Limpa o rascunho após a escrita, mesmo se a atualização de tela falhar.
      setDraft(null); setAdjusting(false); setSelectedPlayer(null);
      const data = await loadRound(id); setDetail(data); setMessage("Times confirmados! Os jogadores já podem visualizar.");
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  }

  const participants = detail?.participantes ?? [];
  const keepers = participants.filter((p) => p.tipo === "goleiro_fixo" && p.status !== "removido");
  const eligible = eligiblePlayers(participants);
  const countError = availabilityError(eligible.length);
  const teams = draft ?? (detail?.rodada.confirmado ? detail.times : []);
  const names = new Map(participants.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-3.5">
      <button disabled={busy} onClick={refresh} className={secondaryClass}>ATUALIZAR RODADA</button>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-white p-3 text-sm font-bold">{message}</p>}
      {!detail && !error && <p role="status">Carregando times...</p>}
      {detail && <>
        <div className="rounded-[22px] bg-neutral-950 p-4 text-white">
          <h3 className="text-sm font-black tracking-wide">GOLEIROS FIXOS</h3>
          {keepers.length === 0 ? <p className="mt-2 text-sm text-zinc-300">Goleiros ainda não cadastrados nesta rodada.</p> : <ul className="mt-3 space-y-2">{keepers.map((p) => <li key={p.id} className="flex items-center gap-3"><Initials name={p.name} /><span className="text-sm font-bold">{p.name}{p.status === "ausente" ? " · Ausente" : ""}</span></li>)}</ul>}
        </div>
        {organizer && <>
          <div className="rounded-[22px] bg-white p-4">
            <p className="text-xs font-black uppercase text-zinc-600">Jogadores disponíveis para sorteio</p>
            <p className="mt-1 text-lg font-black">{eligible.length} jogadores de linha disponíveis</p>
            {countError && <p className="mt-2 text-sm font-bold text-red-700">{countError}</p>}
            {keepers.length !== 2 && <p className="mt-2 text-sm font-bold text-red-700">Cadastre os 2 goleiros fixos da rodada.</p>}
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Jogadores disponíveis para sorteio">{eligible.map((p) => <li key={p.id} className="rounded-lg bg-zinc-100 px-2 py-1 text-xs font-bold">{p.name}</li>)}</ul>
          </div>
          {!editing && <button disabled={busy} className={secondaryClass} onClick={() => { setEditing(true); setMessage(""); }}>EDITAR PARTICIPANTES</button>}
          {!editing && <button disabled={busy || !!countError || keepers.length !== 2} className={buttonClass} onClick={draw}>{draft || detail.rodada.confirmado ? "SORTEAR NOVAMENTE" : "SORTEAR TIMES"}</button>}
        </>}
        {editing ? <ParticipantEditor initial={participants} busy={busy} onSave={saveRoster} onCancel={() => setEditing(false)} /> : <>
          {teams.length === 0 && <p className="rounded-xl bg-white p-4 text-sm font-bold">{organizer ? "Prepare a lista e sorteie os times." : "Os times ainda não foram confirmados pela organização."}</p>}
          {teams.length > 0 && <p className="text-xs font-black uppercase text-red-700">{draft ? "Rascunho — confirme para publicar" : "Times confirmados"}</p>}
          {draft && <p className="text-xs font-semibold text-zinc-600">Este rascunho fica nesta tela até a confirmação. {detail.rodada.confirmado ? "Os jogadores continuam vendo a distribuição anterior até você confirmar." : "Os jogadores ainda não podem visualizar."}</p>}
          {adjusting && <p role="status" className="rounded-xl bg-neutral-950 p-3 text-sm font-bold text-white">{selectedPlayer ? `Selecionado: ${names.get(selectedPlayer)}. Toque em um jogador de outro time para trocar.` : "Toque em um jogador e depois em um jogador de outro time."}</p>}
          {teams.map((team) => <article key={team.numero} className="rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-black/5">
            <header className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black uppercase">{team.nome}</h3><span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">{team.jogadores.length} jogadores</span></header>
            <ul className="space-y-1.5">{team.jogadores.map((player) => <li key={player}>
              {adjusting ? <button disabled={busy} onClick={() => selectPlayer(player)} aria-pressed={selectedPlayer === player}
                aria-label={`Trocar ${names.get(player) ?? "jogador"}, ${team.nome}`}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-2 py-2 text-left ${selectedPlayer === player ? "border-red-600 bg-red-50" : "border-transparent bg-zinc-50"}`}>
                <Initials name={names.get(player) ?? "Jogador"} /><span className="text-sm font-bold">{names.get(player) ?? "Jogador"}</span>
              </button> : <div className="flex min-h-12 items-center gap-3 rounded-xl bg-zinc-50 px-2 py-2"><Initials name={names.get(player) ?? "Jogador"} /><span className="text-sm font-bold">{names.get(player) ?? "Jogador"}</span></div>}
            </li>)}</ul>
          </article>)}
          {organizer && !draft && detail.rodada.confirmado && <button disabled={busy} className={secondaryClass} onClick={() => {
            setDraft(structuredClone(detail.times)); setAdjusting(true); setSelectedPlayer(null); setMessage("");
          }}>AJUSTAR TIMES</button>}
          {organizer && draft && <div className="space-y-2">
            <button disabled={busy} className={secondaryClass} onClick={() => { setAdjusting((v) => !v); setSelectedPlayer(null); }}>{adjusting ? "CONCLUIR AJUSTES" : "AJUSTAR TIMES"}</button>
            <button disabled={busy || !!validateTeams(draft, participants)} className={buttonClass} onClick={confirm}>{busy ? "CONFIRMANDO..." : "CONFIRMAR TIMES"}</button>
            <button disabled={busy} className={secondaryClass} onClick={() => { if (window.confirm("Descartar o rascunho?")) { setDraft(null); setAdjusting(false); setSelectedPlayer(null); } }}>DESCARTAR RASCUNHO</button>
          </div>}
        </>}
      </>}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  return <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-600 text-xs font-black text-white">{name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]).join("").toUpperCase()}</span>;
}

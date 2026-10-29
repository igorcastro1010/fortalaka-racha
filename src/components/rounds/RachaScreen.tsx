"use client";

import { MoreVertical, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { useConfirmation } from "@/components/ui/useConfirmation";
import { getRoundMatches } from "@/lib/matches/repository";
import { RoundForm } from "./RoundForm";
import { OwnRegistration } from "./OwnRegistration";
import { LoadingCards, EmptyState } from "@/components/ui/ScreenState";
import { RoundSummary } from "./RoundSummary";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import {
  addRoundParticipant,
  getAvailableProfiles,
  getCurrentRoundDetails,
  removeRoundParticipant,
  updateRoundParticipant,
  type PlayerProfileOption,
  type RoundDetails,
} from "@/lib/rounds/repository";
import { createClient } from "@/lib/supabase/client";
import { updateRoundStatus, type RoundParticipant } from "@/lib/teams/repository";

export function RachaScreen({ profile, onOpenResults }: { profile: Profile; onOpenResults?: () => void }) {
  const organizer = isOrganizer(profile) && profile.active;
  const [view, setView] = useState<"lista" | "gestao">("lista");
  const [round, setRound] = useState<RoundDetails | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedType, setSelectedType] = useState<RoundParticipant["type"]>("linha");
  const [selectedStatus, setSelectedStatus] = useState<RoundParticipant["status"]>("confirmado");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmFinish, setConfirmFinish] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();

  const [matchSummary, setMatchSummary] = useState<{ roundId: string; count: number | null } | null>(null);
  const onFinalizedCountChange = useCallback((roundId: string, count: number | null) => {
    setMatchSummary({ roundId, count });
  }, []);
  const finalizedMatchCount = matchSummary?.roundId === round?.roundId ? matchSummary?.count ?? null : null;
  const roundId = round?.roundId;
  const roundStatus = round?.status;
  useEffect(() => {
    if (!roundId || !organizer) return;
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (active) onFinalizedCountChange(roundId, data.partidas.filter(match => match.status === "finalizada").length);
    }).catch(() => {
      if (active) setError("Não foi possível verificar as partidas. Consulte a aba Resultados.");
    });
    return () => { active = false; };
  }, [roundId, roundStatus, organizer, onFinalizedCountChange]);

  const finishDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (confirmFinish) finishDialog.current?.showModal();
    else finishDialog.current?.close();
  }, [confirmFinish]);

  async function loadRound() {
    const supabase = createClient();
    const [roundData, profilesData] = await Promise.all([
      getCurrentRoundDetails(supabase),
      organizer ? getAvailableProfiles(supabase) : Promise.resolve([]),
    ]);

    setRound(roundData);
    setProfiles(profilesData);
    setIsLoading(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialRound() {
      const supabase = createClient();
      const [roundData, profilesData] = await Promise.all([
        getCurrentRoundDetails(supabase),
        organizer ? getAvailableProfiles(supabase) : Promise.resolve([]),
      ]);

      if (!isMounted) {
        return;
      }

      setRound(roundData);
      setProfiles(profilesData);
      setIsLoading(false);
    }

    void loadInitialRound().catch(() => {
      if (isMounted) { setError("Não foi possível carregar os participantes desta rodada."); setIsLoading(false); }
    });

    return () => {
      isMounted = false;
    };
  }, [organizer]);

  const counts = useMemo(() => {
    const participants = round?.participants ?? [];

    return {
      fieldPlayers: participants.filter((participant) => participant.type !== "suplente" && participant.status === "confirmado").length,
      substitutes: participants.filter((participant) => participant.type === "suplente").length,
      unavailable: participants.filter((participant) => participant.status === "ausente" || participant.status === "removido").length,
    };
  }, [round?.participants]);

  const availableProfiles = profiles.filter((player) => {
    return !(round?.participants ?? []).some((participant) => participant.jogadorId === player.id && participant.status !== "removido");
  });

  async function handleAddParticipant() {
    const player = availableProfiles.find((profileOption) => profileOption.id === selectedProfileId);

    if (!round || !player) {
      setError("Selecione um jogador cadastrado.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await addRoundParticipant(supabase, {
        roundId: round.roundId,
        player,
        type: selectedType,
        status: selectedStatus,
      });
      setSelectedProfileId("");
      await loadRound();
    } catch {
      setError("Nao foi possivel adicionar o jogador. Confira se ele ja esta na rodada.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateParticipant(participant: RoundParticipant, field: "type" | "status", value: string) {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await updateRoundParticipant(supabase, participant.id, {
        type: field === "type" ? (value as RoundParticipant["type"]) : participant.type,
        status: field === "status" ? (value as RoundParticipant["status"]) : participant.status,
      });
      await loadRound();
    } catch {
      setError("Nao foi possivel atualizar o participante.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemoveParticipant(participant: RoundParticipant) {
    if (!organizer || isSaving || !await confirm({ title: "Remover participante?", description: `Remover ${participant.name} da rodada?` })) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await removeRoundParticipant(supabase, participant.id);
      await loadRound();
    } catch {
      setError("Nao foi possivel remover o participante.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCloseList() {
    if (!organizer || !round || isSaving || !await confirm({ title: "Fechar lista?", description: "Jogadores não poderão entrar ou sair até ela ser reaberta." })) {
      return;
    }

    setError("");
    setMessage("");

    setIsSaving(true);

    try {
      const supabase = createClient();
      await updateRoundStatus(supabase, round.roundId, "lista_fechada");
      await loadRound();
      setMessage("Lista fechada. A edicao normal esta bloqueada ate um organizador reabrir.");
    } catch {
      setError("Nao foi possivel fechar a lista.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReopenList() {
    if (!organizer || isSaving || !round || !await confirm({ title: "Reabrir lista?", description: "A lista será reaberta para editar participantes." })) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await updateRoundStatus(supabase, round.roundId, "aberto");
      await loadRound();
      setMessage("Lista reaberta para ajustes.");
    } catch {
      setError("Nao foi possivel reabrir a lista.");
    } finally {
      setIsSaving(false);
    }
  }


  async function requestFinish() {
    if (!organizer || !profile.active || !round || round.status === "finalizado" || isSaving) return;
    setIsSaving(true); setError(""); setMessage("");
    try {
      const matches = await getRoundMatches(round.roundId);
      const count = matches.partidas.filter(match => match.status === "finalizada").length;
      onFinalizedCountChange(round.roundId, count);
      if (count > 0) setConfirmFinish(true);
    } catch (e) { console.error("Verificação de partidas", e); setError("Não foi possível verificar as partidas."); }
    finally { setIsSaving(false); }
  }
  async function finishRound() {
    if (!organizer || !profile.active || !round || round.status === "finalizado" || isSaving) return;
    setIsSaving(true); setError(""); setMessage("");
    try {
      const { error } = await createClient().rpc("finalizar_rodada", { p_racha: round.roundId });
      if (error) throw new Error(error.code === "PGRST202" ? "Aplique a migração finalizar-rodada.sql no Supabase antes de finalizar a rodada." : error.message);
      setConfirmFinish(false);
      await loadRound();
      setMessage("Rodada finalizada. As avaliações poderão ser abertas.");
    } catch (e) { console.error("Finalização da rodada", e); setError("Não foi possível finalizar a rodada. Tente novamente."); }
    finally { setIsSaving(false); }
  }
  return (
    <section className="space-y-3.5">
      {confirmationDialog}
      <div>
        <h2 className="text-[29px] font-black leading-tight">Racha</h2>
        <p className="mt-0.5 text-xs font-black uppercase tracking-normal text-zinc-500">
          {round ? getStatusLabel(round.status) : "Crie a rodada para gerenciar a lista"}
        </p>
      </div>

      {isLoading ? <LoadingCards label="Carregando rodada..." /> : null}
      {error ? <Feedback tone="error" text={error} /> : null}
      {message ? <Feedback tone="success" text={message} /> : null}

      {!isLoading && !round && organizer && <RoundForm onSaved={loadRound} />}
      {!isLoading && !round && !organizer && <Feedback tone="neutral" text="Nenhuma rodada cadastrada. Aguarde um organizador." />}
      {round && <RoundSummary round={round} />}
      {organizer && <ViewTabs label="Áreas do racha" value={view} onChange={setView} items={[{ id: "lista", label: "Lista" }, { id: "gestao", label: "Gestão" }]} />}
      {round && <OwnRegistration key={round.roundId} round={round} profile={profile} onUpdated={loadRound} />}
      {round && organizer && view === "gestao" && <details className="border-y border-zinc-200 py-2"><summary className="min-h-11 cursor-pointer content-center text-sm font-bold">{round.status === "finalizado" ? "CRIAR PRÓXIMA RODADA" : "EDITAR DADOS DA RODADA"}</summary><RoundForm key={`${round.roundId}-${round.status}`} round={round.status === "finalizado" ? undefined : round} onSaved={loadRound} /></details>}

      {round ? (
        <>
          <Card className="grid grid-cols-3 gap-2 p-3">
            <MiniCount label="Participantes" value={counts.fieldPlayers} />
            <MiniCount label="Suplentes" value={counts.substitutes} />
            <MiniCount label="Fora" value={counts.unavailable} />
          </Card>

          {organizer && view === "gestao" && round.status !== "finalizado" ? (
            <details className="border-y border-zinc-200 py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-center gap-2 text-sm font-bold text-neutral-950 [&::-webkit-details-marker]:hidden"><Plus size={18} /> Adicionar jogador</summary>
              <div className="mt-4 space-y-3">
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                className="h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
              >
                <option value="">Selecionar jogador cadastrado</option>
                {availableProfiles.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value as RoundParticipant["type"])}
                  className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
                >
                  <option value="linha">Participante</option>
                  <option value="suplente">Suplente</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value as RoundParticipant["status"])}
                  className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="ausente">Ausente</option>
                  <option value="removido">Removido</option>
                </select>
              </div>
              <button
                onClick={handleAddParticipant}
                disabled={isSaving || !selectedProfileId}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-black uppercase tracking-normal text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                Adicionar
              </button>
              </div>
            </details>
          ) : null}

          {organizer && view === "gestao" ? (
            <div className="grid gap-2">
              {round.status === "aberto" ? (
                <button
                  onClick={handleCloseList}
                  disabled={isSaving}
                  className="h-12 rounded-lg bg-neutral-950 text-sm font-black uppercase tracking-normal text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Fechar lista
                </button>
              ) : null}
              {(round.status === "lista_fechada" || round.status === "times_confirmados") ? (
                <button
                  onClick={handleReopenList}
                  disabled={isSaving}
                  className="h-11 rounded-lg border border-zinc-200 bg-white text-xs font-black uppercase text-neutral-950 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reabrir lista
                </button>
              ) : null}
            </div>
          ) : null}

          <dialog ref={finishDialog} onCancel={event => { event.preventDefault(); if (!isSaving) setConfirmFinish(false); }} aria-labelledby="finish-title" aria-describedby="finish-description" className="fk-sheet bg-white shadow-2xl">
            <h3 id="finish-title" className="text-xl font-black">Finalizar o racha?</h3>
            <p id="finish-description" className="mt-3 text-sm text-zinc-600">Todas as partidas serão preservadas e novas partidas não poderão ser criadas.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button autoFocus disabled={isSaving} onClick={() => setConfirmFinish(false)} className="min-h-11 rounded-lg border border-zinc-200 font-bold disabled:opacity-60">CANCELAR</button>
              <button disabled={isSaving} onClick={finishRound} className="min-h-11 rounded-lg bg-red-600 font-bold text-white disabled:opacity-60">FINALIZAR</button>
            </div>
          </dialog>
          {organizer && view === "gestao" && round.status !== "finalizado" ? (
            <Card>
              <button
                onClick={requestFinish}
                disabled={!profile.active || isSaving || !["times_confirmados", "em_andamento"].includes(round.status) || finalizedMatchCount === null || finalizedMatchCount < 1}
                aria-describedby="finish-round-status"
                className="h-12 w-full rounded-lg bg-neutral-950 text-sm font-black text-white transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500 disabled:hover:bg-zinc-200 disabled:active:scale-100"
              >
                FINALIZAR RACHA
              </button>
              <p id="finish-round-status" aria-live="polite" className="mt-3 text-xs font-black uppercase tracking-normal text-zinc-500">
                {finalizedMatchCount === null ? "Verificando partidas da rodada..." : finalizedMatchCount === 0 ? "Finalize pelo menos uma partida antes de encerrar a rodada." : !["times_confirmados", "em_andamento"].includes(round.status) ? "Confirme os times antes de finalizar a rodada." : `${finalizedMatchCount} partidas finalizadas`}
              </p>
              {onOpenResults && <button onClick={onOpenResults} className="mt-2 min-h-11 w-full rounded-lg border border-zinc-200 text-xs font-black">IR PARA RESULTADOS</button>}
            </Card>
          ) : null}

          <ParticipantSection
            title="Participantes"
            participants={round.participants.filter((participant) => participant.status !== "removido" && participant.type !== "suplente")}
            editable={organizer && view === "gestao" && round.status !== "finalizado"}
            onUpdate={handleUpdateParticipant}
            onRemove={handleRemoveParticipant}
          />
          <ParticipantSection
            title="Suplentes"
            participants={round.participants.filter((participant) => participant.status !== "removido" && participant.type === "suplente")}
            editable={organizer && view === "gestao" && round.status !== "finalizado"}
            onUpdate={handleUpdateParticipant}
            onRemove={handleRemoveParticipant}
          />
        </>
      ) : null}
    </section>
  );
}

function ParticipantSection({
  title,
  participants,
  editable,
  onUpdate,
  onRemove,
}: {
  title: string;
  participants: RoundParticipant[];
  editable: boolean;
  onUpdate: (participant: RoundParticipant, field: "type" | "status", value: string) => void;
  onRemove: (participant: RoundParticipant) => void;
}) {
  return (
    <Card>
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-2xl font-black text-red-600">{title}</h3>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-700">
          {participants.length}
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {participants.map((participant) => (
          <div key={participant.id} className="py-2">
            <div className="flex items-center gap-3">
              <div className={`min-w-0 flex-1 ${editable ? "pr-11" : ""}`}>
                <PlayerIdentity playerId={participant.jogadorId} name={participant.name} avatarUrl={participant.avatarUrl} size="md" className="text-sm [&>span]:font-black" />
                <div className="mt-1 ml-12 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-zinc-500"><span>{getParticipantStatusLabel(participant.status)}</span><span>{participant.type === "suplente" ? "Suplente" : "Participante"}</span></div>
              </div>
            </div>
            {editable ? (
              <details className="relative -mt-11">
                <summary aria-label={`Editar ${participant.name}`} className="ml-auto flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 [&::-webkit-details-marker]:hidden"><MoreVertical size={19} /></summary>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3">
                <select
                  aria-label={`Categoria de ${participant.name}`}
                  value={participant.type === "suplente" ? "suplente" : "linha"}
                  onChange={(event) => onUpdate(participant, "type", event.target.value)}
                  className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold outline-none"
                >
                  <option value="linha">Participante</option>
                  <option value="suplente">Suplente</option>
                </select>
                <select
                  aria-label={`Presença de ${participant.name}`}
                  value={participant.status}
                  onChange={(event) => onUpdate(participant, "status", event.target.value)}
                  className="h-11 rounded-lg border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold outline-none"
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="ausente">Ausente</option>
                  <option value="removido">Removido</option>
                </select>
                <button onClick={() => onRemove(participant)} className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-100 bg-white text-xs font-black text-red-600 transition hover:bg-red-50"><Trash2 size={15} /> Remover da rodada</button>
              </div>
              </details>
            ) : null}
          </div>
        ))}
        {!participants.length ? (
          <EmptyState title="Ninguém por aqui ainda" description="Os jogadores aparecem nesta lista quando forem inscritos." />
        ) : null}
      </div>
    </Card>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 px-1 py-2 text-center">
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-xs text-zinc-600">{label}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`fk-section ${className}`}>{children}</div>;
}

function Feedback({ text, tone }: { text: string; tone: "error" | "success" | "neutral" }) {
  const toneClass = {
    error: "bg-red-50 text-red-700 ring-red-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-zinc-50 text-zinc-700 ring-zinc-100",
  }[tone];

  return <p role={tone === "error" ? "alert" : tone === "success" ? "status" : undefined} className={`rounded-lg p-3 text-sm font-semibold ring-1 ${toneClass}`}>{text}</p>;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    aberto: "Lista aberta",
    lista_fechada: "Lista fechada",
    times_confirmados: "Times confirmados",
    em_andamento: "Racha em andamento",
    finalizado: "RODADA FINALIZADA",
  };

  return labels[status] ?? status;
}

function getParticipantStatusLabel(status: RoundParticipant["status"]) {
  const labels = {
    confirmado: "Confirmado",
    ausente: "Ausente",
    removido: "Removido",
  };

  return labels[status];
}

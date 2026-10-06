"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { nextMatch } from "@/data/mock";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import {
  addRoundParticipant,
  createRound,
  getAvailableProfiles,
  getCurrentRoundDetails,
  removeRoundParticipant,
  updateRoundParticipant,
  type PlayerProfileOption,
  type RoundDetails,
} from "@/lib/rounds/repository";
import { createClient } from "@/lib/supabase/client";
import { updateRoundStatus, type RoundParticipant } from "@/lib/teams/repository";

export function RachaScreen({ profile }: { profile: Profile }) {
  const organizer = isOrganizer(profile);
  const [round, setRound] = useState<RoundDetails | null>(null);
  const [profiles, setProfiles] = useState<PlayerProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [selectedType, setSelectedType] = useState<RoundParticipant["type"]>("linha");
  const [selectedStatus, setSelectedStatus] = useState<RoundParticipant["status"]>("confirmado");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    void loadInitialRound();

    return () => {
      isMounted = false;
    };
  }, [organizer]);

  const counts = useMemo(() => {
    const participants = round?.participants ?? [];

    return {
      goalkeepers: participants.filter((participant) => participant.type === "goleiro" && participant.status === "confirmado").length,
      fieldPlayers: participants.filter((participant) => participant.type === "linha" && participant.status === "confirmado").length,
      substitutes: participants.filter((participant) => participant.type === "suplente").length,
      unavailable: participants.filter((participant) => participant.status === "ausente" || participant.status === "removido").length,
    };
  }, [round?.participants]);

  const availableProfiles = profiles.filter((player) => {
    return !(round?.participants ?? []).some((participant) => participant.jogadorId === player.id);
  });

  async function handleCreateRound() {
    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await createRound(supabase, {
        name: "Racha Fortalaka",
        date: toIsoDate(nextMatch.date),
        time: nextMatch.time,
        address: nextMatch.address,
      });
      await loadRound();
      setMessage("Rodada criada. Agora adicione os participantes.");
    } catch {
      setError("Nao foi possivel criar a rodada.");
    } finally {
      setIsSaving(false);
    }
  }

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
    if (!window.confirm(`Remover ${participant.name} da rodada?`)) {
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
    if (!round) {
      return;
    }

    setError("");
    setMessage("");

    if (counts.goalkeepers !== 2 || counts.fieldPlayers !== 20) {
      setError("Para fechar a lista, a rodada precisa ter 2 goleiros fixos e exatamente 20 jogadores de linha confirmados.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      await updateRoundStatus(supabase, round.roundId, "lista_fechada");
      await loadRound();
      setMessage("Lista fechada. Sorteio liberado na aba Times.");
    } catch {
      setError("Nao foi possivel fechar a lista.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReopenList() {
    if (!round || !window.confirm("Reabrir a lista para editar participantes?")) {
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

  return (
    <section className="space-y-3.5">
      <div>
        <h2 className="text-[29px] font-black leading-tight tracking-normal">Racha</h2>
        <p className="mt-0.5 text-sm font-bold text-zinc-600">
          {round ? `${round.roundName} - ${getStatusLabel(round.status)}` : "Crie a rodada para gerenciar a lista"}
        </p>
      </div>

      {isLoading ? <Feedback tone="neutral" text="Carregando rodada..." /> : null}
      {error ? <Feedback tone="error" text={error} /> : null}
      {message ? <Feedback tone="success" text={message} /> : null}

      {!round ? (
        <Card>
          <p className="text-lg font-black">Nenhuma rodada cadastrada.</p>
          <p className="mt-1 text-sm font-bold text-zinc-600">Crie a rodada da proxima quinta para adicionar participantes.</p>
          {organizer ? (
            <button
              onClick={handleCreateRound}
              disabled={isSaving}
              className="mt-4 h-12 w-full rounded-[18px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Criando..." : "Criar rodada"}
            </button>
          ) : null}
        </Card>
      ) : null}

      {round ? (
        <>
          <Card className="grid grid-cols-4 gap-2 p-3">
            <MiniCount label="Goleiros" value={counts.goalkeepers} />
            <MiniCount label="Linha" value={counts.fieldPlayers} />
            <MiniCount label="Suplentes" value={counts.substitutes} />
            <MiniCount label="Fora" value={counts.unavailable} />
          </Card>

          {organizer && round.status === "aberto" ? (
            <Card className="space-y-3">
              <h3 className="text-lg font-black">Adicionar jogador</h3>
              <select
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                className="h-12 w-full rounded-[16px] border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
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
                  className="h-11 rounded-[16px] border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
                >
                  <option value="linha">Linha</option>
                  <option value="goleiro">Goleiro</option>
                  <option value="suplente">Suplente</option>
                </select>
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value as RoundParticipant["status"])}
                  className="h-11 rounded-[16px] border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold outline-none"
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="ausente">Ausente</option>
                  <option value="removido">Removido</option>
                </select>
              </div>
              <button
                onClick={handleAddParticipant}
                disabled={isSaving || !selectedProfileId}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={18} />
                Adicionar
              </button>
            </Card>
          ) : null}

          {organizer ? (
            <div className="grid gap-2">
              {round.status === "aberto" ? (
                <button
                  onClick={handleCloseList}
                  disabled={isSaving}
                  className="h-12 rounded-[18px] bg-neutral-950 text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Fechar lista
                </button>
              ) : null}
              {(round.status === "lista_fechada" || round.status === "times_confirmados") ? (
                <button
                  onClick={handleReopenList}
                  disabled={isSaving}
                  className="h-11 rounded-[16px] border border-zinc-200 bg-white text-xs font-black uppercase text-neutral-950 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reabrir lista
                </button>
              ) : null}
            </div>
          ) : null}

          <ParticipantSection
            title="Goleiros"
            participants={round.participants.filter((participant) => participant.type === "goleiro")}
            editable={organizer && round.status === "aberto"}
            onUpdate={handleUpdateParticipant}
            onRemove={handleRemoveParticipant}
          />
          <ParticipantSection
            title="Linha"
            participants={round.participants.filter((participant) => participant.type === "linha")}
            editable={organizer && round.status === "aberto"}
            onUpdate={handleUpdateParticipant}
            onRemove={handleRemoveParticipant}
          />
          <ParticipantSection
            title="Suplentes"
            participants={round.participants.filter((participant) => participant.type === "suplente")}
            editable={organizer && round.status === "aberto"}
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
        <h3 className="text-lg font-black">{title}</h3>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
          {participants.length}
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {participants.map((participant) => (
          <div key={participant.id} className="py-2">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-red-600 text-xs font-black text-white">
                {getInitials(participant.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{participant.name}</p>
                <p className="text-xs font-bold text-zinc-600">{getParticipantStatusLabel(participant.status)}</p>
              </div>
              {editable ? (
                <button
                  onClick={() => onRemove(participant)}
                  className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-zinc-100 text-zinc-700 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={17} />
                </button>
              ) : null}
            </div>
            {editable ? (
              <div className="mt-2 grid grid-cols-2 gap-2 pl-12">
                <select
                  value={participant.type}
                  onChange={(event) => onUpdate(participant, "type", event.target.value)}
                  className="h-9 rounded-[13px] border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold outline-none"
                >
                  <option value="linha">Linha</option>
                  <option value="goleiro">Goleiro</option>
                  <option value="suplente">Suplente</option>
                </select>
                <select
                  value={participant.status}
                  onChange={(event) => onUpdate(participant, "status", event.target.value)}
                  className="h-9 rounded-[13px] border border-zinc-200 bg-zinc-50 px-2 text-xs font-bold outline-none"
                >
                  <option value="confirmado">Confirmado</option>
                  <option value="ausente">Ausente</option>
                  <option value="removido">Removido</option>
                </select>
              </div>
            ) : null}
          </div>
        ))}
        {!participants.length ? (
          <p className="py-3 text-sm font-bold text-zinc-600">Nenhum participante nessa secao.</p>
        ) : null}
      </div>
    </Card>
  );
}

function MiniCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[14px] bg-zinc-50 px-2 py-2 text-center ring-1 ring-zinc-100">
      <p className="text-lg font-black">{value}</p>
      <p className="truncate text-[10px] font-bold text-zinc-600">{label}</p>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ring-1 ring-black/5 ${className}`}>{children}</div>;
}

function Feedback({ text, tone }: { text: string; tone: "error" | "success" | "neutral" }) {
  const toneClass = {
    error: "bg-red-50 text-red-700 ring-red-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-zinc-50 text-zinc-700 ring-zinc-100",
  }[tone];

  return <p className={`rounded-[16px] p-3 text-sm font-bold ring-1 ${toneClass}`}>{text}</p>;
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    aberto: "lista aberta",
    lista_fechada: "lista fechada",
    times_confirmados: "times confirmados",
    finalizado: "finalizado",
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

function toIsoDate(date: string) {
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}`;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

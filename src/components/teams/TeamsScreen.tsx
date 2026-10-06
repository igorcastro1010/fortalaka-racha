"use client";

import { RefreshCw, Shuffle, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldPlayers, goalkeepers } from "@/data/mock";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { drawTeams, getTeamCount, hasCompleteTeams, swapPlayers, type DrawTeam, type TeamDraw, type TeamPlayer } from "@/lib/teams/draw";
import { confirmTeams, getCurrentRoundTeamsState, saveDraftTeams, updateRoundStatus, type RoundParticipant, type RoundStatus, type RoundTeamsState } from "@/lib/teams/repository";

type TeamsScreenProps = {
  profile: Profile;
};

export function TeamsScreen({ profile }: TeamsScreenProps) {
  const organizer = isOrganizer(profile);
  const [roundState, setRoundState] = useState<RoundTeamsState | null>(null);
  const [draw, setDraw] = useState<TeamDraw | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [adjustMode, setAdjustMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadTeams() {
      setIsLoading(true);
      setError("");

      try {
        const state = await fetchRoundTeamsState();

        if (!isMounted) {
          return;
        }

        setRoundState(state);
        setDraw(state?.teams.length ? { teams: state.teams } : null);
      } catch {
        if (isMounted) {
          setError("Não foi possível carregar os times desta rodada.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  const goalkeepersToShow = roundState ? roundState.goalkeepers : createMockGoalkeepers();
  const fieldPlayersToUse = roundState ? roundState.fieldPlayers : createMockFieldPlayers();
  const roundStatus = roundState?.status ?? "aberto";
  const confirmed = roundStatus === "times_confirmados" || roundStatus === "finalizado" || Boolean(roundState?.confirmed);
  const listClosed = roundStatus === "lista_fechada";
  const finalized = roundStatus === "finalizado";
  const canShowTeams = organizer || confirmed;

  const confirmedPlayersCount = useMemo(
    () => fieldPlayersToUse.filter((player) => player).length,
    [fieldPlayersToUse],
  );
  const teamsToFormCount = getTeamCount(confirmedPlayersCount);
  const hasPlayersToDraw = confirmedPlayersCount > 0;

  async function reloadPersistedTeams(fallbackDraw?: TeamDraw) {
    const updatedState = await fetchRoundTeamsState();
    setRoundState(updatedState);
    setDraw(updatedState?.teams.length ? { teams: updatedState.teams } : fallbackDraw ?? null);
    return updatedState;
  }

  async function handleDrawTeams() {
    setError("");
    setMessage("");

    if (!listClosed) {
      setError("Feche a lista da rodada antes de sortear os times.");
      return;
    }

    if (!roundState?.roundId) {
      setError("Cadastre a rodada no Supabase antes de sortear os times.");
      return;
    }

    if (!hasPlayersToDraw) {
      setError("Nenhum jogador de linha disponível para sorteio.");
      return;
    }

    if (confirmed && !window.confirm("Os times ja estao confirmados. Deseja sortear novamente e sobrescrever?")) {
      return;
    }

    setIsSaving(true);

    try {
      const nextDraw = drawTeams(fieldPlayersToUse);
      const supabase = createClient();
      await saveDraftTeams(supabase, roundState.roundId, nextDraw.teams);
      await reloadPersistedTeams(nextDraw);
      setAdjustMode(false);
      setSelectedPlayerId(null);
      setMessage("Times sorteados e salvos como rascunho.");
    } catch (drawError) {
      setError(drawError instanceof Error ? drawError.message : "Não foi possível salvar o sorteio. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePlayerClick(player: TeamPlayer) {
    if (!organizer || !adjustMode || !draw || !listClosed) {
      return;
    }

    if (!selectedPlayerId) {
      setSelectedPlayerId(player.id);
      return;
    }

    if (!roundState?.roundId) {
      setError("Cadastre a rodada no Supabase antes de ajustar os times.");
      return;
    }

    const nextDraw = swapPlayers(draw, selectedPlayerId, player.id);
    setSelectedPlayerId(null);

    if (nextDraw === draw) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await saveDraftTeams(supabase, roundState.roundId, nextDraw.teams);
      await reloadPersistedTeams(nextDraw);
      setMessage("Ajuste salvo.");
    } catch {
      setError("Não foi possível salvar o ajuste dos times. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmTeams() {
    setError("");
    setMessage("");

    if (!draw || !hasCompleteTeams(draw)) {
      setError("Sorteie os times antes de confirmar.");
      return;
    }

    if (!roundState?.roundId) {
      setError("Cadastre a rodada e os participantes no Supabase antes de confirmar os times.");
      return;
    }

    if (!listClosed) {
      setError("A lista precisa estar fechada para confirmar os times.");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createClient();
      await confirmTeams(supabase, roundState.roundId);
      await reloadPersistedTeams(draw);
      setAdjustMode(false);
      setSelectedPlayerId(null);
      setMessage("Times confirmados com sucesso.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Nao foi possivel confirmar os times.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCloseList() {
    setError("");
    setMessage("");

    if (!roundState?.roundId) {
      setError("Cadastre a rodada no Supabase antes de fechar a lista.");
      return;
    }

    await changeRoundStatus("lista_fechada", "Lista fechada. A edicao normal esta bloqueada ate um organizador reabrir.");
  }

  async function handleReopenList() {
    if (!roundState?.roundId) {
      return;
    }

    if (!window.confirm("Reabrir a lista permite editar participantes e pode exigir novo sorteio. Deseja continuar?")) {
      return;
    }

    await changeRoundStatus("aberto", "Lista reaberta para ajustes.");
    setAdjustMode(false);
    setSelectedPlayerId(null);
  }

  async function changeRoundStatus(status: RoundStatus, successMessage: string) {
    if (!roundState?.roundId) {
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      await updateRoundStatus(supabase, roundState.roundId, status);
      await reloadPersistedTeams(draw ?? undefined);
      setMessage(successMessage);
    } catch {
      setError("Nao foi possivel atualizar o estado da rodada.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3.5">
      <div>
        <h2 className="text-[29px] font-black leading-tight tracking-normal">Times</h2>
        <p className="mt-0.5 text-sm font-bold text-zinc-600">
          {confirmed ? "Times confirmados para a rodada" : "Sorteio liberado quando a lista fechar"}
        </p>
      </div>

      <RoundStatusBadge status={roundStatus} />

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Goleiros Fixos</p>
            <h3 className="mt-1 text-lg font-black">Fora do sorteio</h3>
          </div>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-black text-zinc-700">
            {goalkeepersToShow.length} goleiros
          </span>
        </div>
        <div className="grid gap-2">
          {goalkeepersToShow.map((goalkeeper) => (
            <PlayerPill key={goalkeeper.id} player={goalkeeper} />
          ))}
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-red-50 text-red-600">
            <Users size={22} />
          </div>
          <div>
            <p className="text-lg font-black">{confirmedPlayersCount} jogadores de linha</p>
            <p className="text-xs font-bold text-zinc-600">{getTeamsToFormLabel(teamsToFormCount)}</p>
          </div>
        </div>
      </Card>

      {organizer ? (
        <OrganizerControls
          hasDraw={Boolean(draw)}
          confirmed={confirmed}
          listClosed={listClosed}
          finalized={finalized}
          adjustMode={adjustMode}
          isSaving={isSaving}
          onDraw={handleDrawTeams}
          onCloseList={handleCloseList}
          onReopenList={handleReopenList}
          onToggleAdjust={() => {
            setAdjustMode((current) => !current);
            setSelectedPlayerId(null);
          }}
          onConfirm={handleConfirmTeams}
          canDraw={hasPlayersToDraw}
        />
      ) : null}

      {error ? <Feedback tone="error" text={error} /> : null}
      {message ? <Feedback tone="success" text={message} /> : null}
      {listClosed && !hasPlayersToDraw ? <Feedback tone="neutral" text="Nenhum jogador de linha disponível para sorteio." /> : null}
      {adjustMode ? <Feedback tone="neutral" text="Toque em um jogador e depois em outro jogador de outro time para trocar." /> : null}

      {isLoading ? <Feedback tone="neutral" text="Carregando times..." /> : null}

      {!canShowTeams ? (
        <Card>
          <p className="text-base font-black">Times ainda nao confirmados.</p>
          <p className="mt-1 text-sm font-bold text-zinc-600">Quando os organizadores confirmarem, os jogadores poderao visualizar aqui.</p>
        </Card>
      ) : null}

      {canShowTeams && draw ? (
        <div className="space-y-3">
          {draw.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              selectedPlayerId={selectedPlayerId}
              adjustMode={adjustMode && organizer && listClosed}
              onPlayerClick={handlePlayerClick}
            />
          ))}
        </div>
      ) : null}

      {canShowTeams && !draw && !isLoading ? (
        <Card>
          <p className="text-base font-black">Nenhum sorteio feito ainda.</p>
          <p className="mt-1 text-sm font-bold text-zinc-600">
            {organizer ? "Use o botao de sorteio para gerar os times." : "Aguarde a confirmacao dos organizadores."}
          </p>
        </Card>
      ) : null}
    </section>
  );
}

function OrganizerControls({
  hasDraw,
  confirmed,
  listClosed,
  finalized,
  adjustMode,
  isSaving,
  onDraw,
  onCloseList,
  onReopenList,
  onToggleAdjust,
  onConfirm,
  canDraw,
}: {
  hasDraw: boolean;
  confirmed: boolean;
  listClosed: boolean;
  finalized: boolean;
  adjustMode: boolean;
  isSaving: boolean;
  onDraw: () => void;
  onCloseList: () => void;
  onReopenList: () => void;
  onToggleAdjust: () => void;
  onConfirm: () => void;
  canDraw: boolean;
}) {
  return (
    <div className="grid gap-2">
      {!listClosed && !confirmed && !finalized ? (
        <button
          onClick={onCloseList}
          disabled={isSaving}
          className="h-12 rounded-[18px] bg-neutral-950 text-sm font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Fechar lista
        </button>
      ) : null}
      {confirmed && !finalized ? (
        <button
          onClick={onReopenList}
          disabled={isSaving}
          className="h-11 rounded-[16px] border border-zinc-200 bg-white text-xs font-black uppercase text-neutral-950 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reabrir / editar rodada
        </button>
      ) : null}
      <button
        onClick={onDraw}
        disabled={!listClosed || finalized || !canDraw}
        className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {hasDraw ? <RefreshCw size={18} /> : <Shuffle size={18} />}
        {hasDraw ? "Sortear novamente" : "Sortear times"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onToggleAdjust}
          disabled={!hasDraw || !listClosed || finalized}
          className="h-11 rounded-[16px] border border-zinc-200 bg-white text-xs font-black uppercase text-neutral-950 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adjustMode ? "Concluir ajuste" : "Ajustar times"}
        </button>
        <button
          onClick={onConfirm}
          disabled={!hasDraw || !listClosed || isSaving || finalized}
          className="h-11 rounded-[16px] bg-neutral-950 text-xs font-black uppercase text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Confirmar times"}
        </button>
      </div>
    </div>
  );
}

function TeamCard({
  team,
  selectedPlayerId,
  adjustMode,
  onPlayerClick,
}: {
  team: DrawTeam;
  selectedPlayerId: string | null;
  adjustMode: boolean;
  onPlayerClick: (player: TeamPlayer) => void;
}) {
  return (
    <Card className="space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">{team.name}</h3>
          <p className="text-xs font-bold text-zinc-600">{team.players.length} jogadores</p>
        </div>
        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">
          Time {team.number}
        </span>
      </div>
      <div className="grid gap-1.5">
        {team.players.map((player) => (
          <PlayerPill
            key={player.id}
            player={player}
            selected={selectedPlayerId === player.id}
            clickable={adjustMode}
            onClick={() => onPlayerClick(player)}
          />
        ))}
      </div>
    </Card>
  );
}

function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const labels: Record<RoundStatus, string> = {
    aberto: "Rodada aberta",
    lista_fechada: "Lista fechada",
    times_confirmados: "Times confirmados",
    finalizado: "Racha finalizado",
  };

  const descriptions: Record<RoundStatus, string> = {
    aberto: "Organizadores podem editar participantes. Sorteio oficial ainda bloqueado.",
    lista_fechada: "Lista fechada. O sorteio fica disponível quando houver pelo menos um jogador de linha.",
    times_confirmados: "Times salvos e liberados para visualizacao dos jogadores.",
    finalizado: "Rodada encerrada. Times preservados no historico.",
  };

  return (
    <div className="rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">{labels[status]}</p>
        <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-black uppercase text-red-700">
          {status.replace("_", " ")}
        </span>
      </div>
      <p className="mt-1 text-xs font-bold text-zinc-600">{descriptions[status]}</p>
    </div>
  );
}

function PlayerPill({
  player,
  selected = false,
  clickable = false,
  onClick,
}: {
  player: TeamPlayer;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex min-h-11 w-full items-center gap-3 rounded-[16px] px-2.5 text-left transition ${
        selected ? "bg-red-50 ring-2 ring-red-500" : "bg-zinc-50 ring-1 ring-zinc-100"
      } ${clickable ? "active:scale-[0.99]" : "cursor-default"}`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px] bg-red-600 text-xs font-black text-white">
        {getInitials(player.name)}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-black text-neutral-950">{player.name}</span>
    </button>
  );
}

function Feedback({ text, tone }: { text: string; tone: "error" | "success" | "neutral" }) {
  const toneClass = {
    error: "bg-red-50 text-red-700 ring-red-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-zinc-50 text-zinc-700 ring-zinc-100",
  }[tone];

  return <p className={`rounded-[16px] p-3 text-sm font-bold ring-1 ${toneClass}`}>{text}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ring-1 ring-black/5 ${className}`}>{children}</div>;
}

function createMockGoalkeepers(): RoundParticipant[] {
  return goalkeepers.slice(0, 2).map((name) => ({
    id: `mock-goleiro-${name}`,
    jogadorId: null,
    name,
    type: "goleiro",
    status: "confirmado",
  }));
}

function createMockFieldPlayers(): RoundParticipant[] {
  return fieldPlayers.map((name) => ({
    id: `mock-linha-${name}`,
    jogadorId: null,
    name,
    type: "linha",
    status: "confirmado",
  }));
}

function getTeamsToFormLabel(teamCount: number) {
  if (teamCount <= 0) {
    return "Nenhum time será formado";
  }

  return teamCount === 1 ? "1 time será formado" : `${teamCount} times serão formados`;
}

async function fetchRoundTeamsState() {
  const supabase = createClient();
  return getCurrentRoundTeamsState(supabase);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

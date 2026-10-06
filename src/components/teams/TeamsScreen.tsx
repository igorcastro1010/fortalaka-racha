"use client";

import { RefreshCw, Shuffle, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fieldPlayers, goalkeepers } from "@/data/mock";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { drawTeams, hasCompleteTeams, swapPlayers, validateFieldPlayers, type DrawTeam, type TeamDraw, type TeamPlayer } from "@/lib/teams/draw";
import { confirmTeams, getCurrentRoundTeamsState, type RoundParticipant, type RoundTeamsState } from "@/lib/teams/repository";

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
      const supabase = createClient();
      const state = await getCurrentRoundTeamsState(supabase);

      if (!isMounted) {
        return;
      }

      setRoundState(state);
      setDraw(state?.teams.length ? { teams: state.teams } : null);
      setIsLoading(false);
    }

    void loadTeams();

    return () => {
      isMounted = false;
    };
  }, []);

  const goalkeepersToShow = roundState?.goalkeepers.length ? roundState.goalkeepers : createMockGoalkeepers();
  const fieldPlayersToUse = roundState?.fieldPlayers.length ? roundState.fieldPlayers : createMockFieldPlayers();
  const validationError = validateFieldPlayers(fieldPlayersToUse);
  const confirmed = Boolean(roundState?.confirmed);
  const canShowTeams = organizer || confirmed;

  const confirmedPlayersCount = useMemo(
    () => fieldPlayersToUse.filter((player) => player).length,
    [fieldPlayersToUse],
  );

  function handleDrawTeams() {
    setError("");
    setMessage("");

    if (validationError) {
      setError(validationError);
      return;
    }

    if (confirmed && !window.confirm("Os times ja estao confirmados. Deseja sortear novamente e sobrescrever?")) {
      return;
    }

    setDraw(drawTeams(fieldPlayersToUse));
    setAdjustMode(false);
    setSelectedPlayerId(null);
    setMessage("Times sorteados. Revise antes de confirmar.");
  }

  function handlePlayerClick(player: TeamPlayer) {
    if (!organizer || !adjustMode || !draw || confirmed) {
      return;
    }

    if (!selectedPlayerId) {
      setSelectedPlayerId(player.id);
      return;
    }

    setDraw(swapPlayers(draw, selectedPlayerId, player.id));
    setSelectedPlayerId(null);
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

    setIsSaving(true);

    try {
      const supabase = createClient();
      await confirmTeams(supabase, roundState.roundId, draw.teams);
      const updatedState = await getCurrentRoundTeamsState(supabase);
      setRoundState(updatedState);
      setDraw(updatedState?.teams.length ? { teams: updatedState.teams } : draw);
      setAdjustMode(false);
      setSelectedPlayerId(null);
      setMessage("Times confirmados com sucesso.");
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "Nao foi possivel confirmar os times.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-3.5">
      <div>
        <h2 className="text-[29px] font-black leading-tight tracking-normal">Times</h2>
        <p className="mt-0.5 text-sm font-bold text-zinc-600">
          {confirmed ? "Times confirmados para a rodada" : "Sorteio oficial do racha"}
        </p>
      </div>

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
            <p className="text-xs font-bold text-zinc-600">Disponiveis para 4 times de 5</p>
          </div>
        </div>
      </Card>

      {organizer ? (
        <OrganizerControls
          hasDraw={Boolean(draw)}
          confirmed={confirmed}
          adjustMode={adjustMode}
          isSaving={isSaving}
          onDraw={handleDrawTeams}
          onToggleAdjust={() => {
            setAdjustMode((current) => !current);
            setSelectedPlayerId(null);
          }}
          onConfirm={handleConfirmTeams}
        />
      ) : null}

      {error ? <Feedback tone="error" text={error} /> : null}
      {message ? <Feedback tone="success" text={message} /> : null}
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
              adjustMode={adjustMode && organizer && !confirmed}
              onPlayerClick={handlePlayerClick}
            />
          ))}
        </div>
      ) : null}

      {canShowTeams && !draw && !isLoading ? (
        <Card>
          <p className="text-base font-black">Nenhum sorteio feito ainda.</p>
          <p className="mt-1 text-sm font-bold text-zinc-600">
            {organizer ? "Use o botao de sorteio para gerar os 4 times." : "Aguarde a confirmacao dos organizadores."}
          </p>
        </Card>
      ) : null}
    </section>
  );
}

function OrganizerControls({
  hasDraw,
  confirmed,
  adjustMode,
  isSaving,
  onDraw,
  onToggleAdjust,
  onConfirm,
}: {
  hasDraw: boolean;
  confirmed: boolean;
  adjustMode: boolean;
  isSaving: boolean;
  onDraw: () => void;
  onToggleAdjust: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="grid gap-2">
      <button
        onClick={onDraw}
        className="flex h-12 items-center justify-center gap-2 rounded-[18px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
      >
        {hasDraw ? <RefreshCw size={18} /> : <Shuffle size={18} />}
        {hasDraw ? "Sortear novamente" : "Sortear times"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onToggleAdjust}
          disabled={!hasDraw || confirmed}
          className="h-11 rounded-[16px] border border-zinc-200 bg-white text-xs font-black uppercase text-neutral-950 shadow-sm transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adjustMode ? "Concluir ajuste" : "Ajustar times"}
        </button>
        <button
          onClick={onConfirm}
          disabled={!hasDraw || isSaving}
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

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

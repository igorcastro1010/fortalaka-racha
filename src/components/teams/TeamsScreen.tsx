"use client";

import { RefreshCw, Shuffle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { drawTeams, getTeamCount, hasCompleteTeams, swapPlayers, type DrawTeam, type TeamDraw, type TeamPlayer } from "@/lib/teams/draw";
import { confirmTeams, getCurrentRoundTeamsState, saveDraftTeams, type RoundStatus, type RoundTeamsState } from "@/lib/teams/repository";

type TeamsScreenProps = {
  profile: Profile;
};

export function TeamsScreen({ profile }: TeamsScreenProps) {
  const organizer = isOrganizer(profile) && profile.active;
  const [view, setView] = useState<"times" | "ajustes">("times");
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

  const fieldPlayersToUse = roundState?.fieldPlayers ?? [];
  const roundStatus = roundState?.status ?? "aberto";
  const confirmed = ["times_confirmados", "em_andamento", "finalizado"].includes(roundStatus) || Boolean(roundState?.confirmed);
  const listClosed = roundStatus === "lista_fechada";
  const finalized = roundStatus === "finalizado" || roundStatus === "em_andamento";
  const canShowTeams = organizer || confirmed;

  const confirmedPlayersCount = fieldPlayersToUse.length;
  const teamsToFormCount = getTeamCount(confirmedPlayersCount);
  const hasPlayersToDraw = confirmedPlayersCount > 0;

  async function reloadPersistedTeams() {
    const updatedState = await fetchRoundTeamsState();
    setRoundState(updatedState);
    setDraw(updatedState?.teams.length ? { teams: updatedState.teams } : null);
    return updatedState;
  }

  async function handleDrawTeams() {
    if (!organizer || isSaving || isLoading || finalized) return;
    setError("");
    setMessage("");

    if (!listClosed && !confirmed) {
      setError("Feche a lista da rodada antes de sortear os times.");
      return;
    }

    if (!roundState?.roundId) {
      setError("Cadastre a rodada no Supabase antes de sortear os times.");
      return;
    }

    if (!hasPlayersToDraw) {
      setError("Nenhum participante disponível para sorteio.");
      return;
    }

    if (confirmed && !window.confirm("Os times ja estao confirmados. Deseja sortear novamente e sobrescrever?")) {
      return;
    }

    setIsSaving(true);

    try {
      const nextDraw = drawTeams(fieldPlayersToUse);
      const supabase = createClient();
      await saveDraftTeams(supabase, roundState.roundId, nextDraw.teams, roundState.version);
      await reloadPersistedTeams();
      setAdjustMode(false);
      setSelectedPlayerId(null);
      setMessage("Times sorteados e salvos como rascunho.");
    } catch (drawError) {
      console.error("Sorteio de times", drawError);
      setError("Não foi possível salvar o sorteio. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePlayerClick(player: TeamPlayer) {
    if (!organizer || isSaving || !adjustMode || !draw || !listClosed) {
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
      await saveDraftTeams(supabase, roundState.roundId, nextDraw.teams, roundState.version);
      await reloadPersistedTeams();
      setMessage("Ajuste salvo.");
    } catch {
      setError("Não foi possível salvar o ajuste dos times. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleConfirmTeams() {
    if (!organizer || isSaving || isLoading || finalized) return;
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
      await confirmTeams(supabase, roundState.roundId, roundState.version);
      await reloadPersistedTeams();
      setAdjustMode(false);
      setSelectedPlayerId(null);
      setMessage("Times confirmados com sucesso.");
    } catch (confirmError) {
      console.error("Confirmação de times", confirmError);
      setError("Não foi possível confirmar os times. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[29px] font-black leading-tight">Times</h2>
        <p className="mt-0.5 text-xs font-black uppercase tracking-normal text-zinc-500">
          Sorteio da rodada
        </p>
      </div>

      {organizer && <ViewTabs label="Áreas dos times" value={view} onChange={setView} items={[{ id: "times", label: "Times" }, { id: "ajustes", label: "Ajustes" }]} />}

      {roundState ? <>
      <RoundStatusBadge status={roundStatus} />

      <Card className="order-[5] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
            <Users size={19} />
          </div>
          <div>
            <p className="text-xl font-black tracking-normal text-neutral-950">{confirmedPlayersCount} participantes</p>
            <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{getTeamsToFormLabel(teamsToFormCount)}</p>
          </div>
        </div>
      </Card>
      </> : null}

      {organizer && view === "ajustes" && !isLoading && !error && roundState ? (
        <OrganizerControls
          hasDraw={Boolean(draw)}
          confirmed={confirmed}
          listClosed={listClosed}
          finalized={finalized}
          adjustMode={adjustMode}
          isSaving={isSaving}
          onDraw={handleDrawTeams}
          onToggleAdjust={() => {
            setAdjustMode((current) => !current);
            setSelectedPlayerId(null);
          }}
          onConfirm={handleConfirmTeams}
          canDraw={hasPlayersToDraw && !isLoading && !error}
        />
      ) : null}

      {error ? <><Feedback tone="error" text={error} /><button className="w-full rounded-lg border border-zinc-300 bg-white p-3 font-bold" disabled={isLoading || isSaving} onClick={async () => {
        setIsLoading(true); setError("");
        try { await reloadPersistedTeams(); } catch { setError("Não foi possível carregar os times desta rodada."); }
        finally { setIsLoading(false); }
      }}>Tentar novamente</button></> : null}
      {message ? <Feedback tone="success" text={message} /> : null}
      {listClosed && !hasPlayersToDraw ? <Feedback tone="neutral" text="Nenhum participante disponível para sorteio." /> : null}
      {adjustMode && view === "ajustes" ? <Feedback tone="neutral" text="Toque em um jogador e depois em outro jogador de outro time para trocar." /> : null}

      {isLoading ? <LoadingCards label="Carregando times..." /> : null}

      {!canShowTeams && !isLoading && !error ? (
        <Card>
          <p className="text-base font-black">Times ainda nao confirmados.</p>
          <p className="mt-1 text-sm font-bold text-zinc-600">Quando os organizadores confirmarem, os jogadores poderao visualizar aqui.</p>
        </Card>
      ) : null}

      {canShowTeams && draw ? (
        <div className="order-10 space-y-3">
          <p className="flex items-center justify-between text-[10px] font-black uppercase tracking-normal text-zinc-600">Composição dos times<span className="rounded-full bg-zinc-100 px-3 py-1">{confirmed ? "Confirmado" : "Rascunho"}</span></p>
          {draw.teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              currentPlayerId={profile.id}
              selectedPlayerId={selectedPlayerId}
              adjustMode={view === "ajustes" && adjustMode && organizer && listClosed && !isSaving}
              onPlayerClick={handlePlayerClick}
            />
          ))}
        </div>
      ) : null}

      {canShowTeams && !draw && !isLoading && !error ? (
        <Card className="order-10">
          <EmptyState icon={Users} title="Os times ainda não foram sorteados." description={organizer ? "Feche a lista para sortear e confirmar a composição dos times." : "Assim que forem confirmados, seus companheiros aparecem aqui."} />
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
  onToggleAdjust: () => void;
  onConfirm: () => void;
  canDraw: boolean;
}) {
  return (
    <div className="order-20 grid gap-2">
      {!listClosed && !confirmed && !finalized && <p className="text-sm text-zinc-600">Feche a lista na aba Racha para sortear os times.</p>}
      <button
        onClick={onDraw}
        disabled={(!listClosed && !confirmed) || finalized || !canDraw || isSaving}
        className="flex h-12 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-black uppercase tracking-normal text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {hasDraw ? <RefreshCw size={18} /> : <Shuffle size={18} />}
        {hasDraw ? "Sortear novamente" : "Sortear times"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onToggleAdjust}
          disabled={!hasDraw || !listClosed || finalized || isSaving}
          className="order-2 h-11 rounded-lg border border-zinc-200 bg-white text-xs font-bold uppercase text-zinc-700 transition hover:bg-zinc-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {adjustMode ? "Concluir ajuste" : "Ajustar times"}
        </button>
        <button
          onClick={onConfirm}
          disabled={!hasDraw || !listClosed || isSaving || finalized}
          className="h-11 rounded-lg bg-neutral-950 text-xs font-black uppercase text-white shadow-sm transition hover:bg-neutral-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "Salvando..." : "Confirmar times"}
        </button>
      </div>
    </div>
  );
}

function TeamCard({
  team,
  currentPlayerId,
  selectedPlayerId,
  adjustMode,
  onPlayerClick,
}: {
  team: DrawTeam;
  currentPlayerId: string;
  selectedPlayerId: string | null;
  adjustMode: boolean;
  onPlayerClick: (player: TeamPlayer) => void;
}) {
  return (
    <Card className="space-y-2 border-t-2 border-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="break-words text-lg font-black">{team.name}</h3>
          <p className="text-xs font-black uppercase tracking-normal text-zinc-500">{team.players.length} jogadores</p>
        </div>
        <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs font-black text-white">
          #{String(team.number).padStart(2, "0")}
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {team.players.map((player) => (
          <PlayerPill
            key={player.id}
            player={player}
            isCurrentPlayer={player.jogadorId === currentPlayerId}
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
    em_andamento: "Racha em andamento",
    finalizado: "Racha finalizado",
  };

  return (
    <div className="flex items-center gap-2 py-2">
      <Users size={16} aria-hidden="true" className="text-zinc-500" />
      <p className="text-xs font-bold">{labels[status]}</p>
    </div>
  );
}

function PlayerPill({
  player,
  isCurrentPlayer = false,
  selected = false,
  clickable = false,
  onClick,
}: {
  player: TeamPlayer;
  isCurrentPlayer?: boolean;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg py-1 text-left transition ${
        isCurrentPlayer ? "bg-emerald-100 px-2" : selected ? "bg-red-50" : "bg-transparent"
      } ${selected ? "ring-2 ring-red-500" : ""} ${clickable ? "active:scale-[0.99]" : "cursor-default"}`}
    >
      <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="sm" />
      <span className="min-w-0 flex-1 break-words text-sm font-black leading-snug text-neutral-950">{player.name}</span>
      {isCurrentPlayer && <span className="shrink-0 text-xs font-bold text-emerald-800">Você</span>}
    </button>
  );
}

function Feedback({ text, tone }: { text: string; tone: "error" | "success" | "neutral" }) {
  const toneClass = {
    error: "bg-red-50 text-red-700 ring-red-100",
    success: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    neutral: "bg-zinc-50 text-zinc-700 ring-zinc-100",
  }[tone];

  return <p role={tone === "error" ? "alert" : tone === "success" ? "status" : undefined} className={`rounded-lg p-3 text-sm font-semibold ring-1 ${toneClass}`}>{text}</p>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`fk-section ${className}`}>{children}</div>;
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

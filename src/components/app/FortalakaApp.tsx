"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Home,
  MapPin,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { ViewTabs } from "@/components/ui/ViewTabs";
import { RachaScreen } from "@/components/rounds/RachaScreen";
import { TeamsScreen } from "@/components/teams/TeamsScreen";
import { PlayerPerformance } from "@/components/players/PlayerPerformance";
import { ProfilePhoto } from "@/components/players/ProfilePhoto";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerNavigation } from "@/components/players/PlayerIdentity";
import { PublicPlayerProfile } from "@/components/players/PublicPlayerProfile";
import { PlayerStatisticsCard } from "@/components/players/StatisticsViews";
import { EvaluationArea } from "@/components/ratings/EvaluationArea";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import { RoundLoadStatus } from "@/components/rounds/RoundSummary";
import { getRoundMatches, type MatchesState } from "@/lib/matches/repository";
import { RoundProgress } from "@/components/rounds/RoundProgress";
import { OrganizerPanel } from "@/components/rounds/OrganizerPanel";
import { getRoundParticipantCounts } from "@/lib/rounds/organizer-overview";
import type { RoundDetails } from "@/lib/rounds/repository";
import { OwnRegistration } from "@/components/rounds/OwnRegistration";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { getEvaluationState, type EvaluationState } from "@/lib/ratings/repository";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "racha" | "teams" | "evaluate" | "results" | "profile";

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Início", icon: Home },
  { id: "racha", label: "Racha", icon: ClipboardList },
  { id: "teams", label: "Times", icon: Users },
  { id: "evaluate", label: "Avaliação", icon: Star },
  { id: "results", label: "Resultados", icon: Trophy },
];

export function FortalakaApp({ profile, initialPlayerId = null }: { profile: Profile; initialPlayerId?: string | null }) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [publicPlayerId, setPublicPlayerId] = useState<string | null>(initialPlayerId);
  const [underlyingReady, setUnderlyingReady] = useState(!initialPlayerId);
  const origin = useRef<{ url: string; scroll: number; focus: HTMLElement | null } | null>(null);
  useEffect(() => {
    function restore() {
      const match = window.location.pathname.match(/^\/perfil\/([^/]+)\/?$/);
      setPublicPlayerId(match ? match[1] : null);
      if (!match) setUnderlyingReady(true);
      if (!match && origin.current) {
        const previous = origin.current;
        requestAnimationFrame(() => { window.scrollTo({ top: previous.scroll, behavior: "instant" }); previous.focus?.focus({ preventScroll: true }); });
      }
    }
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function openPlayer(id: string) {
    if (publicPlayerId === id) return;
    origin.current = { url: window.location.pathname + window.location.search, scroll: window.scrollY, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null };
    window.history.pushState(window.history.state, "", `/perfil/${encodeURIComponent(id)}`);
    setPublicPlayerId(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function backFromPlayer() {
    if (origin.current) window.history.back();
    else { window.history.replaceState(window.history.state, "", "/"); setPublicPlayerId(null); setUnderlyingReady(true); }
  }
  function navigate(tab: Tab) {
    setUnderlyingReady(true);
    if (publicPlayerId) { window.history.replaceState(window.history.state, "", origin.current?.url ?? "/"); setPublicPlayerId(null); }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <PlayerNavigation.Provider value={openPlayer}><main className="min-h-screen bg-zinc-100 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-[640px] bg-background">
        <div className="min-h-screen px-5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))] sm:px-8">
          <div hidden={Boolean(publicPlayerId)}>
          {underlyingReady && <>
          {activeTab !== "home" && <AppHeader profile={profile} onOpenProfile={() => navigate("profile")} />}
          {activeTab === "home" && <HomeScreen profile={profile} onOpenProfile={() => navigate("profile")} onOpenRacha={() => navigate("racha")} onOpenEvaluate={() => navigate("evaluate")} onOpenResults={() => navigate("results")} onOpenTeams={() => navigate("teams")} />}
          {activeTab === "racha" && <RachaScreen profile={profile} onOpenResults={() => navigate("results")} />}
          {activeTab === "teams" && <TeamsScreen profile={profile} />}
          {activeTab === "results" && <ResultsScreen profile={profile} />}
          {activeTab === "profile" && <ProfileScreen profile={profile} />}
          {activeTab === "evaluate" && <EvaluationArea profile={profile} />}
          </>}
          </div>
          {publicPlayerId && <><AppHeader profile={profile} onOpenProfile={() => navigate("profile")} /><PublicPlayerProfile key={publicPlayerId} playerId={publicPlayerId} viewer={profile} onBack={backFromPlayer} /></>}
        </div>
        <BottomNav activeTab={activeTab} onChange={navigate} />
      </div>
    </main></PlayerNavigation.Provider>
  );
}

function AppHeader({ profile, onOpenProfile }: { profile: Profile; onOpenProfile: () => void }) {
  return (
    <header className="mb-6 flex min-h-16 items-center justify-between gap-3 border-b border-zinc-200 pb-4">
      <div className="flex items-center gap-3">
        <LogoMark size="header" />
        <div>
          <p className="text-xs font-bold uppercase text-red-700">Racha</p>
          <h1 className="text-[23px] font-black uppercase leading-none">Fortalaka</h1>
        </div>
      </div>
      <ProfileButton profile={profile} onClick={onOpenProfile} />
    </header>
  );
}

function ProfileButton({ profile, onClick }: { profile: Profile; onClick: () => void }) {
  return <button onClick={onClick} aria-label="Abrir meu perfil" className="shrink-0 rounded-full p-1 ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-red-600"><PlayerAvatar name={profile.name} avatarUrl={profile.avatar_url} /></button>;
}

function HomeScreen({ profile, onOpenRacha, onOpenEvaluate, onOpenResults, onOpenTeams, onOpenProfile }: { profile: Profile; onOpenRacha: () => void; onOpenEvaluate: () => void; onOpenResults: () => void; onOpenTeams: () => void; onOpenProfile: () => void }) {
  const { round, loading, error, retry } = useCurrentRound();
  const [matches, setMatches] = useState<{ roundId: string; roundStatus: RoundDetails["status"]; revision: RoundDetails | null; data: MatchesState | null; error: string } | null>(null);
  const organizer = isOrganizer(profile) && profile.active;
  const roundId = round?.roundId;
  const roundStatus = round?.status;
  // Atualizações de inscrição do jogador não precisam reler partidas.
  const matchesRevision = organizer ? round : null;
  useEffect(() => {
    if (!roundId || !roundStatus) return;
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (data.roundStatus && data.roundStatus !== roundStatus) throw new Error("A rodada mudou durante a consulta. Atualize o painel.");
      if (active) setMatches({ roundId, roundStatus, revision: matchesRevision, data, error: "" });
    }).catch(() => { if (active) setMatches({ roundId, roundStatus, revision: matchesRevision, data: null, error: "Não foi possível atualizar as partidas." }); });
    return () => { active = false; };
  }, [roundId, roundStatus, matchesRevision]);
  const currentMatches = matches?.roundId === roundId && matches?.roundStatus === roundStatus && matches?.revision === matchesRevision ? matches : null;
  const counts = getRoundParticipantCounts(round?.participants ?? []);
  const displayName = getDisplayName(profile);
  const firstName = getFirstName(displayName);

  return <section className="space-y-5">
    <AppHeader profile={profile} onOpenProfile={onOpenProfile} />
    <div><p className="text-sm text-zinc-600">Olá, {firstName}</p><h2 className="mt-1">{round?.status === "finalizado" ? "Dentro e fora de campo." : "É dia de Fortalaka."}</h2></div>
    <RoundLoadStatus loading={loading && !round} error={error} empty={!round} retry={retry} />
    {organizer && !round && !error && <OrganizerPanel profile={profile} round={round} loading={loading}
      matches={currentMatches?.data ?? null} matchesError={currentMatches?.error ?? ""} onRefresh={retry}
      onNavigate={destination => ({ racha: onOpenRacha, teams: onOpenTeams, results: onOpenResults, evaluate: onOpenEvaluate })[destination]()} />}
    {!error && round && <>
      <section aria-label="Rodada atual" className="border-y border-zinc-200">
        <div className="-mx-5 border-l-4 border-red-600 bg-neutral-950 px-5 py-6 text-white sm:-mx-8 sm:px-8">
          <p className="text-xs font-bold uppercase text-zinc-300">{round.status === "finalizado" ? "Última rodada" : "Próximo Racha"}</p>
          <h3 className="mt-1 break-words text-[23px] font-black leading-tight">{round.roundName}</h3>
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${round.status === "aberto" ? "bg-emerald-400" : "bg-red-400"}`} />{{aberto: "Lista aberta", lista_fechada: "Lista fechada", times_confirmados: "Times confirmados", em_andamento: "Em andamento", finalizado: "RODADA FINALIZADA"}[round.status]}</span>
        </div>
        <div className="space-y-4 py-5">
          <div className="grid grid-cols-2 gap-2">
            <InfoBlock icon={CalendarDays} label="Data" value={round.date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${round.date}T12:00:00Z`)) : "A definir"} />
            <InfoBlock icon={Clock3} label="Horário" value={round.time?.slice(0, 5) ?? "A definir"} />
          </div>
          <p className="flex items-start gap-2 text-xs font-medium leading-relaxed text-zinc-600"><MapPin size={16} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{round.address ?? "Endereço a definir"}</span></p>
          <div className="flex flex-wrap items-baseline gap-x-2 border-t border-zinc-200 pt-4"><span className="text-3xl font-black tabular-nums">{counts.confirmed}</span><span className="text-sm text-zinc-700">participantes</span><span className="ml-auto text-sm text-zinc-600">{counts.substitutes} suplentes</span></div>
          <OwnRegistration key={round.roundId} compact round={round} profile={profile} onUpdated={retry} />
          {round.status !== "aberto" && <button onClick={round.status === "lista_fechada" ? onOpenTeams : onOpenResults} className="fk-primary w-full">{round.status === "lista_fechada" ? "Ver times" : round.status === "finalizado" ? "Ver resumo do racha" : "Acompanhar partidas"}</button>}
          <button onClick={onOpenRacha} className="fk-secondary w-full">Ver racha</button>
        </div>
      </section>
      {!organizer && <RoundProgress status={round.status} />}
      {currentMatches?.data && currentMatches.data.partidas.length > 0 && <p className="text-center text-xs text-zinc-600">{currentMatches.data.partidas.length} partidas na rodada</p>}
      {organizer && <OrganizerPanel profile={profile} round={round} loading={loading}
        matches={currentMatches?.data ?? null} matchesError={currentMatches?.error ?? ""} onRefresh={retry}
        onNavigate={destination => ({ racha: onOpenRacha, teams: onOpenTeams, results: onOpenResults, evaluate: onOpenEvaluate })[destination]()} />}
    </>}
    {!organizer && <HomeEvaluationCard onOpenEvaluate={onOpenEvaluate} />}
  </section>;
}

function HomeEvaluationCard({ onOpenEvaluate }: { onOpenEvaluate: () => void }) {
  const [state, setState] = useState<EvaluationState | null>(null);

  useEffect(() => {
    let active = true;
    getEvaluationState().then(data => {
      if (active) setState(data);
    }).catch(() => {
      if (active) setState(null);
    });
    return () => { active = false; };
  }, []);

  if (!state?.open) return null;

  return <button onClick={onOpenEvaluate} className="flex min-h-16 w-full items-center gap-3 border-y border-zinc-200 py-4 text-left">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-700 text-white">
      <Star size={21} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-black">AVALIAR MEU TIME</p>
      <p className="mt-1 text-sm leading-relaxed text-zinc-600">{state.canEvaluate ? "Avalie seus companheiros de time." : "Confira a rodada de avaliações."}</p>
    </div>
  </button>;
}

function InfoBlock({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center text-red-700">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-zinc-600">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-[13px] font-black tabular-nums text-neutral-950">{value}</p>
      </div>
    </div>
  );
}

function ProfileScreen({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [view, setView] = useState<"overview" | "stats" | "ratings">("overview");
  const [isSigningOut, setIsSigningOut] = useState(false);
  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-5">
      <h2>Meu perfil</h2>
      <a href={`/comparar?jogadorA=${encodeURIComponent(profile.id)}`} className="fk-secondary">Comparar jogadores</a>
      <ViewTabs label="Áreas do perfil" value={view} onChange={setView} items={[{ id: "overview", label: "Visão geral" }, { id: "stats", label: "Estatísticas" }, { id: "ratings", label: "Avaliações" }]} />
      <div hidden={view === "stats"}><PlayerPerformance profile={profile} view={view === "ratings" ? "ratings" : "overview"} /></div>
      <div hidden={view === "ratings"}><PlayerStatisticsCard playerId={profile.id} /></div>
      <div hidden={view !== "overview"}><ProfilePhoto profile={profile} /></div>

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="fk-destructive w-full"
      >
        {isSigningOut ? "Saindo..." : "Sair da conta"}
      </button>
    </section>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[640px] border-t border-zinc-200 bg-white px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={`flex h-14 min-w-0 flex-col items-center justify-center gap-1 border-t-2 text-[11px] font-bold transition ${
                isActive ? "border-red-700 text-red-700" : "border-transparent text-zinc-600"
              }`}
            >
              <Icon size={22} aria-hidden="true" strokeWidth={isActive ? 2.5 : 2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function getDisplayName(profile: Profile) {
  const name = profile.name.trim();
  const emailPrefix = profile.email?.split("@")[0]?.trim();

  if (!name || (emailPrefix && name.toLowerCase() === emailPrefix.toLowerCase())) {
    return "Jogador";
  }

  return name;
}

function getFirstName(name: string) {
  return name.trim().split(" ")[0] || "Jogador";
}

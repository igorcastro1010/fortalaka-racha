"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Home,
  MapPin,
  Shield,
  Star,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { RachaScreen } from "@/components/rounds/RachaScreen";
import { TeamsScreen } from "@/components/teams/TeamsScreen";
import { PlayerPerformance } from "@/components/players/PlayerPerformance";
import { ProfilePhoto } from "@/components/players/ProfilePhoto";
import { PlayerAvatar } from "@/components/players/PlayerAvatar";
import { PlayerStatisticsCard } from "@/components/players/StatisticsViews";
import { EvaluationArea } from "@/components/ratings/EvaluationArea";
import { ResultsScreen } from "@/components/results/ResultsScreen";
import { useCurrentRound } from "@/components/rounds/useCurrentRound";
import { RoundLoadStatus, RoundSummary } from "@/components/rounds/RoundSummary";
import { getRoundMatches } from "@/lib/matches/repository";
import { nextMatch } from "@/data/mock";
import { getRoleLabel, type Profile } from "@/lib/auth/roles";
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

export function FortalakaApp({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  function navigate(tab: Tab) {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f3f3f4] shadow-2xl shadow-black/35">
        <div className="min-h-screen px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
          {activeTab !== "home" && <AppHeader profile={profile} onOpenProfile={() => navigate("profile")} />}
          {activeTab === "home" && <HomeScreen profile={profile} onOpenProfile={() => navigate("profile")} onOpenRacha={() => navigate("racha")} onOpenEvaluate={() => navigate("evaluate")} onOpenResults={() => navigate("results")} />}
          {activeTab === "racha" && <RachaScreen profile={profile} onOpenResults={() => navigate("results")} />}
          {activeTab === "teams" && <TeamsScreen profile={profile} />}
          {activeTab === "results" && <ResultsScreen profile={profile} />}
          {activeTab === "profile" && <ProfileScreen profile={profile} />}
          {activeTab === "evaluate" && <EvaluationArea profile={profile} />}
        </div>
        <BottomNav activeTab={activeTab} onChange={navigate} />
      </div>
    </main>
  );
}

function AppHeader({ profile, onOpenProfile }: { profile: Profile; onOpenProfile: () => void }) {
  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <LogoMark size="header" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Racha</p>
          <h1 className="text-[25px] font-black uppercase leading-none tracking-normal">Fortalaka</h1>
        </div>
      </div>
      <ProfileButton profile={profile} onClick={onOpenProfile} />
    </header>
  );
}

function ProfileButton({ profile, onClick }: { profile: Profile; onClick: () => void }) {
  return <button onClick={onClick} aria-label="Abrir meu perfil" className="shrink-0 rounded-full p-1 ring-1 ring-black/5 focus-visible:outline-2 focus-visible:outline-red-600"><PlayerAvatar name={profile.name} avatarUrl={profile.avatar_url} /></button>;
}

function HomeScreen({ profile, onOpenRacha, onOpenEvaluate, onOpenResults, onOpenProfile }: { profile: Profile; onOpenRacha: () => void; onOpenEvaluate: () => void; onOpenResults: () => void; onOpenProfile: () => void }) {
  const { round, loading, error, retry } = useCurrentRound();
  const [matches, setMatches] = useState<{ roundId: string; count: number } | null>(null);
  const roundId = round?.roundId;
  useEffect(() => {
    if (!roundId) return;
    let active = true;
    getRoundMatches(roundId).then(data => {
      if (active) setMatches({ roundId, count: data.partidas.length });
    }).catch(() => {});
    return () => { active = false; };
  }, [roundId]);
  const participants = round?.participants ?? [];
  const counts = {
    goalkeepers: participants.filter(player => player.type === "goleiro" && player.status === "confirmado").length,
    fieldPlayers: participants.filter(player => player.type === "linha" && player.status === "confirmado").length,
    substitutes: participants.filter(player => player.type === "suplente").length,
  };
  const displayName = getDisplayName(profile);
  const firstName = getFirstName(displayName);

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size="header" />
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-600">Racha</p>
            <h1 className="truncate text-[24px] font-black uppercase leading-none tracking-normal text-neutral-950">
              Fortalaka
            </h1>
          </div>
        </div>
        <ProfileButton profile={profile} onClick={onOpenProfile} />
      </header>

      <div className="space-y-2 pb-1">
        <p className="text-[13px] font-medium text-zinc-600">Olá, {firstName} · {getRoleLabel(profile.role)}</p>
        <h2 className="text-[32px] font-black leading-[1.08] tracking-tight text-neutral-950">
          Pronto pra quinta?
        </h2>
      </div>

      <HomeEvaluationCard onOpenEvaluate={onOpenEvaluate} />

      <RoundLoadStatus loading={loading} error={error} empty={!round} retry={retry} />
      {!loading && !error && round && <RoundSummary round={round} />}
      <Card className="space-y-4 rounded-[24px] border-t-[3px] border-red-600 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-red-600">Próximo Racha</p>
          <span className="shrink-0 rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            Quinta
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <InfoBlock icon={CalendarDays} label="Data" value={nextMatch.date} />
          <InfoBlock icon={Clock3} label="Horário" value={nextMatch.time} />
        </div>

        <div className="flex min-w-0 items-start gap-2.5 rounded-[14px] bg-zinc-50 px-3 py-3 text-[13px] font-semibold leading-relaxed text-zinc-800">
          <MapPin size={18} className="mt-0.5 shrink-0 text-red-600" />
          <span className="min-w-0 break-words">{nextMatch.address}</span>
        </div>

        <div className="h-px bg-zinc-100" />

        <div className="grid grid-cols-3 gap-2">
          <HomeCount icon={Shield} value={counts.goalkeepers} label="Goleiros" />
          <HomeCount icon={Users} value={counts.fieldPlayers} label="Linha" />
          <HomeCount icon={UserPlus} value={counts.substitutes} label="Suplentes" />
        </div>

        <button
          onClick={onOpenRacha}
          className="mt-1 h-14 w-full rounded-[16px] bg-red-600 text-sm font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
        >
          Ver racha
        </button>
      </Card>

      <div className="flex items-center gap-3 rounded-[18px] bg-neutral-950 p-4 text-white shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white/10 text-red-400">
          <ClipboardList size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-black">{participants.length} jogadores na lista</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-300">Confira os participantes e a organização da rodada em Ver Racha.</p>
        </div>
      </div>
      {matches?.roundId === roundId && matches && matches.count > 0 && <button onClick={onOpenResults} className="min-h-12 w-full rounded-[16px] bg-white px-4 text-sm font-black ring-1 ring-black/5">VER RESULTADOS · {matches.count} partidas</button>}
    </section>
  );
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

  return <button onClick={onOpenEvaluate} className="flex w-full items-center gap-3 rounded-[18px] bg-neutral-950 p-4 text-left text-white shadow-sm transition active:scale-[0.98]">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-600 text-white">
      <Star size={21} />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-black">AVALIAR MEU TIME</p>
      <p className="mt-1 text-xs leading-relaxed text-zinc-300">{state.canEvaluate ? "Avalie seus companheiros de time." : "Confira a rodada de avaliacoes."}</p>
    </div>
  </button>;
}

function InfoBlock({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[16px] border border-zinc-100 bg-zinc-50 px-2.5 py-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-red-600 ring-1 ring-zinc-200">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-600">{label}</p>
        <p className="mt-0.5 whitespace-nowrap text-[13px] font-black tabular-nums text-neutral-950">{value}</p>
      </div>
    </div>
  );
}

function HomeCount({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-[16px] bg-zinc-50 p-2.5 text-center ring-1 ring-zinc-100">
      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-red-600 ring-1 ring-zinc-200">
        <Icon size={17} />
      </div>
      <p className="mt-2 text-[26px] font-black leading-none tabular-nums text-neutral-950">{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold text-zinc-600">{label}</p>
    </div>
  );
}

function ProfileScreen({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-4">
      <PlayerPerformance profile={profile} />
      <PlayerStatisticsCard playerId={profile.id} />
      <ProfilePhoto profile={profile} />

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="h-12 w-full rounded-[16px] border border-red-200 bg-white text-xs font-bold uppercase tracking-wide text-red-600 transition hover:bg-red-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSigningOut ? "Saindo..." : "Sair da conta"}
      </button>
    </section>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-200 bg-white/[0.96] px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_24px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onChange(tab.id)}
              className={`flex min-w-0 h-[66px] flex-col items-center justify-center gap-1 rounded-[16px] text-[10px] font-black transition hover:bg-zinc-100 active:scale-95 ${
                isActive ? "bg-red-50 text-red-700 ring-1 ring-red-100" : "text-zinc-700"
              }`}
            >
              <Icon size={23} strokeWidth={isActive ? 2.7 : 2.3} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[22px] bg-white p-4 shadow-[0_8px_22px_rgba(0,0,0,0.035)] ring-1 ring-black/5 ${className}`}>{children}</div>;
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

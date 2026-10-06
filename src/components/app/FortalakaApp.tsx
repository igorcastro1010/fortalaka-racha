"use client";

import {
  CalendarDays,
  ClipboardList,
  Clock3,
  Home,
  MapPin,
  Shield,
  Trophy,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { RachaScreen } from "@/components/rounds/RachaScreen";
import { TeamsScreen } from "@/components/teams/TeamsScreen";
import { ProfilePhoto } from "@/components/players/ProfilePhoto";
import {
  fieldPlayers,
  goalkeepers,
  nextMatch,
  profile as mockProfile,
  ranking,
  substitutes,
} from "@/data/mock";
import { getRoleLabel, type Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";

type Tab = "home" | "racha" | "teams" | "ranking" | "profile";

const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Inicio", icon: Home },
  { id: "racha", label: "Racha", icon: ClipboardList },
  { id: "teams", label: "Times", icon: Users },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "profile", label: "Perfil", icon: User },
];

export function FortalakaApp({ profile }: { profile: Profile }) {
  const [activeTab, setActiveTab] = useState<Tab>("home");

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f3f3f4] shadow-2xl shadow-black/35">
        <div className="min-h-screen px-4 pb-[calc(104px+env(safe-area-inset-bottom))] pt-[calc(16px+env(safe-area-inset-top))]">
          {activeTab !== "home" && <AppHeader />}
          {activeTab === "home" && <HomeScreen profile={profile} onOpenRacha={() => setActiveTab("racha")} />}
          {activeTab === "racha" && <RachaScreen profile={profile} />}
          {activeTab === "teams" && <TeamsScreen profile={profile} />}
          {activeTab === "ranking" && <RankingScreen />}
          {activeTab === "profile" && <ProfileScreen profile={profile} />}
        </div>
        <BottomNav activeTab={activeTab} onChange={setActiveTab} />
      </div>
    </main>
  );
}

function AppHeader() {
  return (
    <header className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <LogoMark size="header" />
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-red-600">Racha</p>
          <h1 className="text-[25px] font-black uppercase leading-none tracking-normal">Fortalaka</h1>
        </div>
      </div>
      <div className="rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-neutral-800 shadow-sm ring-1 ring-black/5">
        Oficial
      </div>
    </header>
  );
}

function HomeScreen({ profile, onOpenRacha }: { profile: Profile; onOpenRacha: () => void }) {
  const displayName = getDisplayName(profile);
  const firstName = getFirstName(displayName);

  return (
    <section className="-mx-4 space-y-5 px-5">
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
        <span className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-black text-neutral-800 shadow-sm">
          {getRoleLabel(profile.role)}
        </span>
      </header>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-zinc-700">Boa noite, {firstName}</p>
        <h2 className="text-[32px] font-black leading-[1.02] tracking-normal text-neutral-950">
          Pronto pra quinta?
        </h2>
      </div>

      <Card className="space-y-4 rounded-[24px] p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-red-600">Proximo Racha</p>
          <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-black uppercase text-zinc-700">
            Quinta
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InfoBlock icon={CalendarDays} label="Data" value={nextMatch.date} />
          <InfoBlock icon={Clock3} label="Horario" value={nextMatch.time} />
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm font-bold text-zinc-700">
          <MapPin size={18} className="shrink-0 text-red-600" />
          <span className="truncate">{nextMatch.address}</span>
        </div>

        <div className="h-px bg-zinc-100" />

        <div className="grid grid-cols-3 gap-2">
          <HomeCount icon={Shield} value={goalkeepers.length} label="Goleiros" />
          <HomeCount icon={Users} value={fieldPlayers.length} label="Linha" />
          <HomeCount icon={UserPlus} value={substitutes.length} label="Suplentes" />
        </div>

        <button
          onClick={onOpenRacha}
          className="mt-1 h-14 w-full rounded-[18px] bg-red-600 text-base font-black uppercase text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
        >
          Ver racha
        </button>
      </Card>

      <Card className="flex items-center gap-3 rounded-[18px] bg-neutral-950 p-4 text-white ring-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-red-600 text-white">
          <CalendarDays size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black">Faltam 5 dias para o proximo racha</p>
          <p className="mt-0.5 text-xs font-bold text-zinc-300">Quinta-feira, as {nextMatch.time}</p>
        </div>
      </Card>
    </section>
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-zinc-100 bg-zinc-50 p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-white text-red-600 ring-1 ring-zinc-200">
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">{label}</p>
        <p className="truncate text-base font-black text-neutral-950">{value}</p>
      </div>
    </div>
  );
}

function HomeCount({ icon: Icon, value, label }: { icon: LucideIcon; value: number; label: string }) {
  return (
    <div className="rounded-[16px] bg-zinc-50 p-2.5 text-center ring-1 ring-zinc-100">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-[12px] bg-white text-red-600 ring-1 ring-zinc-200">
        <Icon size={17} />
      </div>
      <p className="mt-1.5 text-xl font-black leading-none text-neutral-950">{value}</p>
      <p className="mt-1 truncate text-[11px] font-bold text-zinc-700">{label}</p>
    </div>
  );
}

function RankingScreen() {
  return (
    <section className="space-y-3">
      <ScreenTitle title="Ranking" subtitle="Desempenho geral dos jogadores" />
      {ranking.map((player, index) => (
        <Card key={player.name} className="flex items-center gap-3 p-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[16px] bg-neutral-950 text-sm font-black text-white">
            {index + 1}
          </span>
          <Avatar initials={player.avatar} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate text-base font-black">{player.name}</h3>
              <div className="rounded-full bg-red-50 px-2.5 py-1 text-sm font-black text-red-700">
                {player.rating}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1 text-center">
              <MiniStat label="Jogos" value={player.games} />
              <MiniStat label="Gols" value={player.goals} />
              <MiniStat label="Ast" value={player.assists} />
              <MiniStat label="Vit" value={player.wins} />
            </div>
          </div>
        </Card>
      ))}
    </section>
  );
}

function ProfileScreen({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const displayName = getDisplayName(profile);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="space-y-3.5">
      <ProfilePhoto profile={profile} />
      <Card className="bg-neutral-950 p-4 text-white ring-0">
        <div className="flex items-center gap-4">
          <LogoMark size="profile" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
              {getRoleLabel(profile.role)}
            </p>
            <h2 className="truncate text-3xl font-black">{displayName}</h2>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-black">
              Nota media <span className="text-red-300">8.9</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-black">Estatisticas</h3>
        <div className="grid grid-cols-2 gap-2">
          {mockProfile.stats
            .filter((stat) => stat.label !== "Nota media")
            .map((stat) => (
              <div key={stat.label} className="rounded-[18px] border border-zinc-200 bg-zinc-50 p-3">
                <p className="text-xs font-bold uppercase text-zinc-600">{stat.label}</p>
                <p className="mt-1 text-2xl font-black">{stat.value}</p>
              </div>
            ))}
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-black">Ultimos jogos</h3>
        <div className="space-y-1.5">
          {mockProfile.recentGames.map((game) => (
            <div key={game.date} className="flex items-center justify-between rounded-[18px] border border-zinc-200 bg-zinc-50 p-3">
              <div>
                <p className="font-black">{game.result}</p>
                <p className="text-sm font-bold text-zinc-600">{game.date}</p>
              </div>
              <p className="rounded-full bg-white px-3 py-1 text-sm font-black text-zinc-700 ring-1 ring-black/5">
                {game.goals} gols / {game.assists} ast
              </p>
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="h-12 w-full rounded-[18px] border border-zinc-300 bg-white text-sm font-black uppercase tracking-wide text-neutral-950 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSigningOut ? "Saindo..." : "Sair da conta"}
      </button>
    </section>
  );
}

function BottomNav({ activeTab, onChange }: { activeTab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-[430px] border-t border-zinc-200 bg-white/[0.96] px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_24px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex h-[66px] flex-col items-center justify-center gap-1 rounded-[20px] text-xs font-black transition hover:bg-zinc-100 active:scale-95 ${
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

function ScreenTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-[29px] font-black leading-tight tracking-normal">{title}</h2>
      <p className="mt-0.5 text-sm font-bold text-zinc-600">{subtitle}</p>
    </div>
  );
}

function Avatar({ initials, compact = false }: { initials: string; compact?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-red-600 font-black text-white shadow-sm shadow-red-600/20 ${
        compact ? "h-8 w-8 rounded-[13px] text-xs" : "h-10 w-10 rounded-[16px] text-sm"
      }`}
    >
      {initials}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] bg-zinc-50 px-1 py-2 ring-1 ring-zinc-200">
      <p className="text-xs font-black">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase text-zinc-600">{label}</p>
    </div>
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

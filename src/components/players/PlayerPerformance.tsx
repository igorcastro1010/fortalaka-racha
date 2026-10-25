"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Profile } from "@/lib/auth/roles";
import { getRoleLabel } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { attributes, overallRating, radarPoints, radarGrid, radarVertex, type RatingSummary } from "@/lib/ratings/summary";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerPerformance({ profile, children, view = "overview" }: { profile: Profile; children?: ReactNode; view?: "overview" | "ratings" }) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let pending = false;
    const client = createClient();
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const [ratings, photo] = await Promise.all([
          client.rpc("medias_jogador", { p_jogador: profile.id }),
          client.from("profiles").select("avatar_url").eq("id", profile.id).single(),
        ]);
        if (!mounted) return;
        if (ratings.error) throw new Error(ratings.error.code === "PGRST202"
          ? "As avaliações ainda não estão configuradas no banco."
          : "Não foi possível carregar suas médias. Tente novamente.");
        if (!ratings.data?.[0]) throw new Error("Não foi possível carregar suas médias. Tente novamente.");
        if (!("fisico" in ratings.data[0])) throw new Error("Atualize a configuração das avaliações para incluir Físico.");
        setSummary(ratings.data[0] as RatingSummary);
        if (!photo.error) setAvatar(photo.data.avatar_url);
        setError("");
      } catch (e) {
        console.error("Médias do jogador", e);
        if (mounted) setError("Não foi possível carregar suas médias. Tente novamente.");
      } finally {
        pending = false;
        if (mounted) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [profile.id]);

  const overall = summary ? overallRating(summary) : null;
  const format = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return <section className="min-w-0 overflow-hidden bg-neutral-950 text-white" aria-label="Desempenho do jogador">
    <div hidden={view !== "overview"}>
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 px-5 pt-6">
      <PlayerAvatar name={profile.name} avatarUrl={avatar} size="lg" />
      <div className="min-w-0"><h2 className="break-words text-2xl font-black leading-tight">{profile.name}</h2><p className="mt-1.5 text-xs font-semibold text-zinc-300">{getRoleLabel(profile.role)}</p></div>
    </div>
    <div className="mx-5 mt-5 flex items-end justify-between gap-4 border-t border-white/15 pt-4">
      <div><p className="text-sm font-bold text-zinc-300">Desempenho</p><p className="mt-1 text-xs text-zinc-400">Overall / 100</p></div>
      <p className="text-5xl font-black leading-none tabular-nums" aria-label={`Nota geral: ${overall ?? "sem avaliações"}`}>{loading ? "…" : overall ?? "--"}</p>
    </div>
    <div className="mx-5 mt-4 h-1 overflow-hidden bg-white/15"><div className="h-full bg-red-600" style={{ width: `${overall ?? 0}%` }} /></div>
    {children && <div className="mx-4 mt-4">{children}</div>}
    </div>
    <div hidden={view !== "ratings"}>
    <div className="px-5 pt-5"><h3 className="text-xl font-black">Médias recebidas</h3><p className="mt-1 text-sm text-zinc-300">Desempenho por fundamento</p></div>
    <svg viewBox="-20 -12 280 230" className="mx-auto my-3 block aspect-[28/23] w-full max-w-[340px]" role="img" aria-label={summary?.quantidade ? attributes.map(({key,label}) => `${label}: ${format(summary[key])} de 10`).join(", ") : "Gráfico sem avaliações"}>
      {[16, 32, 48, 64].map(r => <polygon key={r} points={radarGrid(r)} fill="none" stroke="white" strokeOpacity="0.12" />)}
      {attributes.map(({ key }, index) => { const [x,y] = radarVertex(index,64); return <line key={key} x1="120" y1="100" x2={x} y2={y} stroke="white" strokeOpacity="0.1" />; })}
      {summary && overall !== null && <polygon points={radarPoints(summary)} fill="#ef4444" fillOpacity="0.22" stroke="#f87171" strokeWidth="2.5" strokeLinejoin="round" />}
      <g fill="#e4e4e7" fontSize="12" fontWeight="600" textAnchor="middle">{attributes.map(({key,label},index) => { const [x,y]=radarVertex(index,91); return <text key={key} x={x} y={y+4}>{label}</text>; })}</g>
    </svg>
    {summary && overall !== null && <dl className="mx-5 mb-5 divide-y divide-white/15">{attributes.map(({ key, label }) => <div key={key} className="flex min-h-11 items-center justify-between gap-3"><dt className="text-sm text-zinc-300">{label}</dt><dd className="text-base font-bold tabular-nums">{format(summary[key])}<span className="ml-1 text-xs font-normal text-zinc-400">/ 10</span></dd></div>)}</dl>}
    </div>
    <div className="border-t border-white/15 px-5 py-4 text-xs leading-relaxed text-zinc-300" aria-live="polite">{loading ? "Carregando médias..." : error ? <p role="alert">{error}</p> : summary?.quantidade && summary.quantidade >= 2 ? `${summary.quantidade} avaliações recebidas • médias de 0 a 10` : summary?.quantidade === 1 ? "Ainda sem avaliações suficientes. A nota aparece com 2 respostas." : "Ainda sem avaliações. Suas médias aparecerão aqui."}</div>
  </section>;
}

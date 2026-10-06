"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth/roles";
import { getRoleLabel } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { attributes, overallRating, radarPoints, radarGrid, radarVertex, type RatingSummary } from "@/lib/ratings/summary";
import { PlayerAvatar } from "./PlayerAvatar";

export function PlayerPerformance({ profile }: { profile: Profile }) {
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
        if (mounted) setError(e instanceof Error ? e.message : "Não foi possível carregar suas médias.");
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

  return <section className="overflow-hidden rounded-[24px] bg-[#343c49] text-white shadow-xl shadow-black/15" aria-label="Desempenho do jogador">
    <div className="border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-zinc-300">Seu perfil • Fortalaka</div>
    <div className="flex items-center gap-4 px-5 pt-5">
      <PlayerAvatar name={profile.name} avatarUrl={avatar} />
      <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-lime-300">{getRoleLabel(profile.role)}</p><h2 className="truncate text-2xl font-black">{profile.name}</h2></div>
      <div className="text-right"><p className="text-5xl font-black tracking-tighter text-white" aria-label={`Nota geral: ${overall ?? "sem avaliações"}`}>{loading ? "…" : overall ?? "—"}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-300">Geral / 100</p></div>
    </div>
    <div className="mx-5 mt-4 h-1.5 overflow-hidden rounded-full bg-black/30"><div className="h-full rounded-full bg-lime-400 transition-[width] duration-700" style={{ width: `${overall ?? 0}%` }} /></div>
    <svg viewBox="0 0 240 206" className="mx-auto mt-2 w-full max-w-[320px]" role="img" aria-label={summary?.quantidade ? attributes.map(({key,label}) => `${label}: ${format(summary[key])} de 10`).join(", ") : "Gráfico sem avaliações"}>
      {[16, 32, 48, 64].map(r => <polygon key={r} points={radarGrid(r)} fill="none" stroke="white" strokeOpacity="0.12" />)}
      {attributes.map(({ key }, index) => { const [x,y] = radarVertex(index,64); return <line key={key} x1="120" y1="100" x2={x} y2={y} stroke="white" strokeOpacity="0.1" />; })}
      {summary && overall !== null && <polygon points={radarPoints(summary)} fill="#bef264" fillOpacity="0.18" stroke="#bef264" strokeWidth="2.5" strokeLinejoin="round" className="transition-all duration-700" />}
      <g fill="#e4e4e7" fontSize="11" fontWeight="700" textAnchor="middle">{attributes.map(({key,label},index) => { const [x,y]=radarVertex(index,88); return <text key={key} x={x} y={y+4}>{label}</text>; })}</g>
    </svg>
    <div className="grid grid-cols-5 gap-1 border-t border-white/10 px-3 py-4">{attributes.map(({key,label}) => <div key={key} className="text-center"><p className="text-xl font-black text-lime-300">{summary ? format(summary[key]) : "—"}</p><p className="mt-1 text-[10px] font-bold text-zinc-300">{label}</p></div>)}</div>
    <div className="bg-black/15 px-5 py-3 text-xs text-zinc-300" aria-live="polite">{loading ? "Carregando médias..." : error ? <p role="alert">{error}</p> : summary?.quantidade ? `${summary.quantidade} avaliações recebidas • médias de 0 a 10` : "Ainda sem avaliações. Suas médias aparecerão aqui."}</div>
  </section>;
}

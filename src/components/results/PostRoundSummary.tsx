"use client";

import { useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { getPlayerStatistics, type Match, type PlayerStatistics } from "@/lib/matches/repository";
import { getRoundRatingLeaders, getRoundShareSummary, type RoundLeader } from "@/lib/results/round-share";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { RoundShareCard } from "./RoundShareCard";

const singularUnits: Record<string, string> = { gols: "gol", assistências: "assistência", vitórias: "vitória" };
const card = "fk-section border-b border-zinc-200 py-5";

function Leaders({ title, rows, unit, showAvatars = false }: { title: string; rows: RoundLeader[]; unit: string; showAvatars?: boolean }) {
  if (!rows.length) return null;
  return <section aria-label={title} className={card}>
    <h3 className="text-sm font-black uppercase">{title}</h3>
    <ol className="mt-3 divide-y divide-zinc-100">{rows.map(player => <li key={player.id} className={`flex min-h-12 items-center py-2 ${showAvatars ? "gap-2" : "gap-3"}`}>
      <span aria-label={`${player.place}º lugar`} className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${player.place === 1 ? "bg-red-600 text-white" : showAvatars && player.place === 2 ? "bg-neutral-950 text-white" : showAvatars && player.place === 3 ? "bg-zinc-200 text-zinc-900" : showAvatars ? "bg-zinc-50 text-zinc-500" : "bg-zinc-100 text-zinc-700"}`}>{player.place}º</span>
      <PlayerIdentity playerId={player.id} name={player.name} avatarUrl={player.avatarUrl} size="sm" showAvatar={showAvatars} className="flex-1 text-sm font-bold" />
      <span className="shrink-0 text-right"><strong className="block text-lg font-black tabular-nums">{player.value}</strong><span className="text-xs font-semibold text-zinc-600">{player.value === 1 ? (singularUnits[unit] ?? unit) : unit}</span></span>
    </li>)}</ol>
  </section>;
}

function roundDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(date).replaceAll(".", "").toUpperCase();
}

/** Somente leitura: recebe o mesmo snapshot das partidas usado no compartilhamento. */
export function PostRoundSummary({ roundId, date, matches }: { roundId: string; date: string | null; matches: Match[] }) {
  const source = useMemo(() => ({ roundId, date, partidas: matches }), [roundId, date, matches]);
  const summary = useMemo(() => getRoundShareSummary(roundId, source), [roundId, source]);
  const [ratings, setRatings] = useState<PlayerStatistics[]>([]);
  const [ratingError, setRatingError] = useState("");
  const hasParticipants = summary.participantCount > 0;
  useEffect(() => {
    if (!hasParticipants) return;
    let active = true;
    // Uma única RPC agregada, com a privacidade e o mínimo de respostas existentes.
    getPlayerStatistics().then(rows => { if (active) setRatings(rows); }).catch(error => {
      console.error("Falha ao carregar notas do resumo", error);
      if (active) setRatingError("Não foi possível carregar as notas. Tente novamente mais tarde.");
    });
    return () => { active = false; };
  }, [roundId, hasParticipants]);
  const ratingLeaders = getRoundRatingLeaders(summary, ratings);
  const formattedDate = roundDate(date);

  return <section aria-label="Resumo pós-racha" className="space-y-1">
    <header className="border-l-4 border-red-600 bg-neutral-950 p-5 text-white">
      <div className="flex items-center gap-2 text-red-400"><Trophy size={17} aria-hidden="true" /><h3 className="text-xs font-black uppercase">Resumo do racha</h3></div>
      <p className="mt-3 text-xl font-black">RACHA FORTALAKA</p>
      {formattedDate && <p className="mt-1 text-xs font-bold text-zinc-300">{formattedDate}</p>}
      <p className="mt-3 text-xs font-black uppercase text-red-400">Racha finalizado</p>
      {summary.matches.length ? <p className="mt-2 text-sm font-semibold text-zinc-200">{summary.participantCount} participantes · {summary.matches.length} {summary.matches.length === 1 ? "partida" : "partidas"} · {summary.totalGoals} {summary.totalGoals === 1 ? "gol" : "gols"}</p> : <p className="mt-2 text-sm text-zinc-300">Não há partidas registradas nesta rodada.</p>}
    </header>

    {summary.matches.length > 0 && <>
      <section aria-label="Números do racha" className={card}>
        <h3 className="text-sm font-black uppercase">Números do racha</h3>
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">{[
          ["Participantes", String(summary.participantCount)], ["Partidas finalizadas", String(summary.matches.length)],
          ["Gols totais", String(summary.totalGoals)], ["Gols/jogo", summary.averageGoals!.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })],
        ].map(([label, value]) => <div key={label} className="border-l-2 border-zinc-200 pl-3"><dd className="text-2xl font-black tabular-nums">{value}</dd><dt className="mt-1 text-xs font-semibold text-zinc-600">{label}</dt></div>)}</dl>
        <p className="mt-4 text-xs leading-relaxed text-zinc-600">Gols totais pelo placar. Participantes únicos em campo nas partidas finalizadas. Artilharia e assistências pelos eventos registrados.</p>
      </section>
      <Leaders title="Artilharia do racha" rows={summary.topScorers} unit="gols" showAvatars />
      <Leaders title="Assistências" rows={summary.assists} unit="assistências" />
      <Leaders title="Mais vitórias" rows={summary.wins} unit="vitórias" />
      {ratingLeaders.length > 0 && <div className="space-y-2"><Leaders title="Maiores notas" rows={ratingLeaders} unit="overall /100" /><p className="py-2 text-xs leading-relaxed text-zinc-600">Overall histórico dos participantes desta rodada, com pelo menos 2 avaliações. Não representa uma nota exclusiva desta rodada.</p></div>}
      {ratingError && <p role="status" className="py-3 text-sm text-zinc-600">{ratingError}</p>}
      <section aria-label="Resultados da rodada" className={card}>
        <h3 className="text-sm font-black uppercase">Resultados</h3>
        <ol className="mt-3 divide-y divide-zinc-100">{summary.matches.map((match, index) => <li key={match.id} className="py-3">
          <p className="mb-2 text-xs font-bold uppercase text-zinc-600">Partida {index + 1} · finalizada</p>
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center text-sm font-bold"><span className="break-words">{match.timeA}</span><strong className="px-2 py-2 text-lg font-black tabular-nums">{match.placarA} × {match.placarB}</strong><span className="break-words">{match.timeB}</span></div>
        </li>)}</ol>
      </section>
      {hasParticipants && <details className={card}>
        <summary className="min-h-11 cursor-pointer content-center text-xs font-black">VER PARTICIPANTES · {summary.participantCount}</summary>
        <ul className="mt-2 divide-y divide-zinc-100">{summary.players.map(player => <li key={player.id} className="flex items-center gap-3 py-2"><PlayerIdentity playerId={player.id} name={player.name} avatarUrl={player.avatarUrl} size="sm" className="text-sm font-bold" /></li>)}</ul>
      </details>}
    </>}
    <RoundShareCard roundId={roundId} source={source} summary={summary} compact />
  </section>;
}

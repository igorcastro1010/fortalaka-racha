import type { Match, PlayerStatistics } from "../matches/repository";

/** Snapshot da RPC ler_partidas_rodada, identificado pelo p_racha usado na leitura. */
export type RoundShareSource = { roundId: string; date: string | null; partidas: readonly Match[] };
type PlayerTotal = { id: string; name: string; avatarUrl: string | null; goals: number; assists: number; wins: number };
export type RoundLeader = { id: string; name: string; value: number; place: number };

function line(value: string) { return value.replace(/\s+/g, " ").trim(); }
function count(value: number) { return Number.isSafeInteger(value) && value > 0 ? value : 0; }
function timestamp(match: Match) {
  const time = Date.parse(match.createdAt ?? match.finalizadaAt ?? "");
  return Number.isNaN(time) ? Infinity : time;
}
function rankLeaders(players: { id: string; name: string; value: number }[]): RoundLeader[] {
  // Empates mantêm a mesma posição e incluem todos os empatados no TOP 3.
  const sorted = players.filter(player => player.value > 0).sort((a, b) => b.value - a.value);
  let place = 0;
  return sorted.map((player, index) => {
    if (index === 0 || player.value !== sorted[index - 1].value) place = index + 1;
    return { ...player, place };
  }).filter(player => player.place <= 3);
}
function leaders(players: PlayerTotal[], field: "goals" | "assists" | "wins"): RoundLeader[] {
  return rankLeaders(players.map(player => ({ id: player.id, name: player.name, value: player[field] })));
}

export function getRoundShareSummary(roundId: string, source: RoundShareSource) {
  if (source.roundId !== roundId) throw new Error("Os dados não pertencem a esta rodada.");
  const seenMatches = new Set<string>();
  const matches = source.partidas.filter(match => {
    if (match.status !== "finalizada" || seenMatches.has(match.id)) return false;
    seenMatches.add(match.id);
    return true;
  }).sort((a, b) => timestamp(a) - timestamp(b));
  const totals = new Map<string, PlayerTotal>();
  for (const match of matches) {
    const seenPlayers = new Set<string>();
    for (const player of match.jogadores) {
      if (!player.participou || seenPlayers.has(player.jogador_id)
        || ![match.timeAId, match.timeBId].includes(player.time_id)) continue;
      seenPlayers.add(player.jogador_id);
      const total = totals.get(player.jogador_id) ?? { id: player.jogador_id, name: line(player.nome), avatarUrl: player.avatar_url, goals: 0, assists: 0, wins: 0 };
      total.goals += count(player.gols);
      total.assists += count(player.assistencias);
      if ((player.time_id === match.timeAId && match.placarA > match.placarB)
        || (player.time_id === match.timeBId && match.placarB > match.placarA)) total.wins++;
      totals.set(player.jogador_id, total);
    }
  }
  const players = [...totals.values()];
  const totalGoals = matches.reduce((total, match) => total + count(match.placarA) + count(match.placarB), 0);
  return { roundId, date: source.date, matches, players, totalGoals, averageGoals: matches.length ? totalGoals / matches.length : null, participantCount: players.length, goals: leaders(players, "goals"), assists: leaders(players, "assists"), wins: leaders(players, "wins") };
}

export type RoundShareSummary = ReturnType<typeof getRoundShareSummary>;

/** Overall histórico já protegido pela RPC, somente dos participantes desta rodada. */
export function getRoundRatingLeaders(summary: RoundShareSummary, ratings: readonly PlayerStatistics[]): RoundLeader[] {
  const eligible = new Map(summary.players.map(player => [player.id, player.name]));
  const seen = new Set<string>();
  return rankLeaders(ratings.flatMap(player => {
    const name = eligible.get(player.jogador_id);
    if (!name || seen.has(player.jogador_id) || player.quantidade_avaliacoes < 2
      || player.nota_geral_100 == null || !Number.isFinite(player.nota_geral_100)
      || player.nota_geral_100 <= 0 || player.nota_geral_100 > 100) return [];
    seen.add(player.jogador_id);
    return [{ id: player.jogador_id, name, value: player.nota_geral_100 }];
  }));
}

export function buildRoundShareText(roundId: string, source: RoundShareSource): string {
  return buildRoundShareTextFromSummary(getRoundShareSummary(roundId, source));
}

/** Formatação compartilhada pela UI e pela API anterior, sem recalcular estatísticas. */
export function buildRoundShareTextFromSummary(summary: RoundShareSummary): string {
  const sections = ["⚽❤️ *RACHA FORTALAKA*"];
  if (summary.date && /^\d{4}-\d{2}-\d{2}$/.test(summary.date)) {
    const date = new Date(`${summary.date}T12:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === summary.date) {
      sections.push(`📅 ${new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(date)}`);
    }
  }
  if (summary.matches.length) sections.push("🏁 *RESULTADOS*\n" + summary.matches.map(match => `${line(match.timeA)} ${match.placarA} x ${match.placarB} ${line(match.timeB)}`).join("\n"));
  else sections.push("Racha finalizado.");
  const medals = ["🥇", "🥈", "🥉"];
  for (const [title, players, unit] of [
    ["⚽ *ARTILHEIROS*", summary.goals, "gols"],
    ["🎯 *ASSISTÊNCIAS*", summary.assists, "assistências"],
    ["🏆 *MAIS VITÓRIAS*", summary.wins, "vitórias"],
  ] as const) {
    if (players.length) sections.push(title + "\n" + players.map(player => {
      const suffix = player.value === 1 ? { gols: "gol", assistências: "assistência", vitórias: "vitória" }[unit] : unit;
      return `${medals[player.place - 1]} ${player.name} — ${player.value} ${suffix}`;
    }).join("\n"));
  }
  sections.push("❤️⚽ FORTALAKA");
  return sections.join("\n\n");
}

export function getWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

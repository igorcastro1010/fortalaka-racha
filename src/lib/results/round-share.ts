import type { Match } from "../matches/repository";

/** Snapshot da RPC ler_partidas_rodada, identificado pelo p_racha usado na leitura. */
export type RoundShareSource = { roundId: string; date: string | null; partidas: readonly Match[] };
type PlayerTotal = { id: string; name: string; goals: number; assists: number; wins: number };
export type RoundLeader = { id: string; name: string; value: number; place: number };

function line(value: string) { return value.replace(/\s+/g, " ").trim(); }
function count(value: number) { return Number.isSafeInteger(value) && value > 0 ? value : 0; }
function timestamp(match: Match) {
  const time = Date.parse(match.createdAt ?? match.finalizadaAt ?? "");
  return Number.isNaN(time) ? Infinity : time;
}
function leaders(players: PlayerTotal[], field: "goals" | "assists" | "wins"): RoundLeader[] {
  // Sort estável: empate não ganha desempate arbitrário. Inclui empatados na terceira posição.
  const sorted = players.filter(player => player[field] > 0).sort((a, b) => b[field] - a[field]);
  let place = 0;
  return sorted.map((player, index) => {
    if (index === 0 || player[field] !== sorted[index - 1][field]) place = index + 1;
    return { id: player.id, name: player.name, value: player[field], place };
  }).filter(player => player.place <= 3);
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
      const total = totals.get(player.jogador_id) ?? { id: player.jogador_id, name: line(player.nome), goals: 0, assists: 0, wins: 0 };
      total.goals += count(player.gols);
      total.assists += count(player.assistencias);
      if ((player.time_id === match.timeAId && match.placarA > match.placarB)
        || (player.time_id === match.timeBId && match.placarB > match.placarA)) total.wins++;
      totals.set(player.jogador_id, total);
    }
  }
  const players = [...totals.values()];
  return { matches, participantCount: players.length, goals: leaders(players, "goals"), assists: leaders(players, "assists"), wins: leaders(players, "wins") };
}

export function buildRoundShareText(roundId: string, source: RoundShareSource): string {
  const summary = getRoundShareSummary(roundId, source);
  const sections = ["⚽❤️ *RACHA FORTALAKA*"];
  if (source.date && /^\d{4}-\d{2}-\d{2}$/.test(source.date)) {
    const date = new Date(`${source.date}T12:00:00Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === source.date) {
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

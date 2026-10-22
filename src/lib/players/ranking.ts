import type { PlayerStatistics } from "../matches/repository";

export const rankingOptions = [
  { id: "geral", label: "Geral" },
  { id: "nota", label: "Nota" },
  { id: "gols", label: "Gols" },
  { id: "assistencias", label: "Assistências" },
  { id: "vitorias", label: "Vitórias" },
  { id: "jogos", label: "Jogos" },
] as const;

export type RankingSort = typeof rankingOptions[number]["id"];

function rating(player: PlayerStatistics): number | null {
  const value = player.nota_geral_100;
  return player.quantidade_avaliacoes >= 2 && value != null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function sortRanking(players: readonly PlayerStatistics[], sort: RankingSort): PlayerStatistics[] {
  const general = [...players].sort((a, b) =>
    (b.nota_geral_100 ?? -1) - (a.nota_geral_100 ?? -1)
    || a.nome.localeCompare(b.nome, "pt-BR")
    || a.jogador_id.localeCompare(b.jogador_id)
  );
  if (sort === "geral") return general;
  return general.sort((a, b) => sort === "nota"
    ? (rating(b) ?? -1) - (rating(a) ?? -1)
    : b[sort] - a[sort]);
}

export function rankingMetric(player: PlayerStatistics, sort: RankingSort) {
  if (sort === "geral" || sort === "nota") return { value: rating(player), label: "overall" };
  const units = { gols: ["gol", "gols"], assistencias: ["assistência", "assistências"], vitorias: ["vitória", "vitórias"], jogos: ["jogo", "jogos"] };
  const value = player[sort];
  return { value, label: units[sort][value === 1 ? 0 : 1] };
}

import type { PlayerStatistics } from '../matches/repository';

export function publicOverall(player: PlayerStatistics | null): number | null {
  const value = player?.nota_geral_100;
  return player && player.quantidade_avaliacoes >= 2 && value != null && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

export function comparisonMetrics(a: PlayerStatistics | null, b: PlayerStatistics | null) {
  const metric = (label: string, read: (p: PlayerStatistics) => number | null) => ({ label, a: a ? read(a) : null, b: b ? read(b) : null });
  return [metric('Overall', publicOverall), metric('Jogos', p => p.jogos), metric('Gols', p => p.gols),
    metric('Assistências', p => p.assistencias), metric('Vitórias', p => p.vitorias),
    metric('Gols/jogo', p => p.jogos > 0 ? p.gols / p.jogos : null),
    metric('Vitórias/jogo', p => p.jogos > 0 ? p.vitorias / p.jogos : null)];
}

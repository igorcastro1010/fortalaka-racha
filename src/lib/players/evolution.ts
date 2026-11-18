import { getAchievements } from './achievements';

export type EvolutionStats = {
  jogos: number; gols: number; assistencias: number; vitorias: number; empates: number;
  derrotas: number; rodadas: number; sequencia: number; artilharias: number; destaques: number; garcons: number;
};
export type RatingPoint = { racha_id: string; data: string | null; overall: number; nome?: string; quantidade?: number };
export type EvolutionSummary = {
  stats: EvolutionStats;
  overall: { media: number | null; melhor: number | null; ultimas: RatingPoint[]; rodadas: number };
  marcos: Record<string, { earned: boolean; data: string | null }>;
};
export type MatchHistory = {
  id: string; racha_id: string; nome: string; data: string | null; estado: string;
  time_a: string; time_b: string; placar_a: number; placar_b: number;
  resultado: 'V' | 'E' | 'D'; gols: number; assistencias: number;
};
export type RoundHistory = { racha_id: string; nome: string; data: string | null; jogos: number; gols: number; vitorias: number; empates: number; derrotas: number };
export type HistoryPage<T> = { items: T[]; hasMore: boolean };

export function pointsPercentage(stats: Pick<EvolutionStats, 'jogos' | 'vitorias' | 'empates'>) {
  return stats.jogos > 0 ? Math.round((3 * stats.vitorias + stats.empates) / (3 * stats.jogos) * 1000) / 10 : null;
}
export function overallTrend(points: RatingPoint[]) {
  const [latest, previous] = points;
  // Sem ordem cronologica comprovada, nao inventar uma variacao.
  if (!latest?.data || !previous?.data || latest.data <= previous.data) return null;
  return latest.overall - previous.overall;
}
export function evolutionAchievements(summary: EvolutionSummary) {
  const s = summary.stats;
  const definitions: [string, string, string, number, number][] = [
    ...[1, 10, 25, 50].map((n): [string, string, string, number, number] => [`gols-${n}`, n === 1 ? 'Primeiro gol' : `${n} gols`, `${n} ${n === 1 ? 'gol registrado' : 'gols registrados'} em partidas finalizadas.`, s.gols, n]),
    ...[5, 10, 20].map((n): [string, string, string, number, number] => [`presencas-${n}`, `${n} rodadas`, `Participação comprovada em ${n} rodadas finalizadas.`, s.rodadas, n]),
    ['vitoria-1', 'Primeira vitória', 'Uma vitória com participação comprovada.', s.vitorias, 1],
    ...[3, 5].map((n): [string, string, string, number, number] => [`sequencia-${n}`, `${n} vitórias seguidas`, 'Sequência de partidas, interrompida por empate, derrota ou histórico incompleto.', s.sequencia, n]),
    ['artilheiro', 'Artilheiro da rodada', 'Mais gols em uma rodada finalizada. Empates compartilham a conquista.', s.artilharias, 1],
    ['destaque', 'Destaque da rodada', 'Maior overall após fechar avaliações, entre ao menos dois atletas com duas respostas válidas cada. Empates compartilham a conquista.', s.destaques, 1],
    ['garcom', 'Garçom da rodada', 'Mais assistências em uma rodada finalizada. Empates compartilham a conquista.', s.garcons, 1],
    ...getAchievements(s).filter(a => !a.id.startsWith('gols-')).map((a): [string, string, string, number, number] => [a.id, a.title, a.description, a.current, a.target]),
  ];
  return definitions.map(([id, title, description, current, target]) => ({
    id, title, description, current, target,
    earned: summary.marcos[id]?.earned ?? false, date: summary.marcos[id]?.data ?? null,
  }));
}

export function historyDate(date: string | null) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR') : 'Data não registrada';
}

import type { PlayerStatistics } from '../matches/repository';
import type { RankingSort } from '../players/ranking';
import type { RoundShareSummary } from './round-share';

export type VisualCard = { title: string; subtitle: string; facts: { label: string; value: string }[]; rows: { name: string; value: string; label: string; avatarUrl?: string | null; place?: number }[] };
export type RoundVisualKind = 'resultado' | 'artilharia' | 'destaques';

/** Recebe exatamente a ordenação visível na tela. Nenhum dado de autenticação vai ao card. */
export function rankingVisualCard(players: readonly PlayerStatistics[], sort: RankingSort, filterLabel: string): VisualCard {
  return { title: 'RANKING', subtitle: `Classificação atual · ${filterLabel}`, facts: [], rows: players.slice(0, 5).map((p, index) => ({
    place: index + 1, name: p.nome, avatarUrl: p.avatar_url,
    value: String(sort === 'geral' || sort === 'nota' ? p.quantidade_avaliacoes >= 2 ? p.nota_geral_100 ?? '--' : '--' : p[sort]),
    label: sort === 'geral' || sort === 'nota' ? 'overall /100' : filterLabel.toLocaleLowerCase('pt-BR'),
  })) };
}

export function roundVisualCard(summary: RoundShareSummary, kind: RoundVisualKind): VisualCard {
  const facts = [{ label: 'participantes', value: String(summary.participantCount) }, { label: 'partidas', value: String(summary.matches.length) }, { label: 'gols', value: String(summary.totalGoals) }];
  const date = summary.date && /^\d{4}-\d{2}-\d{2}$/.test(summary.date) ? summary.date.split('-').reverse().join('/') : 'Data a definir';
  const convert = (rows: RoundShareSummary['topScorers'], label: string) => rows.map(p => ({ name: p.name, value: String(p.value), label, avatarUrl: p.avatarUrl, place: p.place }));
  if (kind === 'artilharia') return { title: 'ARTILHARIA', subtitle: date, facts: [], rows: convert(summary.topScorers, 'gols') };
  const rows = [...convert(summary.topScorers.filter(p => p.place === 1), 'artilharia · gols'), ...convert(summary.assists.filter(p => p.place === 1), 'assistências'), ...convert(summary.wins.filter(p => p.place === 1), 'vitórias')];
  return { title: kind === 'resultado' ? 'RESULTADO DA RODADA' : 'DESTAQUES DA RODADA', subtitle: date, facts, rows: rows.slice(0, 5) };
}

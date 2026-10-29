type Stats = { jogos: number; gols: number; assistencias: number; vitorias: number };
export type Achievement = { id: string; title: string; description: string; earned: boolean; current: number; target: number };

export function getAchievements(stats: Stats): Achievement[] {
  return ([['gols', [1, 10, 25, 50]], ['jogos', [10, 25, 50]], ['vitorias', [10, 25]], ['assistencias', [1, 10, 25]]] as const).flatMap(([field, targets]) => targets.map(target => {
    const label = { gols: 'gols', jogos: 'jogos', vitorias: 'vitórias', assistencias: 'assistências' }[field];
    const current = Number.isFinite(stats[field]) ? Math.max(0, stats[field]) : 0;
    return { id: `${field}-${target}`, title: target === 1 ? field === 'gols' ? 'Primeiro gol' : 'Primeira assistência' : `${target} ${label}`,
      description: target === 1 ? field === 'gols' ? 'Marcou seu primeiro gol.' : 'Registrou sua primeira assistência.' : `Alcançou ${target} ${label} em partidas finalizadas.`,
      earned: current >= target, current, target };
  }));
}

export type HonourMatch = { id: string; racha_id: string; status: string; time_a_id: string; time_b_id: string; rachas: { estado: string };
  partida_jogadores: { jogador_id: string; time_id: string; participou: boolean }[];
  eventos_partida: { jogador_id: string; tipo: string; quantidade: number }[] };

/** Um prêmio por rodada; empates positivos compartilham a conquista. */
export function getRoundHonours(matches: readonly HonourMatch[], playerId: string) {
  const rounds = new Map<string, Map<string, { goals: number; assists: number }>>();
  const seen = new Set<string>();
  for (const match of matches) {
    if (seen.has(match.id) || match.status !== 'finalizada' || match.rachas?.estado !== 'finalizado') continue;
    seen.add(match.id);
    const totals = rounds.get(match.racha_id) ?? new Map<string, { goals: number; assists: number }>();
    const eligible = new Set(match.partida_jogadores.filter(p => p.participou && [match.time_a_id, match.time_b_id].includes(p.time_id)).map(p => p.jogador_id));
    for (const event of match.eventos_partida) {
      if (!eligible.has(event.jogador_id) || !Number.isSafeInteger(event.quantidade) || event.quantidade <= 0) continue;
      const player = totals.get(event.jogador_id) ?? { goals: 0, assists: 0 };
      if (event.tipo === 'gol') player.goals += event.quantidade;
      if (event.tipo === 'assistencia') player.assists += event.quantidade;
      totals.set(event.jogador_id, player);
    }
    rounds.set(match.racha_id, totals);
  }
  let scorer = 0, assists = 0;
  for (const totals of rounds.values()) {
    const player = totals.get(playerId);
    if (!player) continue;
    const maxGoals = Math.max(0, ...[...totals.values()].map(p => p.goals));
    const maxAssists = Math.max(0, ...[...totals.values()].map(p => p.assists));
    if (maxGoals > 0 && player.goals === maxGoals) scorer++;
    if (maxAssists > 0 && player.assists === maxAssists) assists++;
  }
  return { scorer, assists };
}

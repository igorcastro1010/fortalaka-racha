export type Participant = {
  id: string;
  name: string;
  tipo: "goleiro_fixo" | "linha" | "suplente";
  status: "presente" | "ausente" | "removido";
};

export type DrawTeam = { numero: number; nome: string; cor: string | null; jogadores: string[] };
export type Round = { id: string; nome: string; data: string; versao: number; confirmado: boolean };
export type RoundDetail = { rodada: Round; participantes: Participant[]; times: DrawTeam[] };

export function eligiblePlayers(participants: Participant[]) {
  return participants.filter((p) => p.tipo === "linha" && p.status === "presente");
}

export function availabilityError(count: number) {
  if (count < 20) return "São necessários 20 jogadores de linha para formar 4 times de 5.";
  if (count > 20) return "Existem mais de 20 jogadores disponíveis. Ajuste a lista antes de sortear.";
  return "";
}

export function validateTeams(teams: DrawTeam[], participants: Participant[]) {
  const players = eligiblePlayers(participants);
  const countError = availabilityError(players.length);
  if (countError) return countError;
  const ids = teams.flatMap((team) => team.jogadores);
  const expected = new Set(players.map((p) => p.id));
  if (teams.length !== 4 || new Set(teams.map((t) => t.numero)).size !== 4 ||
      teams.some((t) => ![1, 2, 3, 4].includes(t.numero) || t.jogadores.length !== 5) ||
      expected.size !== 20 || new Set(ids).size !== 20 || ids.some((id) => !expected.has(id))) {
    return "Os times devem conter os 20 jogadores de linha, sem repetições, em 4 times de 5.";
  }
  return "";
}

// Fisher–Yates; IDs da participação na rodada, nunca índices ou nomes.
export function drawTeams(participants: Participant[], random: () => number = Math.random): DrawTeam[] {
  const players = eligiblePlayers(participants);
  const error = availabilityError(players.length);
  if (error) throw new Error(error);
  if (new Set(players.map((p) => p.id)).size !== 20) throw new Error("Existem participantes repetidos na rodada.");
  const ids = players.map((p) => p.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return Array.from({ length: 4 }, (_, index) => ({
    numero: index + 1, nome: `Time ${index + 1}`, cor: null, jogadores: ids.slice(index * 5, index * 5 + 5),
  }));
}

export function swapPlayers(teams: DrawTeam[], first: string, second: string): DrawTeam[] {
  const a = teams.findIndex((t) => t.jogadores.includes(first));
  const b = teams.findIndex((t) => t.jogadores.includes(second));
  if (a < 0 || b < 0 || a === b) throw new Error("Selecione jogadores de times diferentes.");
  return teams.map((t) => ({ ...t, jogadores: t.jogadores.map((id) => id === first ? second : id === second ? first : id) }));
}

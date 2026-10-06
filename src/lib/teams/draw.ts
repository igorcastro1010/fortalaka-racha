export type TeamPlayer = {
  id: string;
  name: string;
  jogadorId?: string | null;
};

export type DrawTeam = {
  id: string;
  name: string;
  number: number;
  players: TeamPlayer[];
};

export type TeamDraw = {
  teams: DrawTeam[];
};

export const REQUIRED_FIELD_PLAYERS = 20;
export const TEAM_COUNT = 4;
export const PLAYERS_PER_TEAM = 5;

export function validateFieldPlayers(players: TeamPlayer[]) {
  if (players.length < REQUIRED_FIELD_PLAYERS) {
    return "Sao necessarios 20 jogadores de linha para formar 4 times de 5.";
  }

  if (players.length > REQUIRED_FIELD_PLAYERS) {
    return "Existem mais de 20 jogadores disponiveis. Ajuste a lista antes de sortear.";
  }

  return "";
}

export function drawTeams(players: TeamPlayer[]): TeamDraw {
  const validationError = validateFieldPlayers(players);

  if (validationError) {
    throw new Error(validationError);
  }

  const shuffled = shuffle(players);
  const teams: DrawTeam[] = Array.from({ length: TEAM_COUNT }, (_, teamIndex) => {
    const number = teamIndex + 1;
    const start = teamIndex * PLAYERS_PER_TEAM;

    return {
      id: `time-${number}`,
      name: `Time ${number}`,
      number,
      players: shuffled.slice(start, start + PLAYERS_PER_TEAM),
    };
  });

  return { teams };
}

export function swapPlayers(draw: TeamDraw, fromPlayerId: string, toPlayerId: string): TeamDraw {
  if (fromPlayerId === toPlayerId) {
    return draw;
  }

  const nextTeams = draw.teams.map((team) => ({
    ...team,
    players: [...team.players],
  }));
  const from = findPlayerPosition(nextTeams, fromPlayerId);
  const to = findPlayerPosition(nextTeams, toPlayerId);

  if (!from || !to || from.teamIndex === to.teamIndex) {
    return draw;
  }

  const fromPlayer = nextTeams[from.teamIndex].players[from.playerIndex];
  const toPlayer = nextTeams[to.teamIndex].players[to.playerIndex];

  nextTeams[from.teamIndex].players[from.playerIndex] = toPlayer;
  nextTeams[to.teamIndex].players[to.playerIndex] = fromPlayer;

  return { teams: nextTeams };
}

export function hasCompleteTeams(draw: TeamDraw) {
  return draw.teams.length === TEAM_COUNT && draw.teams.every((team) => team.players.length === PLAYERS_PER_TEAM);
}

function shuffle(players: TeamPlayer[]) {
  const shuffled = [...players];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  return shuffled;
}

function findPlayerPosition(teams: DrawTeam[], playerId: string) {
  for (let teamIndex = 0; teamIndex < teams.length; teamIndex += 1) {
    const playerIndex = teams[teamIndex].players.findIndex((player) => player.id === playerId);

    if (playerIndex >= 0) {
      return { teamIndex, playerIndex };
    }
  }

  return null;
}

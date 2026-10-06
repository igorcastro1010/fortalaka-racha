export type TeamPlayer = {
  id: string;
  name: string;
  jogadorId?: string | null;
  avatarUrl?: string | null;
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

export const MAX_PLAYERS_PER_TEAM = 5;

export function getTeamCount(playerCount: number) {
  return Math.ceil(playerCount / MAX_PLAYERS_PER_TEAM);
}

export function drawTeams(players: TeamPlayer[]): TeamDraw {
  if (!players.length) {
    throw new Error("Nenhum jogador de linha disponível para sorteio.");
  }

  const shuffled = shuffle(players);
  const teamCount = getTeamCount(shuffled.length);
  const basePlayersPerTeam = Math.floor(shuffled.length / teamCount);
  const teamsWithExtraPlayer = shuffled.length % teamCount;
  let nextPlayerIndex = 0;

  const teams: DrawTeam[] = Array.from({ length: teamCount }, (_, teamIndex) => {
    const number = teamIndex + 1;
    const teamSize = basePlayersPerTeam + (teamIndex < teamsWithExtraPlayer ? 1 : 0);
    const teamPlayers = shuffled.slice(nextPlayerIndex, nextPlayerIndex + teamSize);
    nextPlayerIndex += teamSize;

    return {
      id: `time-${number}`,
      name: `Time ${number}`,
      number,
      players: teamPlayers,
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
  if (!draw.teams.length || draw.teams.some((team) => !team.players.length || team.players.length > MAX_PLAYERS_PER_TEAM)) {
    return false;
  }

  const teamSizes = draw.teams.map((team) => team.players.length);
  const smallestTeam = Math.min(...teamSizes);
  const largestTeam = Math.max(...teamSizes);

  return largestTeam - smallestTeam <= 1;
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

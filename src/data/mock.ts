export type Player = {
  name: string;
  avatar: string;
  rating: number;
  games: number;
  goals: number;
  assists: number;
  wins: number;
};

export const nextMatch = {
  day: "Quinta-feira",
  date: "08/10/2026",
  time: "20:00",
  address: "R. Julio Cesar, 447",
};

export const goalkeepers = ["Gabriel Sol", "Kauan Gustavo", "Lucas Emanoel"];

export const fieldPlayers = [
  "Igor",
  "Jack",
  "PH",
  "Hamilton",
  "Ednardo",
  "Tarcisio",
  "Seedorf",
  "Gabriel Lobo",
  "Nicolas Lobo",
  "Nones",
  "Dede",
  "Levi",
  "Alerrandro",
  "Matheus Jack Motos",
  "Gustavo",
  "Arthur PH",
  "Sobral",
  "Caiox",
  "Igor Gurgel",
  "Bruno",
];

export const substitutes = ["Felipe", "Ruan", "Marcos"];

export const teams = [
  {
    name: "Time Preto",
    color: "bg-neutral-950 text-white",
    players: ["Gabriel Sol", "Igor", "PH", "Tarcisio", "Dede", "Caiox"],
  },
  {
    name: "Time Branco",
    color: "bg-white text-neutral-950",
    players: ["Kauan Gustavo", "Jack", "Hamilton", "Seedorf", "Levi", "Bruno"],
  },
  {
    name: "Time Vermelho",
    color: "bg-red-600 text-white",
    players: ["Lucas Emanoel", "Ednardo", "Gabriel Lobo", "Nones", "Gustavo", "Sobral"],
  },
];

export const ranking: Player[] = [
  { name: "Igor", avatar: "IG", rating: 8.9, games: 18, goals: 21, assists: 12, wins: 13 },
  { name: "Seedorf", avatar: "SE", rating: 8.7, games: 17, goals: 16, assists: 15, wins: 12 },
  { name: "Gabriel Sol", avatar: "GS", rating: 8.5, games: 16, goals: 0, assists: 2, wins: 11 },
  { name: "PH", avatar: "PH", rating: 8.3, games: 18, goals: 12, assists: 10, wins: 10 },
  { name: "Jack", avatar: "JA", rating: 8.1, games: 15, goals: 14, assists: 6, wins: 9 },
];

export const profile = {
  name: "Igor",
  avatar: "IG",
  stats: [
    { label: "Nota media", value: "8.9" },
    { label: "Jogos", value: "18" },
    { label: "Gols", value: "21" },
    { label: "Assistencias", value: "12" },
    { label: "Vitorias", value: "13" },
  ],
  recentGames: [
    { date: "01/10", result: "Vitoria", goals: 2, assists: 1 },
    { date: "24/09", result: "Empate", goals: 1, assists: 0 },
    { date: "17/09", result: "Vitoria", goals: 3, assists: 2 },
  ],
};

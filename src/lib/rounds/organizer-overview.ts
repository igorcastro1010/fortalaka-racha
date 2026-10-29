import type { RoundDetails } from "./repository";
import type { RoundTeamsState } from "../teams/repository";
import type { MatchesState } from "../matches/repository";
import type { EvaluationProgress } from "../ratings/repository";

export type OrganizerDestination = "racha" | "teams" | "results" | "evaluate";

/** Mesma contagem usada pelo card da Home e pelo painel. */
export function getRoundParticipantCounts(participants: RoundDetails["participants"]) {
  const confirmed = participants.filter(player => player.status === "confirmado" && player.type !== "suplente").length;
  const substitutes = participants.filter(player => player.status === "confirmado" && player.type === "suplente").length;
  const absent = participants.filter(player => player.status === "ausente").length;
  return { confirmed, substitutes, absent };
}

/** Apresentação do estado persistido; não autoriza nem executa transições. */
export function buildOrganizerOverview(round: RoundDetails, teams: RoundTeamsState | null, matches: MatchesState | null, evaluations: EvaluationProgress | null) {
  const { confirmed, substitutes, absent } = getRoundParticipantCounts(round.participants);
  const validTeams = teams?.roundId === round.roundId && teams.status === round.status ? teams : null;
  const validMatches = matches && (!matches.roundStatus || matches.roundStatus === round.status) ? matches : null;
  const currentMatch = validMatches?.partidas.find(match => match.id === validMatches.fila?.currentMatchId && match.status === "aberta")
    ?? validMatches?.partidas.find(match => match.status === "aberta") ?? null;
  const finalized = validMatches ? validMatches.partidas.filter(match => match.status === "finalizada").length : null;
  // A RPC conta respondentes distintos, não a quantidade de notas individuais enviadas.
  const evaluationsCompleted = Boolean(evaluations && !evaluations.abertas && evaluations.respondentes > 0);
  const evaluationStatus = !evaluations ? null : evaluations.abertas ? "ABERTAS" : evaluationsCompleted ? "ENCERRADAS" : "FECHADAS";
  const teamsStatus = !validTeams ? null : !validTeams.teams.length ? "NÃO SORTEADOS" : validTeams.confirmed ? "CONFIRMADOS" : "RASCUNHO";
  const rachaStatus = round.status === "finalizado" ? "FINALIZADO" : round.status === "em_andamento" ? "EM ANDAMENTO" : "NÃO INICIADO";

  let alert: string;
  let primary: { label: string; destination: OrganizerDestination };
  if (round.status === "aberto") {
    alert = confirmed ? `${confirmed} ${confirmed === 1 ? "jogador confirmado" : "jogadores confirmados"}.` : "Nenhum jogador entrou na lista ainda.";
    primary = { label: "GERENCIAR LISTA", destination: "racha" };
  } else if (round.status === "lista_fechada") {
    alert = !validTeams ? "Lista fechada. Consulte os times da rodada." : validTeams.teams.length ? "Times em rascunho. Confira a composição e confirme os times." : "Lista fechada. Falta definir os times.";
    primary = { label: validTeams?.teams.length ? "REVISAR TIMES" : "SORTEAR TIMES", destination: "teams" };
  } else if (round.status === "finalizado") {
    if (!evaluations) {
      alert = "Racha finalizado. Consulte o estado das avaliações.";
      primary = { label: "VER AVALIAÇÕES", destination: "evaluate" };
    } else if (evaluations.abertas) {
      alert = "Avaliações em andamento.";
      primary = { label: "ACOMPANHAR AVALIAÇÕES", destination: "evaluate" };
    } else if (evaluationsCompleted) {
      alert = "Rodada concluída.";
      primary = { label: "VER RESUMO DO RACHA", destination: "results" };
    } else {
      // Fechadas sem respostas não provam que nunca foram abertas.
      alert = "Racha finalizado. Avaliações fechadas.";
      primary = { label: "ABRIR AVALIAÇÕES", destination: "evaluate" };
    }
  } else {
    alert = currentMatch ? "Partida em andamento." : validMatches?.partidas.length === 0 ? "Times prontos. Você já pode iniciar o racha."
      : validMatches ? "Partidas registradas. Confira os resultados e a próxima partida." : "Consulte as partidas da rodada em Resultados.";
    primary = { label: currentMatch || finalized ? "GERENCIAR PARTIDAS" : "IR PARA RESULTADOS", destination: "results" };
  }
  const waiting = validMatches?.fila?.order.filter(id => !currentMatch || ![currentMatch.timeAId, currentMatch.timeBId].includes(id))
    .map(id => validMatches.times.find(team => team.id === id)?.nome).filter((name): name is string => Boolean(name)) ?? [];
  return { confirmed, substitutes, absent, teamCount: validTeams?.teams.length ?? null, teamsStatus,
    matchCount: validMatches?.partidas.length ?? null, finalized, currentMatch, waiting,
    listStatus: round.status === "aberto" ? "ABERTA" : "FECHADA", rachaStatus, evaluationStatus, evaluationsCompleted, alert, primary };
}

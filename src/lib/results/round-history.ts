import { createClient } from "@/lib/supabase/client";
import { getRoundMatches, type Match } from "@/lib/matches/repository";
import { getRoundMetrics } from "./round-share";

export const HISTORY_PAGE_SIZE = 8;
type Metadata = { id: string; nome: string | null; data: string | null; horario: string | null; endereco: string | null; estado: string };
type MetricRow = { id: string; status: Match["status"]; placar_a: number; placar_b: number; time_a_id: string; time_b_id: string; partida_jogadores: { jogador_id: string; time_id: string; participou: boolean }[] };
export type HistoryRound = Metadata & ReturnType<typeof getRoundMetrics>;
export type HistoryPage = { rounds: HistoryRound[]; hasMore: boolean };
export type HistoryPlayer = { id: string; name: string; avatarUrl: string | null };

export async function getRoundHistory(offset = 0): Promise<HistoryPage> {
  const { data, error } = await createClient().from("rachas")
    .select("id,nome,data,horario,endereco,estado,partidas(id,status,placar_a,placar_b,time_a_id,time_b_id,partida_jogadores(jogador_id,time_id,participou))")
    .eq("estado", "finalizado").eq("partidas.status", "finalizada")
    .order("data", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(offset, offset + HISTORY_PAGE_SIZE);
  if (error) throw error;
  const rows = (data ?? []) as unknown as (Metadata & { partidas: MetricRow[] })[];
  return { hasMore: rows.length > HISTORY_PAGE_SIZE, rounds: rows.slice(0, HISTORY_PAGE_SIZE).filter(row => row.estado === "finalizado").map(({ partidas, ...round }) => ({ ...round, ...getRoundMetrics((partidas ?? []).map(match => ({ id: match.id, status: match.status, placarA: match.placar_a, placarB: match.placar_b, timeAId: match.time_a_id, timeBId: match.time_b_id, jogadores: match.partida_jogadores ?? [] }))) })) };
}

export async function getHistoricalRound(id: string) {
  const client = createClient();
  const metadata = await client.from("rachas").select("id,nome,data,horario,endereco,estado").eq("id", id).eq("estado", "finalizado").maybeSingle();
  if (metadata.error) throw metadata.error;
  if (!metadata.data || metadata.data.estado !== "finalizado") throw new Error("Rodada finalizada não encontrada.");
  const [matches, participants, teams, avatars] = await Promise.all([
    getRoundMatches(id),
    client.from("racha_participantes").select("id,jogador_id,nome,status").eq("racha_id", id).order("created_at", { ascending: true }),
    client.from("times").select("id,nome,numero,time_jogadores(jogador_id,ativo)").eq("racha_id", id).eq("confirmado", true).eq("ativo", true).order("numero", { ascending: true }),
    client.rpc("avatars_da_rodada", { p_racha: id }),
  ]);
  for (const result of [participants, teams, avatars]) if (result.error) throw result.error;
  if (matches.roundStatus !== "finalizado") throw new Error("Esta rodada não está finalizada.");
  const photos = new Map<string, string | null>((avatars.data ?? []).map((player: { jogador_id: string; avatar_url: string | null }) => [player.jogador_id, player.avatar_url]));
  const players = (participants.data ?? []).map(player => ({ id: player.jogador_id ?? player.id, name: player.nome, avatarUrl: photos.get(player.jogador_id) ?? null, status: player.status, registeredId: player.jogador_id as string | null }));
  const byId = new Map(players.filter(player => player.registeredId).map(player => [player.registeredId, player]));
  return { round: metadata.data as Metadata, matches: matches.partidas, participants: players.filter(player => player.status !== "removido"), teams: (teams.data ?? []).map(team => ({ id: team.id, name: team.nome, players: team.time_jogadores.filter(player => player.ativo).map(player => byId.get(player.jogador_id)).filter((player): player is NonNullable<typeof player> => Boolean(player)) })) };
}

export type HistoricalRound = Awaited<ReturnType<typeof getHistoricalRound>>;
export function historyDate(value: string | null) {
  if (!value) return "Data não informada";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? "Data não informada" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date).replaceAll(".", "");
}

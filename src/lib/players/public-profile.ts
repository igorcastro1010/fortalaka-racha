import { getPlayerStatistics, type PlayerStatistics } from "@/lib/matches/repository";
import { createClient } from "@/lib/supabase/client";
import { attributes, type RatingSummary } from "@/lib/ratings/summary";

export type PublicPlayer = Pick<PlayerStatistics, "nome" | "avatar_url" | "jogos" | "gols" | "assistencias" | "vitorias" | "nota_geral_100"> & {
  summary: RatingSummary | null; ratingsRestricted: boolean; ratingsUnavailable: boolean;
};

export function validPlayerId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// Only existing authenticated aggregate RPCs; never fetch profiles or individual votes.
export async function getPublicPlayer(id: string, canReadAttributes: boolean): Promise<PublicPlayer | null> {
  if (!validPlayerId(id)) return null;
  const [statistics, ratings] = await Promise.all([
    getPlayerStatistics(id),
    canReadAttributes ? createClient().rpc("medias_jogador", { p_jogador: id }).then(result => result, () => ({ data: null, error: true })) : Promise.resolve(null),
  ]);
  const player = statistics.find(row => row.jogador_id === id);
  if (!player) return null;
  const raw = ratings && !ratings.error ? ratings.data?.[0] as RatingSummary | undefined : undefined;
  const summary = raw && Number(raw.quantidade) >= 2 ? {
    quantidade: Number(raw.quantidade),
    ...Object.fromEntries(attributes.map(({ key }) => [key, raw[key] === null || raw[key] === undefined || !Number.isFinite(Number(raw[key])) ? null : Number(raw[key])])),
  } as RatingSummary : null;
  return {
    nome: player.nome, avatar_url: player.avatar_url, jogos: player.jogos, gols: player.gols,
    assistencias: player.assistencias, vitorias: player.vitorias,
    nota_geral_100: Number(player.quantidade_avaliacoes) >= 2 ? player.nota_geral_100 : null,
    summary, ratingsRestricted: !canReadAttributes, ratingsUnavailable: Boolean(ratings?.error),
  };
}

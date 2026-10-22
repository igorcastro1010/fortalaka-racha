import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundParticipant, RoundStatus } from "@/lib/teams/repository";
import { createClient } from "@/lib/supabase/client";

export type RoundDetails = {
  roundId: string;
  roundName: string;
  status: RoundStatus;
  date: string | null;
  time: string | null;
  address: string | null;
  participants: RoundParticipant[];
};

export type PlayerProfileOption = {
  id: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
};

type RoundRow = {
  id: string;
  nome: string | null;
  estado: RoundStatus;
  data: string | null;
  horario: string | null;
  endereco: string | null;
};

type ParticipantRow = {
  id: string;
  jogador_id: string | null;
  nome: string;
  tipo: RoundParticipant["type"];
  status: RoundParticipant["status"];
};

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  avatar_url?: string | null;
};

export async function getCurrentRoundDetails(supabase: SupabaseClient): Promise<RoundDetails | null> {
  const { data: round, error: roundError } = await supabase
    .from("rachas")
    .select("id, nome, estado, data, horario, endereco")
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<RoundRow>();

  if (roundError) throw roundError;
  if (!round) return null;

  const { data: participants, error: participantsError } = await supabase
    .from("racha_participantes")
    .select("id, jogador_id, nome, tipo, status")
    .eq("racha_id", round.id)
    .order("created_at", { ascending: true })
    .returns<ParticipantRow[]>();

  if (participantsError) {
    throw participantsError;
  }

  const { data: avatars, error: avatarError } = await supabase.rpc("avatars_da_rodada", { p_racha: round.id });
  if (avatarError) throw avatarError;
  const avatarById = new Map<string, string | null>((avatars ?? []).map((p: { jogador_id: string; avatar_url: string | null }) => [p.jogador_id, p.avatar_url]));

  return {
    roundId: round.id,
    roundName: round.nome ?? "Racha atual",
    status: round.estado,
    date: round.data,
    time: round.horario,
    address: round.endereco,
    participants: (participants ?? []).map((participant) => ({
      id: participant.id,
      jogadorId: participant.jogador_id,
      name: participant.nome,
      avatarUrl: avatarById.get(participant.jogador_id ?? "") ?? null,
      type: participant.tipo,
      status: participant.status,
    })),
  };
}

export async function getAvailableProfiles(supabase: SupabaseClient) {
  let { data, error } = await supabase
    .from("profiles")
    .select("id, name, email, avatar_url")
    .eq("active", true)
    .order("name", { ascending: true })
    .returns<ProfileRow[]>();

  if (error && isAvatarColumnError(error)) {
    const fallback = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<ProfileRow[]>();

    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw error;
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? null,
  }));
}

function isAvatarColumnError(error: { message?: string; code?: string }) {
  const message = error.message?.toLowerCase() ?? "";
  return message.includes("avatar_url") || error.code === "42703";
}

export async function createRound(supabase: SupabaseClient, input: {
  name: string;
  date: string;
  time: string;
  address: string;
}) {
  const { error } = await supabase.from("rachas").insert({
    nome: input.name,
    data: input.date,
    horario: input.time,
    endereco: input.address,
    estado: "aberto",
  });

  if (error) {
    throw error;
  }
}

export async function addRoundParticipant(supabase: SupabaseClient, input: {
  roundId: string;
  player: PlayerProfileOption;
  type: RoundParticipant["type"];
  status: RoundParticipant["status"];
}) {
  const existing = await supabase.from("racha_participantes").select("id").eq("racha_id", input.roundId).eq("jogador_id", input.player.id).maybeSingle<{ id: string }>();
  if (existing.error) throw existing.error;
  if (existing.data) return updateRoundParticipant(supabase, existing.data.id, { type: input.type, status: input.status });
  const { error } = await supabase.from("racha_participantes").insert({
    racha_id: input.roundId,
    jogador_id: input.player.id,
    nome: input.player.name,
    tipo: input.type,
    status: input.status,
  });

  if (error) {
    throw error;
  }
}

export async function updateRoundParticipant(supabase: SupabaseClient, participantId: string, input: {
  type: RoundParticipant["type"];
  status: RoundParticipant["status"];
}) {
  const { error } = await supabase
    .from("racha_participantes")
    .update({
      tipo: input.type,
      status: input.status,
    })
    .eq("id", participantId);

  if (error) {
    throw error;
  }
}

export async function removeRoundParticipant(supabase: SupabaseClient, participantId: string) {
  const { error } = await supabase.from("racha_participantes").update({ status: "removido" }).eq("id", participantId);

  if (error) {
    throw error;
  }
}

export async function setOwnRegistration(roundId: string, join: boolean) {
  try {
    const { error } = await createClient().rpc("inscricao_rodada", { p_racha: roundId, p_tipo: "linha", p_entrar: join });
    if (error) throw error;
  } catch (error) {
    console.error("Falha ao atualizar inscrição da rodada", error);
    throw new Error(join ? "Não foi possível entrar na lista. Tente novamente." : "Não foi possível sair da lista. Tente novamente.");
  }
}

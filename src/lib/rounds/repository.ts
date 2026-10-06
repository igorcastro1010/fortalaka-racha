import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundParticipant, RoundStatus } from "@/lib/teams/repository";

export type RoundDetails = {
  roundId: string;
  roundName: string;
  status: RoundStatus;
  participants: RoundParticipant[];
};

export type PlayerProfileOption = {
  id: string;
  name: string;
  email: string | null;
};

type RoundRow = {
  id: string;
  nome: string | null;
  estado: RoundStatus;
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
};

export async function getCurrentRoundDetails(supabase: SupabaseClient): Promise<RoundDetails | null> {
  const { data: round, error: roundError } = await supabase
    .from("rachas")
    .select("id, nome, estado")
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle<RoundRow>();

  if (roundError || !round) {
    return null;
  }

  const { data: participants } = await supabase
    .from("racha_participantes")
    .select("id, jogador_id, nome, tipo, status")
    .eq("racha_id", round.id)
    .order("created_at", { ascending: true })
    .returns<ParticipantRow[]>();

  return {
    roundId: round.id,
    roundName: round.nome ?? "Racha atual",
    status: round.estado,
    participants: (participants ?? []).map((participant) => ({
      id: participant.id,
      jogadorId: participant.jogador_id,
      name: participant.nome,
      type: participant.tipo,
      status: participant.status,
    })),
  };
}

export async function getAvailableProfiles(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("active", true)
    .order("name", { ascending: true })
    .returns<ProfileRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((profile) => ({
    id: profile.id,
    name: profile.name,
    email: profile.email,
  }));
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
  const { error } = await supabase.from("racha_participantes").delete().eq("id", participantId);

  if (error) {
    throw error;
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RoundParticipant, RoundStatus } from "@/lib/teams/repository";
import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod, PaymentStatus } from "@/lib/payments/summary";
import { withReadSignal } from '@/lib/live/read-signal';

export type RoundDetails = {
  roundId: string;
  roundName: string;
  status: RoundStatus;
  date: string | null;
  time: string | null;
  address: string | null;
  participants: RoundParticipant[];
  paymentsAvailable?: boolean;
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
  forma_pagamento?: PaymentMethod | null;
  status_pagamento?: PaymentStatus;
  valor_pagamento?: number | null;
};

type ProfileRow = {
  id: string;
  name: string;
  email: string | null;
  avatar_url?: string | null;
};

export async function getCurrentRoundDetails(supabase: SupabaseClient, signal?: AbortSignal): Promise<RoundDetails | null> {
  const { data: round, error: roundError } = await withReadSignal(supabase
    .from("rachas")
    .select("id, nome, estado, data, horario, endereco")
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<RoundRow>(), signal);

  if (roundError) throw roundError;
  if (!round) return null;

  const readParticipants = async () => {
    let { data: participants, error: participantsError } = await withReadSignal(supabase
      .from("racha_participantes")
      .select("id, jogador_id, nome, tipo, status, forma_pagamento, status_pagamento, valor_pagamento")
      .eq("racha_id", round.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .returns<ParticipantRow[]>(), signal);

    const paymentsAvailable = !participantsError;
    if (participantsError && ["42703", "PGRST204"].includes(participantsError.code) && /forma_pagamento|status_pagamento|valor_pagamento/.test(participantsError.message)) {
      // Preserve read-only app flows until the paired database migration is applied.
      const fallback = await withReadSignal(supabase.from("racha_participantes").select("id, jogador_id, nome, tipo, status")
        .eq("racha_id", round.id).order("created_at", { ascending: true }).order("id", { ascending: true }).returns<ParticipantRow[]>(), signal);
      participants = fallback.data;
      participantsError = fallback.error;
    }

    if (participantsError) {
      throw participantsError;
    }

    return { participants, paymentsAvailable };
  };
  const [{ participants, paymentsAvailable }, { data: avatars, error: avatarError }] = await Promise.all([
    readParticipants(), withReadSignal(supabase.rpc("avatars_da_rodada", { p_racha: round.id }), signal),
  ]);
  if (avatarError) throw avatarError;
  const avatarById = new Map<string, string | null>((avatars ?? []).map((p: { jogador_id: string; avatar_url: string | null }) => [p.jogador_id, p.avatar_url]));

  return {
    roundId: round.id,
    roundName: round.nome ?? "Racha atual",
    status: round.estado,
    date: round.data,
    time: round.horario,
    address: round.endereco,
    paymentsAvailable,
    participants: (participants ?? []).map((participant) => ({
      id: participant.id,
      jogadorId: participant.jogador_id,
      name: participant.nome,
      avatarUrl: avatarById.get(participant.jogador_id ?? "") ?? null,
      type: participant.tipo,
      status: participant.status,
      paymentMethod: participant.forma_pagamento ?? null,
      paymentStatus: participant.status_pagamento ?? "pendente",
      paymentAmount: participant.valor_pagamento == null ? null : Number(participant.valor_pagamento),
    })),
  };
}

export async function getAvailableProfiles(supabase: SupabaseClient, signal?: AbortSignal) {
  let { data, error } = await withReadSignal(supabase
    .from("profiles")
    .select("id, name, email, avatar_url")
    .eq("active", true)
    .order("name", { ascending: true })
    .returns<ProfileRow[]>(), signal);

  if (error && isAvatarColumnError(error)) {
    const fallback = await withReadSignal(supabase
      .from("profiles")
      .select("id, name, email")
      .eq("active", true)
      .order("name", { ascending: true })
      .returns<ProfileRow[]>(), signal);

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
  paymentMethod: PaymentMethod;
  listOpen: boolean;
}) {
  const existing = await supabase.from("racha_participantes").select("id, forma_pagamento").eq("racha_id", input.roundId).eq("jogador_id", input.player.id).maybeSingle<{ id: string; forma_pagamento: PaymentMethod | null }>();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const method = input.listOpen ? input.paymentMethod : existing.data.forma_pagamento;
    if (!method) throw new Error("Reabra a lista para selecionar uma forma de pagamento desta inscrição.");
    const { error } = await supabase.from("racha_participantes").update({ tipo: input.type, status: input.status, forma_pagamento: method }).eq("id", existing.data.id);
    if (error) throw new Error("Não foi possível atualizar a inscrição.");
    return;
  }
  const { error } = await supabase.from("racha_participantes").insert({
    racha_id: input.roundId,
    jogador_id: input.player.id,
    nome: input.player.name,
    tipo: input.type,
    status: input.status,
    forma_pagamento: input.paymentMethod,
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

export async function setOwnRegistration(roundId: string, join: boolean, paymentMethod?: PaymentMethod | null, paymentsAvailable = true) {
  if (join && paymentMethod !== "pix" && paymentMethod !== "dinheiro") throw new Error("Selecione PIX ou Dinheiro.");
  if (join && !paymentsAvailable) throw new Error("Inscrições temporariamente indisponíveis.");
  try {
    const { error } = await createClient().rpc("inscricao_rodada", { p_racha: roundId, p_tipo: "linha", p_entrar: join, ...(paymentsAvailable ? { p_forma_pagamento: paymentMethod ?? null } : {}) });
    if (error) throw error;
  } catch (error) {
    console.error("Falha ao atualizar inscrição da rodada", { code: typeof error === "object" && error !== null && "code" in error ? error.code : "UNKNOWN" });
    throw new Error(join ? "Não foi possível entrar na lista. Tente novamente." : "Não foi possível sair da lista. Tente novamente.");
  }
}

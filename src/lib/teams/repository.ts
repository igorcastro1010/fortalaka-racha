import type { SupabaseClient } from "@supabase/supabase-js";
import type { DrawTeam, TeamPlayer } from "@/lib/teams/draw";

export type RoundParticipant = TeamPlayer & {
  jogadorId: string | null;
  type: "goleiro" | "linha" | "suplente";
  status: "confirmado" | "ausente" | "removido";
};

export type RoundStatus = "aberto" | "lista_fechada" | "times_confirmados" | "finalizado";

export type RoundTeamsState = {
  roundId: string;
  roundName: string;
  status: RoundStatus;
  goalkeepers: RoundParticipant[];
  fieldPlayers: RoundParticipant[];
  teams: DrawTeam[];
  confirmed: boolean;
};

type RachaRow = {
  id: string;
  nome: string | null;
  data: string | null;
  estado: RoundStatus;
};

type ParticipantRow = {
  id: string;
  jogador_id: string | null;
  nome: string;
  tipo: RoundParticipant["type"];
  status: RoundParticipant["status"];
  profiles?: { avatar_url: string | null } | null;
};

type TeamRow = {
  id: string;
  nome: string;
  numero: number;
  confirmado: boolean;
  time_jogadores: Array<{
    jogador_id: string;
    participante_id: string | null;
    profiles?: { name: string | null; avatar_url: string | null } | null;
    racha_participantes?: { nome: string | null } | null;
  }>;
};

export async function getCurrentRoundTeamsState(supabase: SupabaseClient): Promise<RoundTeamsState | null> {
  const { data: round, error: roundError } = await supabase
    .from("rachas")
    .select("id, nome, data, estado")
    .order("data", { ascending: false })
    .limit(1)
    .maybeSingle<RachaRow>();

  if (roundError) {
    throw roundError;
  }

  if (!round) {
    return null;
  }

  const { data: participants, error: participantsError } = await supabase
    .from("racha_participantes")
    .select("id, jogador_id, nome, tipo, status, profiles(avatar_url)")
    .eq("racha_id", round.id)
    .order("created_at", { ascending: true })
    .returns<ParticipantRow[]>();

  if (participantsError) {
    throw participantsError;
  }

  const { data: teams, error: teamsError } = await supabase
    .from("times")
    .select(
      "id, nome, numero, confirmado, time_jogadores(jogador_id, participante_id, profiles(name, avatar_url), racha_participantes(nome))",
    )
    .eq("racha_id", round.id)
    .order("numero", { ascending: true })
    .returns<TeamRow[]>();

  if (teamsError) {
    throw teamsError;
  }

  const normalizedParticipants = (participants ?? []).map(normalizeParticipant);
  const normalizedTeams = (teams ?? []).map((team) => ({
    id: team.id,
    name: team.nome,
    number: team.numero,
    players: team.time_jogadores.map((player) => ({
      id: player.participante_id ?? player.jogador_id,
      jogadorId: player.jogador_id,
      name: player.racha_participantes?.nome ?? player.profiles?.name ?? "Jogador",
      avatarUrl: player.profiles?.avatar_url ?? null,
    })),
  }));

  return {
    roundId: round.id,
    roundName: round.nome ?? "Racha atual",
    status: round.estado,
    goalkeepers: normalizedParticipants.filter((participant) => participant.type === "goleiro" && participant.status === "confirmado"),
    fieldPlayers: normalizedParticipants.filter((participant) => participant.type === "linha" && participant.status === "confirmado"),
    teams: normalizedTeams,
    confirmed: Boolean(teams?.some((team) => team.confirmado)),
  };
}

export async function saveDraftTeams(supabase: SupabaseClient, roundId: string, teams: DrawTeam[]) {
  const allPlayers = teams.flatMap((team) => team.players);
  const missingPlayer = allPlayers.find((player) => !player.jogadorId);

  if (missingPlayer) {
    throw new Error("Cadastre os jogadores da rodada no Supabase antes de salvar o sorteio.");
  }

  const { error: deleteError } = await supabase.from("times").delete().eq("racha_id", roundId);

  if (deleteError) {
    throw deleteError;
  }

  try {
    for (const team of teams) {
      const { data: createdTeam, error: teamError } = await supabase
        .from("times")
        .insert({
          racha_id: roundId,
          nome: team.name,
          numero: team.number,
          confirmado: false,
        })
        .select("id")
        .single<{ id: string }>();

      if (teamError || !createdTeam) {
        throw teamError ?? new Error("Nao foi possivel criar o time.");
      }

      const rows = team.players.map((player) => ({
        time_id: createdTeam.id,
        jogador_id: player.jogadorId,
        participante_id: player.id,
      }));

      const { error: playersError } = rows.length
        ? await supabase.from("time_jogadores").insert(rows)
        : { error: null };

      if (playersError) {
        throw playersError;
      }
    }
  } catch (error) {
    await supabase.from("times").delete().eq("racha_id", roundId);
    throw error;
  }
}

export async function confirmTeams(supabase: SupabaseClient, roundId: string) {
  const { data: existingTeams, error: existingTeamsError } = await supabase
    .from("times")
    .select("id")
    .eq("racha_id", roundId)
    .returns<Array<{ id: string }>>();

  if (existingTeamsError) {
    throw existingTeamsError;
  }

  if (!existingTeams?.length) {
    throw new Error("Sorteie os times antes de confirmar.");
  }

  const { error: teamsError } = await supabase
    .from("times")
    .update({ confirmado: true })
    .eq("racha_id", roundId);

  if (teamsError) {
    throw teamsError;
  }

  const { error: roundError } = await supabase
    .from("rachas")
    .update({ estado: "times_confirmados" })
    .eq("id", roundId);

  if (roundError) {
    throw roundError;
  }
}

export async function updateRoundStatus(supabase: SupabaseClient, roundId: string, status: RoundStatus) {
  const { error } = await supabase.from("rachas").update({ estado: status }).eq("id", roundId);

  if (error) {
    throw error;
  }
}

function normalizeParticipant(row: ParticipantRow): RoundParticipant {
  return {
    id: row.id,
    jogadorId: row.jogador_id,
    name: row.nome,
    avatarUrl: row.profiles?.avatar_url ?? null,
    type: row.tipo,
    status: row.status,
  };
}

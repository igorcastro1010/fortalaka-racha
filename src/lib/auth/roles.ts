export type UserRole = "organizador" | "jogador";

export type Profile = {
  id: string;
  name: string;
  email: string | null;
  avatar_url?: string | null;
  role: UserRole;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export function isOrganizer(profile: Pick<Profile, "role"> | null | undefined) {
  return profile?.role === "organizador";
}

export function getRoleLabel(role: UserRole) {
  return role === "organizador" ? "Organizador" : "Jogador";
}

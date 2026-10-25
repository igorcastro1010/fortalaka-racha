"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { getPublicPlayer, type PublicPlayer } from "@/lib/players/public-profile";
import { isOrganizer, type Profile } from "@/lib/auth/roles";
import { PlayerPerformance } from "./PlayerPerformance";
import { EmptyState, LoadingCards } from "@/components/ui/ScreenState";

export function PublicPlayerProfile({ playerId, viewer, onBack }: { playerId: string; viewer: Profile; onBack: () => void }) {
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const canReadAttributes = viewer.id === playerId || (isOrganizer(viewer) && viewer.active);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    let active = true;
    getPublicPlayer(playerId, canReadAttributes).then(data => {
      if (active) { setPlayer(data); setError(""); }
    }).catch(e => {
      console.error("Perfil público", e);
      if (active) setError("Não foi possível carregar este jogador. Tente novamente.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [playerId, canReadAttributes, revision]);

  return <section aria-label="Perfil público do jogador" className="space-y-5">
    <button onClick={onBack} className="fk-secondary"><ArrowLeft size={18} />Voltar</button>
    <h2 ref={title} tabIndex={-1}>Ficha do atleta</h2>
    {loading && <LoadingCards label="Carregando jogador..." />}
    {error && <div role="alert" className="space-y-3 text-sm text-red-700"><p>{error}</p><button className="fk-secondary" onClick={() => { setLoading(true); setError(""); setRevision(value => value + 1); }}>Tentar novamente</button></div>}
    {!loading && !error && !player && <EmptyState title="Jogador não encontrado." description="Este jogador não está disponível para consulta." />}
    {!loading && !error && player && <>
      <PlayerPerformance profile={{ id: playerId, name: player.nome, avatar_url: player.avatar_url, role: "jogador", active: true, email: null }} publicData={player} view="all" />
    </>}
  </section>;
}

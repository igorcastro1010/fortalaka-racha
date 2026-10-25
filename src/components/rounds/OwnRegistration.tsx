"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useConfirmation } from "@/components/ui/useConfirmation";
import type { Profile } from "@/lib/auth/roles";
import { setOwnRegistration, type RoundDetails } from "@/lib/rounds/repository";

export function OwnRegistration({ round, profile, onUpdated, compact = false }: { round: RoundDetails; profile: Profile; onUpdated: () => void | Promise<void>; compact?: boolean }) {
  const registration = round.participants.find(player => player.jogadorId === profile.id && player.status === "confirmado");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canChange = round.status === "aberto" && profile.active;
  const { confirm, confirmationDialog } = useConfirmation();

  async function submit(join: boolean) {
    if (!canChange || submitting.current) return;
    if (!join && !await confirm({ title: "Sair da lista?", description: "Você será retirado da lista desta rodada. Enquanto a lista estiver aberta, poderá entrar novamente." })) return;
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      await setOwnRegistration(round.roundId, join);
      await onUpdated();
      setMessage(join ? "Você entrou na lista ✓" : "Você saiu da lista");
    } catch {
      setError(join ? "Não foi possível entrar na lista. Tente novamente." : "Não foi possível sair da lista. Tente novamente.");
    } finally { submitting.current = false; setBusy(false); }
  }

  return <section aria-busy={busy} className={compact ? "space-y-3 border-t border-zinc-200 pt-4" : "fk-section space-y-3"}>
    {confirmationDialog}
    {!compact && <h3 className="text-xs font-bold text-zinc-500">Sua inscrição</h3>}
    <p className="flex items-center gap-2 text-xs font-black text-neutral-950">{registration && <CheckCircle2 size={17} aria-hidden="true" />}{registration ? "VOCÊ ESTÁ NA LISTA" : "Você ainda não está na lista."}</p>
    {message && <p role="status" className="text-xs font-bold text-zinc-700">{message}</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {canChange ? registration ? <button disabled={busy} onClick={() => submit(false)} className="fk-secondary w-full">{busy ? "SAINDO..." : "SAIR DA LISTA"}</button> : <button disabled={busy} onClick={() => submit(true)} className="fk-primary w-full">{busy ? "ENTRANDO..." : "ENTRAR NA LISTA"}</button> : <p className="text-sm text-zinc-600">{round.status === "finalizado" ? "Racha finalizado. Inscrições preservadas." : "Lista fechada para inscrições e saídas."}</p>}
  </section>;
}

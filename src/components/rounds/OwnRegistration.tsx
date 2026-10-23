"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import type { Profile } from "@/lib/auth/roles";
import { setOwnRegistration, type RoundDetails } from "@/lib/rounds/repository";

export function OwnRegistration({ round, profile, onUpdated, compact = false }: { round: RoundDetails; profile: Profile; onUpdated: () => void | Promise<void>; compact?: boolean }) {
  const registration = round.participants.find(player => player.jogadorId === profile.id && player.status === "confirmado");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const canChange = round.status === "aberto" && profile.active;

  async function submit(join: boolean) {
    if (!canChange || submitting.current) return;
    if (!join && !window.confirm("Sair da lista desta rodada?")) return;
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

  return <section aria-busy={busy} className={compact ? "space-y-2 border-t border-zinc-100 pt-3" : "space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]"}>
    {!compact && <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">Sua inscrição</h3>}
    <p className="flex items-center gap-2 text-xs font-black text-neutral-950">{registration && <CheckCircle2 size={17} aria-hidden="true" />}{registration ? "VOCÊ ESTÁ NA LISTA" : "Você ainda não está na lista."}</p>
    {message && <p role="status" className="text-xs font-bold text-zinc-700">{message}</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {canChange ? registration ? <button disabled={busy} onClick={() => submit(false)} className="min-h-12 w-full rounded-2xl border border-zinc-200 bg-white text-xs font-black uppercase tracking-wide text-neutral-950 shadow-sm transition active:scale-95 disabled:opacity-50">{busy ? "SAINDO..." : "SAIR DA LISTA"}</button> : <button disabled={busy} onClick={() => submit(true)} className="min-h-12 w-full rounded-2xl bg-red-600 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-red-600/20 transition active:scale-95 disabled:opacity-50">{busy ? "ENTRANDO..." : "ENTRAR NA LISTA"}</button> : <p className="text-xs text-zinc-500">{round.status === "finalizado" ? "Racha finalizado. Inscrições preservadas." : "Lista fechada para inscrições e saídas."}</p>}
  </section>;
}

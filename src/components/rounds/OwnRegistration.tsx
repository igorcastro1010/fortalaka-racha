"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useConfirmation } from "@/components/ui/useConfirmation";
import type { Profile } from "@/lib/auth/roles";
import { setOwnRegistration, type RoundDetails } from "@/lib/rounds/repository";
import { changePaymentMethod } from "@/lib/payments/repository";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/payments/summary";
import { PaymentChoice, PixCard } from "./PaymentChoice";

export function OwnRegistration({ round, profile, onUpdated, compact = false }: { round: RoundDetails; profile: Profile; onUpdated: () => void | Promise<void>; compact?: boolean }) {
  const registration = round.participants.find(player => player.jogadorId === profile.id && player.status === "confirmado");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [choice, setChoice] = useState<PaymentMethod | null>(null);
  const paymentsAvailable = round.paymentsAvailable !== false;
  const method = (round.status === "aberto" ? choice : null) ?? registration?.paymentMethod ?? null;
  const canChange = round.status === "aberto" && profile.active;
  const { confirm, confirmationDialog } = useConfirmation();

  async function submit(join: boolean) {
    if (!canChange || submitting.current) return;
    if (!join && !await confirm({ title: "Sair da lista?", description: "Você será retirado da lista desta rodada. Enquanto a lista estiver aberta, poderá entrar novamente." })) return;
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      await setOwnRegistration(round.roundId, join, method, paymentsAvailable);
      await onUpdated();
      setChoice(null);
      setMessage(join ? "Você entrou na lista ✓" : "Você saiu da lista");
    } catch {
      setError(join ? "Não foi possível entrar na lista. Tente novamente." : "Não foi possível sair da lista. Tente novamente.");
    } finally { submitting.current = false; setBusy(false); }
  }

  async function saveMethod() {
    if (!canChange || !registration || !method || submitting.current) return;
    submitting.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      await changePaymentMethod(registration.id, method);
      await onUpdated();
      setChoice(null);
      setMessage("Forma de pagamento atualizada.");
    } catch { setError("Não foi possível alterar a forma de pagamento. Tente novamente."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <section aria-busy={busy} className={compact ? "space-y-3 border-t border-zinc-200 pt-4" : "fk-section space-y-3"}>
    {confirmationDialog}
    {!compact && <h3 className="text-xs font-bold text-zinc-500">Sua inscrição</h3>}
    <p className="flex items-center gap-2 text-xs font-black text-neutral-950">{registration && <CheckCircle2 size={17} aria-hidden="true" />}{registration ? "VOCÊ ESTÁ NA LISTA" : "Você ainda não está na lista."}</p>
    {!registration && canChange && <p className="text-sm text-zinc-600">Sua entrada na lista só será confirmada após selecionar uma forma de pagamento.</p>}
    {registration && <p className="text-sm text-zinc-700">{paymentMethodLabel(registration.paymentMethod)} · {registration.paymentStatus === "recebido" ? "Recebido" : "Pendente"}</p>}
    {!paymentsAvailable && <p role="status" className="text-sm text-zinc-600">Pagamentos temporariamente indisponíveis. Tente novamente mais tarde.</p>}
    {canChange && paymentsAvailable && <PaymentChoice value={method} onChange={setChoice} disabled={busy} />}
    {method === "pix" && <PixCard />}
    {canChange && registration && method !== registration.paymentMethod && method && <button disabled={busy} onClick={saveMethod} className="fk-primary w-full">{busy ? "SALVANDO..." : "SALVAR FORMA DE PAGAMENTO"}</button>}
    {message && <p role="status" className="text-xs font-bold text-zinc-700">{message}</p>}
    {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
    {canChange ? registration ? <button disabled={busy} onClick={() => submit(false)} className="fk-secondary w-full">{busy ? "AGUARDE..." : "SAIR DA LISTA"}</button> : <button disabled={busy || !method || !paymentsAvailable} onClick={() => submit(true)} className="fk-primary w-full">{busy ? "ENTRANDO..." : "ENTRAR NA LISTA"}</button> : <p className="text-sm text-zinc-600">{round.status === "finalizado" ? "Racha finalizado. Inscrições preservadas." : "Lista fechada para inscrições e saídas."}</p>}
  </section>;
}

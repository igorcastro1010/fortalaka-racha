"use client";

import { Save } from "lucide-react";
import { useRef, useState } from "react";
import { PlayerIdentity } from "@/components/players/PlayerIdentity";
import { updatePayment } from "@/lib/payments/repository";
import { buildFinancialSummary, money, parseAmount, paymentMethodLabel, type PaymentStatus } from "@/lib/payments/summary";
import type { RoundParticipant } from "@/lib/teams/repository";

export function RoundFinance({ participants, onUpdated }: { participants: RoundParticipant[]; onUpdated: () => void | Promise<void> }) {
  const summary = buildFinancialSummary(participants);
  const visible = participants;
  return <section aria-label="Financeiro da rodada" className="fk-section space-y-4">
    <h3 className="text-lg font-black">Financeiro da rodada</h3>
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <div><dt className="text-sm text-zinc-600">Recebidos</dt><dd className="text-xl font-black tabular-nums">{summary.received}</dd></div>
      <div><dt className="text-sm text-zinc-600">Pendentes</dt><dd className="text-xl font-black tabular-nums">{summary.pending}</dd></div>
      <div className="col-span-2 border-t border-zinc-200 pt-3"><dt className="text-sm text-zinc-600">Total arrecadado</dt><dd className="text-2xl font-black tabular-nums">{money(summary.collectedCents)}</dd></div>
      <div className="col-span-2"><dt className="text-xs text-zinc-600">Valor pendente cadastrado</dt><dd className="text-sm font-bold tabular-nums">{money(summary.pendingCents)}</dd></div>
    </dl>
    {summary.withoutAmount > 0 && <p className="text-sm text-zinc-600">{summary.withoutAmount} {summary.withoutAmount === 1 ? "inscrição sem valor informado" : "inscrições sem valor informado"}.</p>}
    <div className="divide-y divide-zinc-200">{visible.map(player => <PaymentEditor key={player.id} participant={player} onUpdated={onUpdated} />)}</div>
    {!visible.length && <p className="text-sm text-zinc-600">Nenhum pagamento para conferir nesta rodada.</p>}
  </section>;
}

function PaymentEditor({ participant, onUpdated }: { participant: RoundParticipant; onUpdated: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <details className="min-w-0 py-3" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary className="min-h-11 cursor-pointer text-sm font-bold">
      <span className="ml-1 break-words">{participant.name}</span>
      <span className={`ml-2 text-xs ${participant.paymentStatus === "recebido" ? "text-emerald-700" : "text-zinc-600"}`}>{participant.paymentStatus === "recebido" ? "Recebido" : "Pendente"}</span>
      {participant.status !== "confirmado" && <span className="ml-2 text-xs text-zinc-600">Fora da lista</span>}
    </summary>
    {open && <PaymentFields participant={participant} onUpdated={onUpdated} />}
  </details>;
}

function PaymentFields({ participant, onUpdated }: { participant: RoundParticipant; onUpdated: () => void | Promise<void> }) {
  const [amount, setAmount] = useState(participant.paymentAmount == null ? "" : String(participant.paymentAmount).replace(".", ","));
  const [status, setStatus] = useState<PaymentStatus>(participant.paymentStatus ?? "pendente");
  const [source, setSource] = useState({ status: participant.paymentStatus ?? "pendente", amount: participant.paymentAmount ?? null });
  const changedExternally = source.status !== (participant.paymentStatus ?? "pendente") || source.amount !== (participant.paymentAmount ?? null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || changedExternally) return;
    setError(""); setMessage("");
    let value: number | null;
    try {
      value = parseAmount(amount);
      if (status === "recebido" && value === null) throw new Error("Informe o valor recebido antes de confirmar o pagamento.");
    } catch (e) { setError(e instanceof Error ? e.message : "Confira o valor informado."); return; }
    submitting.current = true; setBusy(true);
    try {
      await updatePayment(participant.id, status, value);
      setSource({ status, amount: value });
      await onUpdated();
      setMessage("Pagamento atualizado.");
    } catch { setError("Não foi possível salvar o pagamento. Confira o valor e tente novamente."); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <form onSubmit={save} aria-label={`Pagamento de ${participant.name}`} aria-busy={busy} className="mt-3 space-y-3">
      <PlayerIdentity playerId={participant.jogadorId} name={participant.name} avatarUrl={participant.avatarUrl} size="md" className="text-sm" />
      <p className="text-sm text-zinc-600">{paymentMethodLabel(participant.paymentMethod)}{participant.status !== "confirmado" ? " · Fora da lista" : ""}</p>
      <label className="block text-sm font-bold">Valor (R$)<input className="fk-field mt-1" inputMode="decimal" autoComplete="off" value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} placeholder="Não informado" /></label>
      <label className="block text-sm font-bold">Status financeiro<select className="fk-field mt-1" value={status} disabled={busy} onChange={event => setStatus(event.target.value as PaymentStatus)}><option value="pendente">Pendente</option><option value="recebido">Recebido</option></select></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm font-bold">{message}</p>}
      {changedExternally && !busy && <p role="alert" className="text-sm text-red-700">Este pagamento mudou. Feche e reabra os detalhes para conferir os dados antes de salvar.</p>}
      <button className="fk-primary w-full" disabled={busy || changedExternally}><Save size={18} aria-hidden="true" />{busy ? "Salvando..." : "Salvar pagamento"}</button>
    </form>;
}

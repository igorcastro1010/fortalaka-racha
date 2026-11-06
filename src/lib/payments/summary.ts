export type PaymentMethod = "pix" | "dinheiro";
export type PaymentStatus = "pendente" | "recebido";

type FinancialParticipant = {
  status: string;
  paymentStatus?: PaymentStatus;
  paymentAmount?: number | null;
};

export function buildFinancialSummary(participants: FinancialParticipant[]) {
  const result = { received: 0, pending: 0, collectedCents: 0, pendingCents: 0, withoutAmount: 0 };
  for (const participant of participants) {
    const value = participant.paymentAmount;
    const hasAmount = value != null && Number.isFinite(value) && value >= 0;
    const cents = hasAmount ? Math.round(value * 100) : 0;
    if (participant.paymentStatus === "recebido" && hasAmount) {
      result.received++;
      result.collectedCents += cents;
    } else if (participant.status === "confirmado") {
      result.pending++;
      result.pendingCents += cents;
      if (!hasAmount) result.withoutAmount++;
    }
  }
  return result;
}

export function parseAmount(input: string): number | null {
  const value = input.trim().replace(",", ".");
  if (!value) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) > 99999999.99) {
    throw new Error("Informe um valor válido em reais, com até duas casas decimais.");
  }
  return Number(value);
}

export function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export function paymentMethodLabel(method?: PaymentMethod | null) {
  return method === "pix" ? "PIX" : method === "dinheiro" ? "Dinheiro" : "Forma não informada";
}

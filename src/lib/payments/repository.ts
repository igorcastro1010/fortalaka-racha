import { createClient } from "@/lib/supabase/client";
import type { PaymentMethod, PaymentStatus } from "./summary";

export type PixSettings = { chave_pix: string; titular: string; banco: string };

// Never log database payloads here: validation errors may contain PIX personal data.
export async function getPixSettings(): Promise<PixSettings> {
  const { data, error } = await createClient().from("configuracoes_pagamento")
    .select("chave_pix, titular, banco").eq("id", true).single<PixSettings>();
  if (error || !data) throw new Error("Não foi possível carregar os dados PIX. Tente novamente.");
  return data;
}

export async function savePixSettings(input: PixSettings) {
  const { data, error } = await createClient().from("configuracoes_pagamento")
    .update(input).eq("id", true).select("id").single();
  if (error || !data) throw new Error("Não foi possível salvar os dados PIX. Confira os campos e tente novamente.");
}

export async function changePaymentMethod(participantId: string, method: PaymentMethod) {
  const { error } = await createClient().rpc("alterar_forma_pagamento", { p_participante: participantId, p_forma_pagamento: method });
  if (error) throw new Error("Não foi possível alterar a forma de pagamento. Confira se a lista está aberta.");
}

export class PaymentConflictError extends Error {
  constructor() { super('Este pagamento mudou. Atualize os dados antes de confirmar.'); }
}

export async function updatePayment(participantId: string, status: PaymentStatus, amount: number | null, expected?: { status: PaymentStatus; amount: number | null }) {
  if (expected) {
    // Preflight fora do cache. Não confirmar a edição usando apenas o snapshot
    // exibido; a RPC ainda verifica autorização e validade no banco.
    const { data, error } = await createClient().from('racha_participantes')
      .select('status_pagamento,valor_pagamento').eq('id', participantId).maybeSingle();
    if (error || !data) throw new Error('Não foi possível conferir o pagamento agora.');
    if (data.status_pagamento !== expected.status || (data.valor_pagamento == null ? null : Number(data.valor_pagamento)) !== expected.amount) throw new PaymentConflictError();
  }
  const { error } = await createClient().rpc("atualizar_pagamento", { p_participante: participantId, p_status: status, p_valor: amount });
  if (error) throw new Error("Não foi possível salvar o pagamento. Confira o valor e tente novamente.");
}

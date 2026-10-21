import { Check } from "lucide-react";
import type { RoundDetails } from "@/lib/rounds/repository";

// Apresentação do estado persistido: não avança nem altera a rodada.
export function RoundProgress({ status }: { status: RoundDetails["status"] }) {
  const current = { aberto: 0, lista_fechada: 1, times_confirmados: 2, em_andamento: 2, finalizado: 3 }[status];
  return <ol aria-label="Etapas da rodada" className="grid grid-cols-4 gap-1 rounded-2xl bg-white p-3 ring-1 ring-black/5">
    {["Lista", "Times", "Racha", "Avaliação"].map((label, index) => <li key={label} aria-current={index === current ? "step" : undefined} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${index < current ? "bg-neutral-950 text-white" : index === current ? "bg-red-600 text-white" : "bg-zinc-100 text-zinc-500"}`}>{index < current ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
      <span className={`text-[10px] font-bold ${index <= current ? "text-neutral-950" : "text-zinc-500"}`}>{label}</span>
      <span className="sr-only">{index < current ? "Concluído" : index === current ? "Etapa atual" : "Próxima etapa"}</span>
    </li>)}
  </ol>;
}

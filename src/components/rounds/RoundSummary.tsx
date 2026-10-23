import type { RoundDetails } from "@/lib/rounds/repository";
import { LoadingCards, EmptyState } from "@/components/ui/ScreenState";

const labels = {
  aberto: "Rodada aberta",
  lista_fechada: "Lista fechada",
  times_confirmados: "Times confirmados",
  em_andamento: "Racha em andamento",
  finalizado: "RODADA FINALIZADA",
};

export function RoundSummary({ round }: { round: RoundDetails }) {
  return <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/[0.03]">
    <p className="text-[10px] font-black uppercase tracking-wide text-red-600">Rodada atual</p>
    <h3 className="mt-1 break-words text-xl font-black tracking-tight">{round.roundName}</h3>
    <p className="mt-2 inline-flex rounded-full bg-neutral-950 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">{labels[round.status]}</p>
    <p className="mt-2 text-xs font-bold text-zinc-500">{round.date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${round.date}T12:00:00Z`)) : "Data não informada"} · {round.time?.slice(0, 5) ?? "Horário não informado"}</p>
    {round.address && <p className="mt-1 break-words text-sm text-zinc-600">{round.address}</p>}
  </div>;
}

export function RoundLoadStatus({ loading, error, empty, retry }: { loading: boolean; error: string; empty: boolean; retry: () => void }) {
  if (loading) return <LoadingCards label="Carregando rodada..." />;
  if (error) return <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 ring-1 ring-red-100"><p>{error}</p><button onClick={retry} className="mt-2 min-h-11 underline">Tentar novamente</button></div>;
  if (empty) return <EmptyState title="O próximo racha vem aí" description="Quando a rodada estiver disponível, os detalhes aparecem aqui. Confira a aba Racha." />;
  return null;
}

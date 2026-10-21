import { CircleDashed, type LucideIcon } from "lucide-react";

export function EmptyState({ title, description, icon: Icon = CircleDashed }: { title: string; description: string; icon?: LucideIcon }) {
  return <div className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 ring-1 ring-zinc-200"><Icon size={20} aria-hidden="true" /></span>
    <div className="min-w-0"><p className="text-sm font-black text-neutral-950">{title}</p><p className="mt-1 text-xs leading-relaxed text-zinc-600">{description}</p></div>
  </div>;
}

export function LoadingCards({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="rounded-[20px] bg-white p-4 ring-1 ring-black/5">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse"><div className="h-3 w-1/3 rounded bg-zinc-200" /><div className="h-7 w-2/3 rounded bg-zinc-100" /><div className="h-3 w-full rounded bg-zinc-100" /></div>
  </div>;
}

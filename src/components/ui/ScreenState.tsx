import { CircleDashed, type LucideIcon } from "lucide-react";

export function EmptyState({ title, description, icon: Icon = CircleDashed }: { title: string; description: string; icon?: LucideIcon }) {
  return <div className="flex items-start gap-3 py-6">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-zinc-500"><Icon size={24} aria-hidden="true" /></span>
    <div className="min-w-0"><p className="text-base font-bold text-neutral-950">{title}</p><p className="mt-1 text-sm leading-relaxed text-zinc-600">{description}</p></div>
  </div>;
}

export function LoadingCards({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="py-6">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="space-y-3 motion-safe:animate-pulse"><div className="h-3 w-1/3 rounded bg-zinc-200" /><div className="h-7 w-2/3 rounded bg-zinc-100" /><div className="h-3 w-full rounded bg-zinc-100" /></div>
  </div>;
}

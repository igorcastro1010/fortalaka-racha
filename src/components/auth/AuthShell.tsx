import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/LogoMark";

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-white text-neutral-950">
      <div className="fk-auth mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white text-neutral-950">
        <header className="fk-auth-brand flex w-full shrink-0 flex-col items-center bg-neutral-900 px-6 pt-[max(24px,env(safe-area-inset-top))] pb-6 text-center text-white">
          <LogoMark size="profile" priority />
          <p className="mt-4 text-2xl font-black uppercase leading-tight tracking-normal">
            Racha <span className="text-red-500">Fortalaka</span>
          </p>
          <h1 className="mt-2 text-lg font-bold leading-snug">{title}</h1>
        </header>
        <div className="w-full min-w-0 bg-white px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] text-left text-neutral-950">{children}</div>
      </div>
    </main>
  );
}

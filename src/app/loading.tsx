import { LogoMark } from "@/components/brand/LogoMark";

export default function Loading() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center justify-center bg-[linear-gradient(160deg,#111_0%,#18181b_54%,#050505_100%)] px-5">
        <LogoMark size="loading" priority />
        <p className="mt-5 text-sm font-black uppercase tracking-[0.2em] text-red-300">
          Racha Fortalaka
        </p>
      </div>
    </main>
  );
}

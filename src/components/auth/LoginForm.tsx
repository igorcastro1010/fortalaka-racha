"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/roles";

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.user) {
        setError("E-mail ou senha invalidos.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, name, email, role, active")
        .eq("id", data.user.id)
        .maybeSingle<Profile>();

      if (!profile?.active) {
        await supabase.auth.signOut();
        setError("Seu acesso esta desativado. Procure um dos organizadores.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Nao foi possivel entrar agora. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError("");
    setMessage("");

    if (!email) {
      setError("Informe seu e-mail para receber o link de recuperacao.");
      return;
    }

    setIsSendingReset(true);

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        setError("Nao foi possivel enviar o link de recuperacao. Confira o e-mail e tente novamente.");
        return;
      }

      setMessage("Enviamos um link de recuperacao para o seu e-mail.");
    } catch {
      setError("Nao foi possivel enviar o link de recuperacao agora.");
    } finally {
      setIsSendingReset(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center bg-[linear-gradient(160deg,#111_0%,#18181b_54%,#050505_100%)] px-5 py-[calc(24px+env(safe-area-inset-top))] pb-[calc(18px+env(safe-area-inset-bottom))]">
        <div className="flex w-full flex-col items-center">
          <section className="flex w-full flex-col items-center text-center">
            <LogoMark size="login" priority />
            <h1 className="mt-6 text-[44px] font-black uppercase leading-[0.92] tracking-normal">
              Racha Fortalaka
            </h1>
            <div className="mt-5 h-1.5 w-24 rounded-full bg-red-600" />
          </section>

          <form onSubmit={handleLogin} className="mt-10 w-full rounded-[24px] bg-white p-4 text-left text-neutral-950 shadow-xl shadow-black/25">
            <label className="text-sm font-bold" htmlFor="email">
              E-mail
            </label>
            <input
              className="mt-2 h-[52px] w-full rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 text-base font-semibold outline-none transition focus:border-red-500 focus:bg-white focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-70"
              id="email"
              name="email"
              autoComplete="username"
              type="email"
              placeholder="voce@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
              required
            />
            <label className="mt-4 block text-sm font-bold" htmlFor="password">
              Senha
            </label>
            <div className="mt-2 flex h-[52px] items-center gap-3 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100">
              <Lock className="text-zinc-400" size={19} />
              <input
                className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-70"
                id="password"
                name="password"
                autoComplete="current-password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>

            {error ? (
              <p className="mt-4 rounded-[16px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {error}
              </p>
            ) : null}

            {message ? (
              <p className="mt-4 rounded-[16px] bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                {message}
              </p>
            ) : null}

            <button
              className="mt-5 h-[52px] w-full rounded-[18px] bg-red-600 text-base font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:active:scale-100"
              disabled={isLoading || isSendingReset}
            >
              {isLoading ? "Entrando..." : "Entrar"}
            </button>

            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={isLoading || isSendingReset}
              className="mt-4 min-h-11 w-full text-center text-sm font-black text-neutral-700 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSendingReset ? "Enviando..." : "Esqueci minha senha"}
            </button>

            <p className="mt-5 text-center text-sm font-bold text-zinc-600">
              Nao tem uma conta?{" "}
              <Link className="font-black text-red-600 transition hover:text-red-700" href="/cadastro">
                Criar conta
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

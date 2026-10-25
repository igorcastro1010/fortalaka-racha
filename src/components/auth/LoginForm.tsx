"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell title="Entre para o racha">
    <form onSubmit={handleLogin} className="w-full" aria-busy={isLoading || isSendingReset}>
      <label className="text-sm font-bold" htmlFor="email">
        E-mail
      </label>
      <input
        className="fk-field mt-2 h-12! min-h-12! w-full rounded-md border border-neutral-400 bg-white px-3 py-0! text-base text-neutral-950 outline-none placeholder:text-neutral-500 focus:border-red-500 focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-70"
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
      <div className="fk-field mt-2 flex h-12! min-h-12! items-center gap-3 rounded-md border border-neutral-400 bg-white px-3 py-0! focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500">
        <Lock className="shrink-0 text-neutral-500" size={18} aria-hidden="true" />
        <input
          className="h-full min-w-0 flex-1 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-70"
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
        <p role="alert" className="mt-4 border-l-2 border-red-500 pl-3 text-sm leading-relaxed text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p role="status" className="mt-4 border-l-2 border-emerald-500 pl-3 text-sm leading-relaxed text-emerald-700">
          {message}
        </p>
      ) : null}

      <button
        className="fk-primary mt-6 min-h-11 w-full rounded-md bg-red-600 px-4 py-3 text-sm font-bold tracking-normal text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isLoading || isSendingReset}
      >
        {isLoading ? "Entrando..." : "Entrar"}
      </button>

      <button
        type="button"
        onClick={handlePasswordReset}
        disabled={isLoading || isSendingReset}
        className="fk-secondary mt-2 min-h-11 w-full rounded-md px-3 py-2 text-center text-sm font-semibold text-neutral-700 hover:text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSendingReset ? "Enviando..." : "Esqueci minha senha"}
      </button>

      <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1 border-t border-neutral-200 pt-3 text-center text-sm text-neutral-600">
        Nao tem uma conta?{" "}
        <Link className="inline-flex min-h-11 items-center rounded-sm px-1 font-bold text-neutral-950 underline decoration-red-500 underline-offset-4 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500" href="/cadastro">
          Criar conta
        </Link>
      </p>
    </form>
    </AuthShell>
  );
}

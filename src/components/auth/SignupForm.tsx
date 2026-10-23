"use client";

import { Lock, Mail, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { createClient } from "@/lib/supabase/client";

export function SignupForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState(initialError ?? "");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  function validateForm() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      return "Informe seu nome com pelo menos 2 caracteres.";
    }

    if (!trimmedEmail) {
      return "Informe seu e-mail.";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return "Informe um e-mail valido.";
    }

    if (password.length < 6) {
      return "A senha precisa ter pelo menos 6 caracteres.";
    }

    if (!confirmPassword) {
      return "Confirme sua senha.";
    }

    if (password !== confirmPassword) {
      return "As senhas nao conferem.";
    }

    return "";
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (signupError) {
        const messageText = signupError.message.toLowerCase();

        if (messageText.includes("already") || messageText.includes("registered") || messageText.includes("exists")) {
          setError("Ja existe uma conta com este e-mail.");
          return;
        }

        setError("Nao foi possivel criar a conta. Confira os dados e tente novamente.");
        return;
      }

      if (data.session) {
        router.replace("/");
        router.refresh();
        return;
      }

      setMessage("Conta criada! Verifique seu e-mail para confirmar seu cadastro.");
    } catch {
      setError("Nao foi possivel criar a conta agora.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center bg-[linear-gradient(160deg,#111_0%,#18181b_54%,#050505_100%)] px-5 py-[calc(24px+env(safe-area-inset-top))] pb-[calc(18px+env(safe-area-inset-bottom))]">
        <div className="flex w-full flex-col items-center">
          <section className="flex w-full flex-col items-center text-center">
            <LogoMark size="login" priority />
            <h1 className="mt-6 text-[40px] font-black uppercase leading-[0.9] tracking-tighter">
              Racha Fortalaka
            </h1>
            <div className="mt-5 h-1 w-12 rounded-full bg-red-600" />
          </section>

          <div className="mt-10 w-full rounded-[28px] bg-white p-6 text-left text-neutral-950 shadow-sm ring-1 ring-black/[0.03]">
            {message ? (
              <div>
                <p className="rounded-[16px] bg-emerald-50 px-3 py-3 text-sm font-black uppercase tracking-wider text-zinc-500 text-emerald-700">
                  {message}
                </p>
                <Link
                  href="/login"
                  className="mt-5 flex h-[52px] w-full items-center justify-center rounded-[20px] bg-red-600 text-base font-black uppercase tracking-wider text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
                >
                  Voltar para o login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSignup}>
                <label className="text-sm font-bold" htmlFor="signup-name">
                  Nome
                </label>
                <TextInput
                  id="signup-name"
                  autoComplete="name"
                  icon={User}
                  placeholder="Seu nome"
                  type="text"
                  value={name}
                  onChange={setName}
                  disabled={isLoading}
                />

                <label className="mt-4 block text-sm font-bold" htmlFor="signup-email">
                  E-mail
                </label>
                <TextInput
                  id="signup-email"
                  autoComplete="email"
                  icon={Mail}
                  placeholder="voce@email.com"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  disabled={isLoading}
                />

                <label className="mt-4 block text-sm font-bold" htmlFor="signup-password">
                  Senha
                </label>
                <TextInput
                  id="signup-password"
                  autoComplete="new-password"
                  icon={Lock}
                  placeholder="Digite sua senha"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  disabled={isLoading}
                />

                <label className="mt-4 block text-sm font-bold" htmlFor="signup-confirm-password">
                  Confirmar senha
                </label>
                <TextInput
                  id="signup-confirm-password"
                  autoComplete="new-password"
                  icon={Lock}
                  placeholder="Confirme sua senha"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  disabled={isLoading}
                />

                {error ? (
                  <p className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700 ring-1 ring-red-100">
                    {error}
                  </p>
                ) : null}

                <button
                  className="mt-5 h-[56px] w-full rounded-[20px] bg-red-600 text-base font-black uppercase tracking-wider text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:active:scale-100"
                  disabled={isLoading}
                >
                  {isLoading ? "Criando conta..." : "Criar conta"}
                </button>

                <p className="mt-5 text-center text-sm font-bold text-zinc-600">
                  Ja tenho uma conta{" "}
                  <Link className="font-black text-red-600 transition hover:text-red-700" href="/login">
                    Entrar
                  </Link>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function TextInput({
  id,
  autoComplete,
  icon: Icon,
  placeholder,
  type,
  value,
  onChange,
  disabled,
}: {
  id: string;
  autoComplete: string;
  icon: LucideIcon;
  placeholder: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="mt-2 flex h-[52px] items-center gap-3 rounded-[20px] border border-zinc-200 bg-zinc-50 px-4 transition focus-within:border-red-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100/50">
      <Icon className="text-zinc-400" size={19} />
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base font-bold outline-none disabled:cursor-not-allowed disabled:opacity-70"
        id={id}
        name={id}
        autoComplete={autoComplete}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      />
    </div>
  );
}

"use client";

import { Lock, Mail, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
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
    <AuthShell title="Crie sua conta">
      {message ? (
        <div>
          <p role="status" className="border-l-2 border-emerald-500 pl-3 text-sm leading-relaxed text-emerald-700">
            {message}
          </p>
          <Link
            href="/login"
            className="fk-primary mt-6 flex min-h-11 w-full items-center justify-center rounded-md bg-red-600 px-4 py-3 text-sm font-bold tracking-normal text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
          >
            Voltar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSignup} aria-busy={isLoading}>
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
            placeholder="Pelo menos 6 caracteres"
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
            <p role="alert" className="mt-4 border-l-2 border-red-500 pl-3 text-sm leading-relaxed text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="fk-primary mt-6 min-h-11 w-full rounded-md bg-red-600 px-4 py-3 text-sm font-bold tracking-normal text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Criando conta..." : "Criar conta"}
          </button>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1 border-t border-neutral-200 pt-3 text-center text-sm text-neutral-600">
            Ja tenho uma conta{" "}
            <Link className="inline-flex min-h-11 items-center rounded-sm px-1 font-bold text-neutral-950 underline decoration-red-500 underline-offset-4 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500" href="/login">
              Entrar
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
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
    <div className="fk-field mt-2 flex h-12! min-h-12! items-center gap-3 rounded-md border border-neutral-400 bg-white px-3 py-0! focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500">
      <Icon className="shrink-0 text-neutral-500" size={18} aria-hidden="true" />
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-70"
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

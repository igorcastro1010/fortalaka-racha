"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { createClient } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "invalid" | "success";

export function ResetPasswordForm() {
  const router = useRouter();
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const recoveryHint =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery") ||
      new URLSearchParams(window.location.search).has("code");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" && session) {
        setRecoveryState("ready");
      }
    });

    async function prepareRecoverySession() {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!isMounted) {
          return;
        }

        if (exchangeError) {
          setRecoveryState("invalid");
          return;
        }

        setRecoveryState("ready");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (session && recoveryHint) {
        setRecoveryState("ready");
        return;
      }

      timeoutId = setTimeout(() => {
        if (isMounted) {
          setRecoveryState("invalid");
        }
      }, 1200);
    }

    void prepareRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao conferem.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        setError("Nao foi possivel alterar a senha. Solicite um novo link.");
        return;
      }

      setRecoveryState("success");
      await supabase.auth.signOut();
      setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1400);
    } catch {
      setError("Nao foi possivel alterar a senha agora.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title="Redefina sua senha">
      {recoveryState === "checking" ? (
        <StatusBlock title="Validando link..." body="Aguarde um instante." />
      ) : null}

      {recoveryState === "invalid" ? (
        <div>
          <StatusBlock
            title="Link invalido"
            body="Este link de recuperacao e invalido ou expirou. Solicite um novo link."
            tone="error"
          />
          <button
            onClick={() => router.replace("/login")}
            className="fk-primary mt-6 min-h-11 w-full rounded-md bg-red-600 px-4 py-3 text-sm font-bold tracking-normal text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500"
          >
            Voltar para o login
          </button>
        </div>
      ) : null}

      {recoveryState === "success" ? (
        <StatusBlock title="Senha alterada" body="Senha alterada com sucesso." tone="success" />
      ) : null}

      {recoveryState === "ready" ? (
        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <label className="text-sm font-bold" htmlFor="new-password">
            Nova senha
          </label>
          <PasswordInput
            id="new-password"
            value={password}
            onChange={setPassword}
            disabled={isSubmitting}
            placeholder="Pelo menos 6 caracteres"
          />

          <label className="mt-4 block text-sm font-bold" htmlFor="confirm-password">
            Confirmar nova senha
          </label>
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isSubmitting}
            placeholder="Confirme a nova senha"
          />

          {error ? (
            <p role="alert" className="mt-4 border-l-2 border-red-500 pl-3 text-sm leading-relaxed text-red-700">
              {error}
            </p>
          ) : null}

          <button
            className="fk-primary mt-6 min-h-11 w-full rounded-md bg-red-600 px-4 py-3 text-sm font-bold tracking-normal text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Alterando..." : "Alterar senha"}
          </button>
        </form>
      ) : null}
    </AuthShell>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="fk-field mt-2 flex h-12! min-h-12! items-center gap-3 rounded-md border border-neutral-400 bg-white px-3 py-0! focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500">
      <Lock className="shrink-0 text-neutral-500" size={18} aria-hidden="true" />
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base text-neutral-950 outline-none placeholder:text-neutral-500 disabled:cursor-not-allowed disabled:opacity-70"
        id={id}
        name={id}
        autoComplete="new-password"
        type="password"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
      />
    </div>
  );
}

function StatusBlock({
  title,
  body,
  tone = "neutral",
}: {
  title: string;
  body: string;
  tone?: "neutral" | "error" | "success";
}) {
  const toneClass = {
    neutral: "border-neutral-400 text-neutral-700",
    error: "border-red-500 text-red-700",
    success: "border-emerald-500 text-emerald-700",
  }[tone];

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-l-2 pl-3 ${toneClass}`}>
      <p className="text-base font-black">{title}</p>
      <p className="mt-1 text-sm font-bold">{body}</p>
    </div>
  );
}

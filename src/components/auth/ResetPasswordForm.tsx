"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
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

          <div className="mt-10 w-full rounded-[24px] bg-white p-4 text-left text-neutral-950 shadow-xl shadow-black/25">
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
                  className="mt-5 h-[52px] w-full rounded-[18px] bg-red-600 text-base font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98]"
                >
                  Voltar para o login
                </button>
              </div>
            ) : null}

            {recoveryState === "success" ? (
              <StatusBlock title="Senha alterada" body="Senha alterada com sucesso." tone="success" />
            ) : null}

            {recoveryState === "ready" ? (
              <form onSubmit={handleSubmit}>
                <label className="text-sm font-bold" htmlFor="new-password">
                  Nova senha
                </label>
                <PasswordInput
                  id="new-password"
                  value={password}
                  onChange={setPassword}
                  disabled={isSubmitting}
                  placeholder="Digite a nova senha"
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
                  <p className="mt-4 rounded-[16px] bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                    {error}
                  </p>
                ) : null}

                <button
                  className="mt-5 h-[52px] w-full rounded-[18px] bg-red-600 text-base font-black uppercase tracking-wide text-white shadow-md shadow-red-600/20 transition hover:bg-red-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-75 disabled:active:scale-100"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Alterando..." : "Alterar senha"}
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </main>
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
    <div className="mt-2 flex h-[52px] items-center gap-3 rounded-[18px] border border-zinc-200 bg-zinc-50 px-4 transition focus-within:border-red-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-red-100">
      <Lock className="text-zinc-400" size={19} />
      <input
        className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none disabled:cursor-not-allowed disabled:opacity-70"
        id={id}
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
    neutral: "bg-zinc-50 text-zinc-700",
    error: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className={`rounded-[18px] p-4 ${toneClass}`}>
      <p className="text-base font-black">{title}</p>
      <p className="mt-1 text-sm font-bold">{body}</p>
    </div>
  );
}

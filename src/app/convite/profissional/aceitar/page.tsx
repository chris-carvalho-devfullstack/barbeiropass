"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InvitationType = "invite" | "magiclink";
type PageStage = "loading" | "password" | "finishing" | "error" | "success";

interface ApiResponse {
  error?: string;
  status?: string;
  valid?: boolean;
  alreadyAccepted?: boolean;
  success?: boolean;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function AcceptProfessionalInvitationPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const initializationStarted = useRef(false);

  const [stage, setStage] = useState<PageStage>("loading");
  const [invitationId, setInvitationId] = useState<string | null>(null);
  const [invitationType, setInvitationType] = useState<InvitationType | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const completeAcceptance = useCallback(
    async (currentInvitationId: string) => {
      setStage("finishing");
      setErrorMessage("");

      try {
        const response = await fetch("/api/staff/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({ invitationId: currentInvitationId }),
        });

        const result = (await response.json().catch(() => ({}))) as ApiResponse;

        if (!response.ok || result.success !== true) {
          throw new Error(
            result.error || "Não foi possível concluir a ativação. Tente novamente."
          );
        }

        setStage("success");
        router.replace("/profissional");
        router.refresh();
      } catch (error: unknown) {
        setStage("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a ativação. Tente novamente."
        );
      }
    },
    [router]
  );

  useEffect(() => {
    if (initializationStarted.current) return;
    initializationStarted.current = true;

    async function initializeInvitation() {
      try {
        const params = new URLSearchParams(window.location.search);
        const tokenHash = params.get("token_hash");
        const rawType = params.get("type");
        const rawInvitationId = params.get("invitation_id");

        if (!rawInvitationId || !UUID_PATTERN.test(rawInvitationId)) {
          throw new Error("O link não contém um identificador de convite válido. Solicite um novo link ao administrador.");
        }

        if (rawType !== "invite" && rawType !== "magiclink") {
          throw new Error("O tipo deste link não é válido para ativar uma conta profissional.");
        }

        setInvitationId(rawInvitationId);
        setInvitationType(rawType);

        if (tokenHash) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: rawType,
          });

          if (verifyError) {
            console.error("[STAFF_INVITATION_TOKEN_VERIFY_ERROR]", verifyError);
            throw new Error("Este link é inválido, já foi utilizado ou expirou. Solicite um novo link ao administrador.");
          }

          // Retira o token de uso único da barra de endereço assim que foi validado.
          // Preservamos apenas o tipo e o ID, para permitir retomar o fluxo após recarregar.
          const safeUrl = new URL(window.location.href);
          safeUrl.searchParams.delete("token_hash");
          window.history.replaceState(
            {},
            document.title,
            `${safeUrl.pathname}?${new URLSearchParams({
              type: rawType,
              invitation_id: rawInvitationId,
            }).toString()}`
          );
        }

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
          throw new Error("Não foi possível confirmar a sessão. Abra novamente o link recebido.");
        }

        setAccountEmail(user.email ?? null);

        // Valida no servidor se a sessão corresponde ao convite antes de pedir senha
        // ou executar a associação do profissional.
        const validationResponse = await fetch(
          `/api/staff/invitations/accept?invitationId=${encodeURIComponent(rawInvitationId)}`,
          { method: "GET", credentials: "same-origin", cache: "no-store" }
        );
        const validation = (await validationResponse.json().catch(() => ({}))) as ApiResponse;

        if (!validationResponse.ok || validation.valid !== true) {
          throw new Error(
            validation.error || "Este convite não pode ser utilizado por esta conta."
          );
        }

        setSessionReady(true);

        if (validation.alreadyAccepted === true || validation.status === "accepted") {
          setStage("success");
          router.replace("/profissional");
          router.refresh();
          return;
        }

        if (rawType === "invite") {
          setStage("password");
          return;
        }

        await completeAcceptance(rawInvitationId);
      } catch (error: unknown) {
        setStage("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível validar o convite. Solicite um novo link ao administrador."
        );
      }
    }

    void initializeInvitation();
  }, [completeAcceptance, router, supabase]);

  async function handleSetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 8) {
      setErrorMessage("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas informadas não são iguais.");
      return;
    }

    if (!invitationId) {
      setErrorMessage("O identificador do convite não está disponível. Abra novamente o link recebido.");
      setStage("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password });

      if (passwordError) {
        throw new Error(passwordError.message || "Não foi possível definir a senha.");
      }

      setPasswordUpdated(true);
      await completeAcceptance(invitationId);
    } catch (error: unknown) {
      setStage("password");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível definir a senha. Tente novamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function retryAcceptance() {
    if (!invitationId) return;
    void completeAcceptance(invitationId);
  }

  const canRetryAcceptance =
    sessionReady &&
    invitationId !== null &&
    (invitationType === "magiclink" || passwordUpdated);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              BarbeiroPass
            </p>
            <h1 className="text-xl font-bold tracking-tight">Acesso profissional</h1>
          </div>
        </div>

        {(stage === "loading" || stage === "finishing") && (
          <div className="flex flex-col items-center py-12 text-center" aria-live="polite">
            <Loader2 className="mb-4 size-10 animate-spin text-slate-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold">
              {stage === "loading" ? "Validando seu convite" : "Concluindo sua ativação"}
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {stage === "loading"
                ? "Estamos verificando a autenticidade do link e o vínculo com a barbearia."
                : "Estamos vinculando sua conta ao cadastro profissional."}
            </p>
          </div>
        )}

        {stage === "password" && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">Defina sua senha</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Seu convite foi validado. Crie uma senha para acessar sua área profissional.
              </p>
              {accountEmail && (
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Conta: <span className="font-semibold">{accountEmail}</span>
                </p>
              )}
            </div>

            <form className="space-y-4" onSubmit={handleSetPassword}>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">Nova senha</label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                  placeholder="Pelo menos 8 caracteres"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium">Confirme a senha</label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                  placeholder="Digite a mesma senha novamente"
                />
              </div>

              {errorMessage && (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{errorMessage}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Salvando acesso...</>
                ) : (
                  <><LockKeyhole className="mr-2 size-4" aria-hidden="true" /> Definir senha e ativar conta</>
                )}
              </Button>
            </form>
          </>
        )}

        {stage === "error" && (
          <div className="py-3">
            <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
              <AlertCircle className="size-6" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold">Não foi possível concluir</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600" role="alert">
              {errorMessage || "O convite não pode ser utilizado. Solicite ajuda ao administrador da barbearia."}
            </p>
            <div className="mt-6 flex flex-col gap-3">
              {canRetryAcceptance && (
                <Button type="button" onClick={retryAcceptance} className="w-full">
                  Tentar concluir novamente
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => router.replace("/login")}
              >
                Ir para o login
              </Button>
              <p className="text-xs leading-5 text-slate-500">
                Se o link estiver expirado, já tiver sido usado ou pertencer a outro e-mail, peça ao administrador que verifique o convite e gere um novo quando necessário.
              </p>
            </div>
          </div>
        )}

        {stage === "success" && (
          <div className="flex flex-col items-center py-10 text-center" aria-live="polite">
            <CheckCircle2 className="mb-4 size-12 text-emerald-600" aria-hidden="true" />
            <h2 className="text-xl font-bold">Acesso ativado</h2>
            <p className="mt-2 text-sm text-slate-600">Redirecionando para sua área profissional...</p>
          </div>
        )}

        <p className="mt-8 border-t border-slate-100 pt-4 text-center text-xs text-slate-400">
          A ativação é vinculada à conta autenticada e ao convite emitido pela barbearia.
        </p>
      </section>
    </main>
  );
}

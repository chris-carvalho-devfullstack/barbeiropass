// src/components/queue-estimator-settings-card.tsx
"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  Save,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type QueueAcceptancePolicy = "accept_until_closing" | "restrict_by_capacity";

interface QueueSettingsResponse {
  defaultQueueDurationMinutes: number;
  queueDurationConfigured: boolean;
  queueAcceptancePolicy: QueueAcceptancePolicy;
}

const DEFAULT_QUEUE_DURATION_MINUTES = 20;

const policyOptions: {
  value: QueueAcceptancePolicy;
  title: string;
  description: string;
  icon: typeof Clock3;
}[] = [
  {
    value: "accept_until_closing",
    title: "Aceitar entradas até o fechamento",
    description:
      "A fila pública pode receber clientes enquanto a barbearia estiver aberta e houver profissional elegível no horário atual. Os atendimentos já aceitos podem continuar após o fechamento.",
    icon: Users,
  },
  {
    value: "restrict_by_capacity",
    title: "Restringir pela capacidade prevista",
    description:
      "Bloqueia novas entradas quando o atendimento projetado não puder começar e terminar dentro dos horários aplicáveis da barbearia e do profissional.",
    icon: ShieldCheck,
  },
];

function getPolicyTitle(policy: QueueAcceptancePolicy): string {
  return policy === "accept_until_closing"
    ? "Aceitar até o fechamento"
    : "Restringir pela capacidade";
}

export default function QueueEstimatorSettingsCard() {
  const [duration, setDuration] = useState(String(DEFAULT_QUEUE_DURATION_MINUTES));
  const [queueAcceptancePolicy, setQueueAcceptancePolicy] =
    useState<QueueAcceptancePolicy>("restrict_by_capacity");
  const [queueDurationConfigured, setQueueDurationConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/fila/metricas/configuracao", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const result = await response.json().catch(() => null);

        if (!response.ok || !result?.data) {
          throw new Error(
            result?.error ||
              "Não foi possível carregar a configuração do estimador."
          );
        }

        if (cancelled) return;

        const data = result.data as QueueSettingsResponse;
        setDuration(
          String(
            data.defaultQueueDurationMinutes ?? DEFAULT_QUEUE_DURATION_MINUTES
          )
        );
        setQueueDurationConfigured(data.queueDurationConfigured === true);
        setQueueAcceptancePolicy(
          data.queueAcceptancePolicy === "accept_until_closing"
            ? "accept_until_closing"
            : "restrict_by_capacity"
        );
      } catch (error) {
        if (!cancelled) {
          console.error("[QUEUE_ESTIMATOR_SETTINGS_LOAD]", error);
          toast.error(
            error instanceof Error
              ? error.message
              : "Erro ao carregar as configurações da fila."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    const parsedDuration = Number(duration);

    if (
      !Number.isInteger(parsedDuration) ||
      parsedDuration < 1 ||
      parsedDuration > 480
    ) {
      toast.error("Informe um tempo inteiro entre 1 e 480 minutos.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/fila/metricas/configuracao", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultQueueDurationMinutes: parsedDuration,
          queueAcceptancePolicy,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success || !result?.data) {
        throw new Error(
          result?.error || "Não foi possível salvar a configuração."
        );
      }

      const saved = result.data as QueueSettingsResponse;
      setDuration(String(saved.defaultQueueDurationMinutes));
      setQueueDurationConfigured(saved.queueDurationConfigured === true);
      setQueueAcceptancePolicy(
        saved.queueAcceptancePolicy === "accept_until_closing"
          ? "accept_until_closing"
          : "restrict_by_capacity"
      );

      toast.success("Configuração do estimador salva.");
      setIsExpanded(false);
    } catch (error) {
      console.error("[QUEUE_ESTIMATOR_SETTINGS_SAVE]", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao salvar a configuração do estimador."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3" aria-label="Configuração do estimador">
      {!isExpanded ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <CalendarClock className="size-[18px]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Configuração do estimador
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {loading
                  ? "Carregando as configurações salvas..."
                  : `${duration || DEFAULT_QUEUE_DURATION_MINUTES} min por atendimento · ${getPolicyTitle(queueAcceptancePolicy)}`}
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            title="Abrir as configurações de duração e aceitação da fila"
            aria-expanded={false}
            onClick={() => setIsExpanded(true)}
            className="shrink-0 gap-2 border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Settings2 className="size-4" aria-hidden="true" />
            Configuração
            <ChevronDown className="size-4 text-zinc-500" aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Card className="overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800">
          <CardHeader className="border-b border-zinc-100 bg-zinc-50/70 px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900/70 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
                  <CalendarClock className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold tracking-tight">
                    Configuração do estimador
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-3xl text-sm leading-relaxed">
                    Ajuste a duração aplicada às novas entradas e a regra de
                    aceitação da fila pública. As métricas históricas não alteram
                    estas opções automaticamente.
                  </CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                title="Recolher a configuração do estimador"
                aria-expanded={true}
                onClick={() => setIsExpanded(false)}
                disabled={saving}
                className="shrink-0 gap-1.5 text-zinc-600 hover:bg-zinc-200/70 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <span className="hidden sm:inline">Recolher</span>
                <ChevronUp className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 p-5 sm:p-6">
            <section className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label
                  htmlFor="default-queue-duration"
                  className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                >
                  Tempo estimado por atendimento
                </Label>
                <span className="w-fit rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {queueDurationConfigured
                    ? "Configurado pela barbearia"
                    : "Padrão do sistema"}
                </span>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-44 sm:shrink-0">
                  <Input
                    id="default-queue-duration"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    value={duration}
                    disabled={loading || saving}
                    onChange={(event) =>
                      setDuration(event.target.value.replace(/[^0-9]/g, ""))
                    }
                    aria-describedby="queue-duration-help"
                    className="h-11 pr-12 text-base font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    min
                  </span>
                </div>
                <p
                  id="queue-duration-help"
                  className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400"
                >
                  Informe um valor inteiro entre 1 e 480. A alteração vale para
                  novas entradas; os tickets existentes mantêm suas durações
                  gravadas.
                </p>
              </div>
            </section>

            <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Política de aceitação de novas entradas
              </legend>
              <p className="max-w-4xl text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                Esta escolha afeta a fila pública. A inclusão manual pelo painel
                permanece independente desta política.
              </p>

              <div className="grid gap-3 lg:grid-cols-2">
                {policyOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const selected = queueAcceptancePolicy === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={loading || saving}
                      onClick={() => setQueueAcceptancePolicy(option.value)}
                      className={`group flex h-full w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900 ${
                        selected
                          ? "border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-950/30 dark:ring-indigo-400"
                          : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                          selected
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/80 dark:text-indigo-200"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        <OptionIcon className="size-4" aria-hidden="true" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100">
                            {option.title}
                          </span>
                          {selected && (
                            <CheckCircle2
                              className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300"
                              aria-label="Selecionado"
                            />
                          )}
                        </span>
                        <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                <Clock3 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                As médias históricas não alteram esta configuração.
              </p>
              <Button
                type="button"
                onClick={handleSave}
                disabled={loading || saving}
                className="shrink-0 gap-2 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="size-4" aria-hidden="true" />
                )}
                {saving ? "Salvando..." : "Salvar configuração"}
              </Button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Carregando as configurações salvas...
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

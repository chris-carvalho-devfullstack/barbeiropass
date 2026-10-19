"use client";

import React, { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Loader2,
  Scissors,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import QueueEstimatorSettingsCard from "@/components/queue-estimator-settings-card";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type MetricsPeriod = "day" | "week" | "month";

interface QueueOverview {
  entries: number;
  started: number;
  finished: number;
  averageWaitMinutes: number | null;
  averageDurationMinutes: number | null;
  averageTotalMinutes: number | null;
}

interface QueueSeriesItem {
  label: string;
  entries: number;
  started: number;
  finished: number;
  averageWaitMinutes: number | null;
  averageDurationMinutes: number | null;
}

interface ServiceMetric {
  label: string;
  count: number;
  averageDurationMinutes: number | null;
}

interface BarberMetric {
  id: string;
  name: string;
  started: number;
  finished: number;
  averageWaitMinutes: number | null;
  averageDurationMinutes: number | null;
}

interface QueueConfiguration {
  defaultQueueDurationMinutes: number;
  isManuallyConfigured: boolean;
  fallbackMinutes: number;
}

interface QueueMetricsResponse {
  success: boolean;
  period: MetricsPeriod;
  configuration: QueueConfiguration;
  overview: QueueOverview;
  series: QueueSeriesItem[];
  byService: ServiceMetric[];
  byBarber: BarberMetric[];
  error?: string;
}

const PERIOD_OPTIONS: Array<{
  value: MetricsPeriod;
  label: string;
}> = [
  { value: "day", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
];

function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} min`;
}

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatStatusMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Ocorreu um erro inesperado.";
}

function MetricCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {label}
          </p>

          <p className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            {value}
          </p>

          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {icon}
        </div>
      </div>
    </section>
  );
}

export default function QueueMetricsPage() {
  const [period, setPeriod] = useState<MetricsPeriod>("week");
  const [metrics, setMetrics] = useState<QueueMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);


  useEffect(() => {
    let cancelled = false;

    async function loadMetrics() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/fila/metricas?period=${period}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const result = (await response.json()) as QueueMetricsResponse;

        if (!response.ok || !result.success) {
          throw new Error(
            result.error || "Não foi possível carregar as métricas."
          );
        }

        if (cancelled) {
          return;
        }

        setMetrics(result);

      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = formatStatusMessage(error);
        setLoadError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, [period]);

  const overview = metrics?.overview;

  return (
    <main className="space-y-7 text-zinc-950 dark:text-zinc-50">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            <Activity className="size-4" />
            Gestão da barbearia
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Métricas da Fila
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Acompanhe os tempos reais da operação e ajuste a duração
            que o estimador utiliza nas novas entradas da fila virtual.
          </p>
        </div>

        <div
          className="inline-flex w-fit items-center rounded-xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900"
          aria-label="Período das métricas"
        >
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              className={[
                "rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                period === option.value
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
              ].join(" ")}
              aria-pressed={period === option.value}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {loadError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {loadError}
        </section>
      )}

      <QueueEstimatorSettingsCard />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Entradas na fila"
          value={overview ? formatCount(overview.entries) : "—"}
          description="Clientes que entraram no período selecionado."
          icon={<Users className="size-5" />}
        />

        <MetricCard
          label="Tempo médio de espera"
          value={overview ? formatMinutes(overview.averageWaitMinutes) : "—"}
          description="Da entrada na fila até o início do atendimento."
          icon={<Clock3 className="size-5" />}
        />

        <MetricCard
          label="Duração média"
          value={
            overview
              ? formatMinutes(overview.averageDurationMinutes)
              : "—"
          }
          description="Do início à conclusão do serviço."
          icon={<Scissors className="size-5" />}
        />

        <MetricCard
          label="Tempo total médio"
          value={overview ? formatMinutes(overview.averageTotalMinutes) : "—"}
          description="Da entrada na fila até a conclusão do serviço."
          icon={<CheckCircle2 className="size-5" />}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Iniciados no período
          </p>
          <p className="mt-2 text-2xl font-bold">
            {overview ? formatCount(overview.started) : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Finalizados no período
          </p>
          <p className="mt-2 text-2xl font-bold">
            {overview ? formatCount(overview.finished) : "—"}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Período selecionado
          </p>
          <p className="mt-2 text-2xl font-bold">
            {PERIOD_OPTIONS.find((item) => item.value === period)?.label}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-zinc-100 p-2.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            <BarChart3 className="size-5" />
          </div>

          <div>
            <h2 className="font-bold">Evolução da fila</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Entradas, inícios e conclusões de atendimentos.
            </p>
          </div>
        </div>

        <div className="h-80 w-full">
          {loading ? (
            <div className="flex h-full items-center justify-center text-zinc-500">
              <Loader2 className="mr-2 size-5 animate-spin" />
              Carregando dados...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={metrics?.series ?? []}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  opacity={0.12}
                />

                <XAxis
                  dataKey="label"
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={12}
                />

                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "currentColor", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />

                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--background, #ffffff)",
                    border: "1px solid #d4d4d8",
                    borderRadius: 12,
                    color: "var(--foreground, #18181b)",
                  }}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="entries"
                  name="Entradas"
                  stroke="#64748b"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />

                <Line
                  type="monotone"
                  dataKey="started"
                  name="Iniciados"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />

                <Line
                  type="monotone"
                  dataKey="finished"
                  name="Finalizados"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="font-bold">Tempo por período</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Espera média e duração real média dos serviços.
          </p>

          <div className="mt-5 h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando dados...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={metrics?.series ?? []}
                  margin={{ top: 8, right: 10, left: 0, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.12}
                  />

                  <XAxis
                    dataKey="label"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={12}
                  />

                  <YAxis
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="averageWaitMinutes"
                    name="Espera (min)"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    connectNulls
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="averageDurationMinutes"
                    name="Atendimento (min)"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    connectNulls
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
          <h2 className="font-bold">Serviços realizados</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Duração média por combinação de serviços registrada na finalização.
          </p>

          <div className="mt-5 h-72">
            {loading ? (
              <div className="flex h-full items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 size-5 animate-spin" />
                Carregando dados...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={(metrics?.byService ?? []).slice(0, 8)}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    opacity={0.12}
                  />

                  <XAxis
                    type="number"
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tick={{ fill: "currentColor", fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />

                  <Tooltip />

                  <Bar
                    dataKey="averageDurationMinutes"
                    name="Duração média (min)"
                    fill="#64748b"
                    radius={[0, 6, 6, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="mb-5">
          <h2 className="font-bold">Desempenho por barbeiro</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            As médias são calculadas com os registros reais de cada profissional.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="px-3 py-3 font-semibold">Profissional</th>
                <th className="px-3 py-3 text-right font-semibold">Iniciados</th>
                <th className="px-3 py-3 text-right font-semibold">Finalizados</th>
                <th className="px-3 py-3 text-right font-semibold">Espera média</th>
                <th className="px-3 py-3 text-right font-semibold">Duração média</th>
              </tr>
            </thead>

            <tbody>
              {(metrics?.byBarber ?? []).map((barber) => (
                <tr
                  key={barber.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                >
                  <td className="px-3 py-4 font-semibold">{barber.name}</td>
                  <td className="px-3 py-4 text-right">
                    {formatCount(barber.started)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {formatCount(barber.finished)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {formatMinutes(barber.averageWaitMinutes)}
                  </td>
                  <td className="px-3 py-4 text-right">
                    {formatMinutes(barber.averageDurationMinutes)}
                  </td>
                </tr>
              ))}

              {!loading && (metrics?.byBarber.length ?? 0) === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-10 text-center text-zinc-500"
                  >
                    Nenhum atendimento com registros suficientes neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        As médias utilizam timestamps válidos. Registros históricos sem horário
        de início ou término não são contabilizados como duração zero. A
        configuração do tempo estimado afeta apenas novas entradas; os tickets
        existentes preservam suas estimativas originais.
      </p>
    </main>
  );
}
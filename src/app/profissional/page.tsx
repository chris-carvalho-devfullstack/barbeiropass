import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { endOfDay, format, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Armchair,
  CalendarDays,
  CheckCircle2,
  Clock3,
  DollarSign,
  Scissors,
  UserRound,
  Wallet,
} from "lucide-react";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface WorkStation {
  name: string;
  status: string;
}

interface AppointmentData {
  id: string;
  scheduled_at: string;
  status: string;
  client_name: string | null;
  services: {
    name: string;
    price: number;
  } | null;
}

interface LedgerEntry {
  amount: number;
  transaction_type: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
  };

  return labels[status] ?? status;
}

function formatDateHeading(date: Date): string {
  const formatted = format(date, "EEEE, dd 'de' MMMM", {
    locale: ptBR,
  });

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default async function ProfessionalPage() {
  const supabase = await createClient();

  // 1. Autenticação no servidor.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  // 2. Busca exclusivamente o cadastro profissional
  // vinculado à conta autenticada.
  const {
    data: staffData,
    error: staffError,
  } = await supabase
    .from("staff")
    .select(`
      id,
      full_name,
      role,
      payment_model,
      fixed_rental_fee,
      profile_id,
      barbershop_id,
      is_active,
      work_stations (
        name,
        status
      )
    `)
    .eq("profile_id", user.id)
    .eq("role", "barber")
    .eq("is_active", true)
    .maybeSingle();

  const now = new Date();

  if (staffError) {
    console.error(
      "[PORTAL PROFISSIONAL] Erro ao consultar o cadastro:",
      staffError
    );
  }

  // A página pode ser acessada sem um cadastro profissional associado.
  // Nesse caso, apresenta uma mensagem específica, sem expor outros dados.
  if (staffError || !staffData) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50 sm:px-8">
        <div className="mx-auto flex min-h-[65vh] max-w-3xl items-center justify-center">
          <Card className="w-full border-zinc-200 shadow-sm dark:border-zinc-800">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <UserRound className="size-8" />
              </div>

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                BarbeiroPass
              </p>

              <h1 className="mt-3 text-2xl font-bold tracking-tight">
                Seu espaço profissional
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {staffError
                  ? "Não foi possível carregar seu cadastro profissional. Tente novamente mais tarde."
                  : "Sua conta ainda não possui um cadastro ativo de barbeiro vinculado. Solicite ao proprietário ou gerente da barbearia a regularização do seu acesso."}
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const stationRelation = staffData.work_stations as unknown as
    | WorkStation
    | WorkStation[]
    | null;

  const workStation = Array.isArray(stationRelation)
    ? stationRelation[0] ?? null
    : stationRelation;

  const firstName =
    staffData.full_name?.trim().split(/\s+/)[0] || "Profissional";

  const isFixedFee = staffData.payment_model === "fixed_fee";

  // 3. Consulta a agenda do dia, os próximos compromissos
  // e os lançamentos financeiros do próprio profissional.
  const startToday = startOfDay(now).toISOString();
  const endToday = endOfDay(now).toISOString();
  const nowIso = now.toISOString();

  const appointmentSelect = `
    id,
    scheduled_at,
    status,
    client_name,
    services (
      name,
      price
    )
  `;

  const [
    { data: todayAppointmentsRaw, error: todayAppointmentsError },
    { data: upcomingAppointmentsRaw, error: upcomingAppointmentsError },
    { data: ledgerRaw, error: ledgerError },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(appointmentSelect)
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${user.id}`)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", startToday)
      .lte("scheduled_at", endToday)
      .order("scheduled_at", { ascending: true }),

    supabase
      .from("appointments")
      .select(appointmentSelect)
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${user.id}`)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(5),

    supabase
      .from("staff_financial_ledgers")
      .select("amount, transaction_type")
      .eq("staff_id", staffData.id)
      .in("transaction_type", [
        "commission_earned",
        "audit_adjustment",
      ])
      .gte("created_at", startToday)
      .lte("created_at", endToday),
  ]);

  if (todayAppointmentsError) {
    console.error(
      "[PORTAL PROFISSIONAL] Erro ao consultar a agenda do dia:",
      todayAppointmentsError
    );
  }

  if (upcomingAppointmentsError) {
    console.error(
      "[PORTAL PROFISSIONAL] Erro ao consultar os próximos compromissos:",
      upcomingAppointmentsError
    );
  }

  if (ledgerError) {
    console.error(
      "[PORTAL PROFISSIONAL] Erro ao consultar os lançamentos financeiros:",
      ledgerError
    );
  }

  const todayAppointments =
    (todayAppointmentsRaw as unknown as AppointmentData[] | null) ?? [];

  const upcomingAppointments =
    (upcomingAppointmentsRaw as unknown as AppointmentData[] | null) ?? [];

  const ledgerEntries =
    (ledgerRaw as unknown as LedgerEntry[] | null) ?? [];

  const earningsToday = ledgerError
    ? null
    : ledgerEntries.reduce(
        (total, entry) => total + Number(entry.amount),
        0
      );

  const todayCount = todayAppointmentsError
    ? null
    : todayAppointments.length;

  const nextAppointment = upcomingAppointmentsError
    ? null
    : upcomingAppointments[0] ?? null;

  const currentDateLabel = formatDateHeading(now);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-7 p-4 pb-10 pt-6 sm:p-6 lg:gap-8 lg:p-8">

        {/* CABEÇALHO */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-600" />

              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">
                BarbeiroPass
              </p>

              <span className="text-zinc-300 dark:text-zinc-700">/</span>

              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Área profissional
              </p>
            </div>

            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Olá, {firstName}
              <span className="text-indigo-600 dark:text-indigo-400">.</span>
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Aqui está um resumo da sua rotina e dos seus atendimentos.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <CalendarDays className="size-5" />
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Hoje
              </p>

              <p className="text-sm font-semibold capitalize">
                {currentDateLabel}
              </p>
            </div>
          </div>
        </header>

        {/* DESTAQUE PRINCIPAL */}
        <section className="relative isolate overflow-hidden rounded-2xl bg-zinc-950 p-6 text-white shadow-sm sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-28 -z-10 size-80 rounded-full bg-indigo-600/25 blur-3xl"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 size-72 rounded-full bg-violet-500/10 blur-3xl"
          />

          <div className="flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
                <Scissors className="size-3.5 text-indigo-300" />

                <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-200">
                  Seu espaço de trabalho
                </span>
              </div>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Seu trabalho.
                <br className="sm:hidden" /> Seus resultados.
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-300">
                Acompanhe os compromissos do dia e consulte as informações
                relacionadas à sua atividade profissional.
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3 self-start rounded-xl border border-white/10 bg-white/5 p-4 md:self-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300">
                <CheckCircle2 className="size-6" />
              </div>

              <div>
                <p className="text-xs font-medium text-zinc-400">
                  Situação do cadastro
                </p>

                <p className="mt-1 text-sm font-semibold text-white">
                  Profissional ativo
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* INDICADORES */}
        <section aria-label="Resumo do dia" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              Resumo do dia
            </h2>

            <Badge
              variant="secondary"
              className="border border-zinc-200 bg-white font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
            >
              Visão individual
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">

            {/* CARD: AGENDA */}
            <Card className="gap-0 border-zinc-200 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="space-y-1">
                  <CardDescription className="text-sm font-medium text-muted-foreground">
                    Atendimentos hoje
                  </CardDescription>

                  <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
                    {todayCount === null ? "—" : todayCount}
                  </CardTitle>
                </div>

                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <CalendarDays className="size-5" />
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <Clock3 className="size-3.5 text-muted-foreground" />

                  <p className="text-xs text-muted-foreground">
                    {todayAppointmentsError
                      ? "Não foi possível consultar a agenda."
                      : "Compromissos agendados ou confirmados."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CARD: PRÓXIMO ATENDIMENTO */}
            <Card className="gap-0 border-zinc-200 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0 space-y-1">
                  <CardDescription className="text-sm font-medium text-muted-foreground">
                    Próximo atendimento
                  </CardDescription>

                  <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
                    {upcomingAppointmentsError
                      ? "—"
                      : nextAppointment
                        ? format(
                            new Date(nextAppointment.scheduled_at),
                            "HH:mm"
                          )
                        : "--:--"}
                  </CardTitle>
                </div>

                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Clock3 className="size-5" />
                </div>
              </CardHeader>

              <CardContent>
                <div className="border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <p className="truncate text-xs text-muted-foreground">
                    {upcomingAppointmentsError
                      ? "Não foi possível consultar os próximos horários."
                      : nextAppointment
                        ? `${nextAppointment.client_name || "Cliente"} · ${
                            nextAppointment.services?.name ||
                            "Serviço não informado"
                          }`
                        : "Nenhum compromisso futuro encontrado."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* CARD: RESULTADO FINANCEIRO */}
            <Card className="gap-0 border-zinc-200 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 sm:col-span-2 xl:col-span-1">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0 space-y-1">
                  <CardDescription className="text-sm font-medium text-muted-foreground">
                    Resultado financeiro do dia
                  </CardDescription>

                  <CardTitle
                    className={`text-3xl font-bold tracking-tight tabular-nums ${
                      earningsToday !== null && earningsToday < 0
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {earningsToday === null
                      ? "—"
                      : formatCurrency(earningsToday)}
                  </CardTitle>
                </div>

                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Wallet className="size-5" />
                </div>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  <DollarSign className="size-3.5 text-muted-foreground" />

                  <p className="text-xs text-muted-foreground">
                    {ledgerError
                      ? "Não foi possível consultar os lançamentos."
                      : "Soma dos lançamentos financeiros de hoje."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* AGENDA E RESUMO PROFISSIONAL */}
        <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">

          {/* AGENDA DO DIA */}
          <Card
            id="agenda"
            className="gap-0 overflow-hidden border-zinc-200 shadow-sm dark:border-zinc-800"
          >
            <CardHeader className="border-b border-zinc-100 px-5 py-5 dark:border-zinc-800 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    Agenda de hoje
                  </CardTitle>

                  <CardDescription>
                    Seus compromissos em ordem de horário.
                  </CardDescription>
                </div>

                <Badge
                  variant="secondary"
                  className="w-fit bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  {todayCount === null
                    ? "Indisponível"
                    : `${todayCount} ${
                        todayCount === 1 ? "atendimento" : "atendimentos"
                      }`}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {todayAppointmentsError ? (
                <div
                  role="alert"
                  className="flex flex-col items-center px-5 py-12 text-center"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                    <CalendarDays className="size-5" />
                  </div>

                  <p className="mt-4 text-sm font-semibold">
                    Não foi possível carregar a agenda
                  </p>

                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Verifique sua conexão e tente acessar novamente mais tarde.
                  </p>
                </div>
              ) : todayAppointments.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    <CalendarDays className="size-6" />
                  </div>

                  <p className="mt-4 text-sm font-semibold">
                    Sua agenda está livre
                  </p>

                  <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                    Não há atendimentos agendados ou confirmados para hoje.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="bg-zinc-50/80 text-left dark:bg-zinc-900/60">
                      <tr className="border-b border-zinc-100 dark:border-zinc-800">
                        <th className="px-5 py-3.5 font-medium text-muted-foreground sm:px-6">
                          Horário
                        </th>

                        <th className="px-5 py-3.5 font-medium text-muted-foreground">
                          Cliente
                        </th>

                        <th className="px-5 py-3.5 font-medium text-muted-foreground">
                          Serviço
                        </th>

                        <th className="px-5 py-3.5 font-medium text-muted-foreground">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {todayAppointments.map((appointment) => (
                        <tr
                          key={appointment.id}
                          className="border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50/70 dark:border-zinc-800 dark:hover:bg-zinc-900/60"
                        >
                          <td className="whitespace-nowrap px-5 py-4 font-semibold tabular-nums text-indigo-700 dark:text-indigo-400 sm:px-6">
                            {format(
                              new Date(appointment.scheduled_at),
                              "HH:mm"
                            )}
                          </td>

                          <td className="max-w-[180px] truncate px-5 py-4 font-medium">
                            {appointment.client_name || "Cliente"}
                          </td>

                          <td className="max-w-[180px] truncate px-5 py-4 text-muted-foreground">
                            {appointment.services?.name ||
                              "Serviço não informado"}
                          </td>

                          <td className="whitespace-nowrap px-5 py-4">
                            <Badge
                              variant="secondary"
                              className={
                                appointment.status === "confirmed"
                                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : "border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-400"
                              }
                            >
                              {formatStatus(appointment.status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* PERFIL PROFISSIONAL */}
          <Card
            id="perfil"
            className="gap-0 border-zinc-200 shadow-sm dark:border-zinc-800"
          >
            <CardHeader className="border-b border-zinc-100 px-5 py-5 dark:border-zinc-800">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Meu perfil profissional
              </CardTitle>

              <CardDescription>
                Resumo das suas informações de trabalho.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <UserRound className="size-6" />
                </div>

                <div className="min-w-0">
                  <h3 className="truncate font-semibold">
                    {staffData.full_name || "Nome não informado"}
                  </h3>

                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Barbeiro · BarbeiroPass
                  </p>
                </div>
              </div>

              <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                <div className="flex items-start gap-3 py-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Armchair className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Bancada de trabalho
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {workStation?.name || "Não atribuída"}
                    </p>

                    {workStation?.status && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Situação: {workStation.status}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 py-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    <Wallet className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Modelo financeiro
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      {isFixedFee
                        ? "Taxa fixa mensal"
                        : staffData.payment_model === "commission"
                          ? "Comissão por serviço"
                          : "Modelo não identificado"}
                    </p>

                    {isFixedFee && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Valor cadastrado:{" "}
                        {formatCurrency(
                          Number(staffData.fixed_rental_fee ?? 0)
                        )}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 py-4">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <CheckCircle2 className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      Cadastro
                    </p>

                    <p className="mt-1 text-sm font-semibold">
                      Ativo
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Seu vínculo profissional está ativo.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* NOTA DE PRIVACIDADE */}
        <footer className="flex flex-col gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              <UserRound className="size-4" />
            </div>

            <div>
              <p className="text-xs font-semibold">
                Seu espaço profissional
              </p>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                Esta visão apresenta informações relacionadas ao seu cadastro.
                O acesso aos dados é condicionado à autenticação e às permissões
                configuradas no sistema.
              </p>
            </div>
          </div>

          <p className="shrink-0 text-xs text-muted-foreground">
            BarbeiroPass · Área profissional
          </p>
        </footer>
      </div>
    </main>
  );
}
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, CalendarDays, Clock3, Users } from "lucide-react";
import { getProfessionalContext } from "@/utils/professional/get-professional-context";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface AppointmentServiceRow {
  services: { name: string } | { name: string }[] | null;
}

interface AppointmentRow {
  id: string;
  client_name: string | null;
  scheduled_at: string;
  status: string;
  appointment_services: AppointmentServiceRow[] | null;
}

interface QueueRow {
  id: string;
  status: string;
  joined_at: string | null;
  barber_id: string | null;
}

function getBrazilDayRange(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayKey = `${values.year}-${values.month}-${values.day}`;
  const start = new Date(`${dayKey}T00:00:00-03:00`);
  const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    start: start.toISOString(),
    end: new Date(nextDay.getTime() - 1).toISOString(),
  };
}

function getAppointmentServiceNames(appointment: AppointmentRow): string[] {
  return (appointment.appointment_services ?? [])
    .map((row) => {
      const service = Array.isArray(row.services) ? row.services[0] : row.services;
      return service?.name ?? null;
    })
    .filter((name): name is string => Boolean(name));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "Agendado",
    confirmed: "Confirmado",
    in_progress: "Em atendimento",
    awaiting_payment: "Aguardando pagamento",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export default async function ProfessionalPage() {
  const { supabase, staff, barbershop, user } = await getProfessionalContext();
  const now = new Date();
  const { start, end } = getBrazilDayRange(now);
  const nowIso = now.toISOString();

  const [todayResult, upcomingResult, queueResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, client_name, scheduled_at, status, appointment_services(services(name))")
      .eq("barbershop_id", staff.barbershop_id)
      .eq("barber_id", staff.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", start)
      .lte("scheduled_at", end)
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("appointments")
      .select("id, client_name, scheduled_at, status, appointment_services(services(name))")
      .eq("barbershop_id", staff.barbershop_id)
      .eq("barber_id", staff.id)
      .in("status", ["scheduled", "confirmed"])
      .gte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(4),
    supabase
      .from("virtual_queue")
      .select("id, status, joined_at, barber_id")
      .eq("barbershop_id", staff.barbershop_id)
      .in("status", ["waiting", "in_progress", "in_chair"])
      .order("joined_at", { ascending: true }),
  ]);

  if (todayResult.error) console.error("[PROFESSIONAL_TODAY_APPOINTMENTS]", todayResult.error);
  if (upcomingResult.error) console.error("[PROFESSIONAL_UPCOMING_APPOINTMENTS]", upcomingResult.error);
  if (queueResult.error) console.error("[PROFESSIONAL_QUEUE_SUMMARY]", queueResult.error);

  const todayAppointments = (todayResult.data ?? []) as unknown as AppointmentRow[];
  const upcomingAppointments = (upcomingResult.data ?? []) as unknown as AppointmentRow[];
  const queueItems = (queueResult.data ?? []) as QueueRow[];
  const waitingCount = queueItems.filter((item) => item.status === "waiting").length;
  const ownActiveCount = queueItems.filter(
    (item) => (item.status === "in_progress" || item.status === "in_chair") && item.barber_id === staff.id,
  ).length;
  const firstName = staff.full_name.trim().split(/\s+/)[0] || "Profissional";
  const todayLabel = format(now, "EEEE, d 'de' MMMM", { locale: ptBR });
  const nextAppointment = upcomingAppointments[0] ?? null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <header className="flex flex-col gap-2 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">{barbershop.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Olá, {firstName}.</h1>
          <p className="mt-2 text-sm text-zinc-600">Aqui está o que merece sua atenção hoje.</p>
        </div>
        <p className="text-sm capitalize text-zinc-500">{todayLabel}</p>
      </header>

      <section aria-label="Resumo do expediente" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Agendamentos hoje</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
            {todayResult.error ? "—" : todayAppointments.length}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Compromissos atribuídos a você</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Aguardando na fila</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
            {queueResult.error ? "—" : waitingCount}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Clientes aguardando atendimento</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <p className="text-sm text-zinc-500">Seus atendimentos em andamento</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">
            {queueResult.error ? "—" : ownActiveCount}
          </p>
          <p className="mt-2 text-xs text-zinc-500">Clientes sob sua responsabilidade</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.85fr)]">
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Próximos compromissos</h2>
              <p className="mt-1 text-xs text-zinc-500">Somente os horários da sua agenda.</p>
            </div>
            <Link href="/profissional/agendamentos" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950">
              Ver agenda <ArrowRight size={15} />
            </Link>
          </div>
          <div className="divide-y divide-zinc-100">
            {upcomingResult.error ? (
              <p className="px-5 py-8 text-sm text-zinc-500">Não foi possível carregar os próximos compromissos.</p>
            ) : upcomingAppointments.length === 0 ? (
              <div className="px-5 py-10">
                <p className="text-sm font-medium text-zinc-800">Nenhum compromisso próximo.</p>
                <p className="mt-1 text-sm text-zinc-500">Quando houver novos agendamentos, eles aparecerão aqui.</p>
              </div>
            ) : upcomingAppointments.map((appointment) => {
              const serviceNames = getAppointmentServiceNames(appointment);
              return (
                <Link
                  key={appointment.id}
                  href="/profissional/agendamentos"
                  className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-zinc-50"
                >
                  <div className="w-14 shrink-0 pt-0.5">
                    <p className="text-sm font-semibold tabular-nums">
                      {new Intl.DateTimeFormat("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      }).format(new Date(appointment.scheduled_at))}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{appointment.client_name || "Cliente"}</p>
                    <p className="mt-1 truncate text-sm text-zinc-500">
                      {serviceNames.length ? serviceNames.join(", ") : "Serviço não informado"}
                    </p>
                  </div>
                  <span className="hidden shrink-0 rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600 sm:inline-flex">
                    {statusLabel(appointment.status)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl bg-zinc-950 p-5 text-white">
            <p className="text-xs font-medium uppercase tracking-[0.13em] text-zinc-400">Seu espaço de trabalho</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">{barbershop.name}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-300">Seus dados e operações estão limitados ao seu vínculo profissional nesta barbearia.</p>
            {barbershop.slug ? (
              <Link href={`/b/${barbershop.slug}`} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white underline decoration-zinc-600 underline-offset-4 transition-colors hover:decoration-white">
                Página pública da barbearia <ArrowRight size={15} />
              </Link>
            ) : null}
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold">Acesso rápido</h2>
            <div className="mt-3 divide-y divide-zinc-100">
              <Link href="/profissional/agendamentos" className="flex items-center gap-3 py-3 text-sm text-zinc-700 transition-colors hover:text-zinc-950">
                <CalendarDays size={17} className="text-zinc-500" />
                <span className="flex-1">Abrir minha agenda</span>
                <ArrowRight size={15} className="text-zinc-400" />
              </Link>
              <Link href="/profissional/fila" className="flex items-center gap-3 py-3 text-sm text-zinc-700 transition-colors hover:text-zinc-950">
                <Users size={17} className="text-zinc-500" />
                <span className="flex-1">Acompanhar a fila</span>
                <ArrowRight size={15} className="text-zinc-400" />
              </Link>
              <div className="flex items-center gap-3 py-3 text-sm text-zinc-600">
                <Clock3 size={17} className="text-zinc-500" />
                <span className="flex-1">Expediente individual</span>
                <span className="text-[11px] text-zinc-400">Próxima etapa</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <p className="text-xs leading-5 text-zinc-500">
        Sessão iniciada para {user.email || staff.full_name}. Os dados apresentados neste painel usam o vínculo profissional autenticado.
      </p>
    </div>
  );
}

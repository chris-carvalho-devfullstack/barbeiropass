import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Calendar, Clock, DollarSign, Armchair, TrendingUp,
  AlertCircle, ArrowLeft, MonitorPlay, Users, Calculator
} from "lucide-react";

import { EditStaffButton } from "@/components/edit-staff-button";
import { StaffTabsClient } from "./staff-tabs-client";
import { StaffPeriodFilter } from "./staff-period-filter";

export const runtime = "edge";

export const metadata = {
  title: "Painel do Profissional | BarbeiroPass",
};

// ==========================================
// INTERFACES PARA TIPAGEM ESTRITA (NO ANY)
// ==========================================
interface WorkStation {
  name: string;
  status: string;
}

interface StaffServiceCommission {
  commission_percentage: number;
  services: {
    name: string;
  } | null;
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

interface LedgerEntrySummary {
  amount: number;
  transaction_type: string;
}

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  barber: "Barbeiro",
  receptionist: "Recepcionista"
};

export default async function StaffDashboardPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const resolvedParams = await searchParams;
  const targetStaffId = resolvedParams.id as string | undefined;
  
  const period = (resolvedParams.period as string) || "hoje";
  const fromParam = resolvedParams.from as string | undefined;
  const toParam = resolvedParams.to as string | undefined;

  // 1. Verificação de Identidade
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    redirect("/login");
  }

  // 2. Determinar o nível de acesso
  const { data: memberData } = await supabase
    .from("barbershop_members")
    .select("role, barbershop_id")
    .eq("profile_id", user.id)
    .limit(1)
    .single();

  const isManagerLogged = memberData?.role === "owner" || memberData?.role === "manager";

  // REGRA DE SEGURANÇA: Bloqueia acesso não autorizado
  if (targetStaffId && !isManagerLogged) {
    redirect("/equipe/staff");
  }

  // 3. Query buscando os dados do Profissional
  let staffQuery = supabase.from("staff").select(`
    id,
    full_name,
    role,
    payment_model,
    fixed_rental_fee,
    profile_id,
    barbershop_id,
    work_stations (name, status)
  `);

  if (targetStaffId && isManagerLogged) {
    staffQuery = staffQuery.eq("id", targetStaffId).eq("barbershop_id", memberData?.barbershop_id);
  } else {
    staffQuery = staffQuery.eq("profile_id", user.id);
  }

  const { data: staffData, error: staffError } = await staffQuery.single();

  if (staffError || !staffData || (targetStaffId && staffData.barbershop_id !== memberData?.barbershop_id)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum painel encontrado</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
          Não foi possível carregar os dados deste profissional ou você não tem permissão.
        </p>
        {isManagerLogged && (
          <Link href="/equipe">
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4"/> Voltar para Gestão</Button>
          </Link>
        )}
      </div>
    );
  }

  const isViewingOwnProfile = staffData.profile_id === user.id;
  const staffWorkStation = (Array.isArray(staffData.work_stations) ? staffData.work_stations[0] : staffData.work_stations) as unknown as WorkStation | null;
  const isReceptionist = staffData.role === "receptionist";
  
  // Buscar comissões do profissional
  const { data: commissionsRaw } = await supabase
    .from("staff_service_commissions")
    .select("commission_percentage, services ( name )")
    .eq("staff_id", staffData.id);
    
  const staffCommissions = (commissionsRaw as unknown as StaffServiceCommission[]) || [];

  const isAdminOnly = (staffData.role === "owner" || staffData.role === "manager") && !staffWorkStation && staffCommissions.length === 0;

  const isUniformCommission = staffCommissions.length > 0 && staffCommissions.every(c => Number(c.commission_percentage) === Number(staffCommissions[0].commission_percentage));
  const uniformPercentageValue = isUniformCommission ? Number(staffCommissions[0].commission_percentage) : null;

  // Variáveis para Resumo
  let agendamentosAAtender: AppointmentData[] = [];
  let totalGanho = 0;
  let cardSubtitleText = "Total bruto histórico";

  if (!isReceptionist && !isAdminOnly) {
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;
    
    // Lógica Dinâmica de Datas para os Cards baseada no date-fns
    if (period === "hoje") {
      startDate = startOfDay(now).toISOString();
      endDate = endOfDay(now).toISOString();
      cardSubtitleText = "Total ganho hoje";
    } else if (period === "semana") {
      const start = startOfWeek(now, { weekStartsOn: 0 }); // Domingo a Sábado
      const end = endOfWeek(now, { weekStartsOn: 0 });
      startDate = start.toISOString();
      endDate = end.toISOString();
      cardSubtitleText = `Total ganho (${format(start, "dd/MM/yy")} a ${format(end, "dd/MM/yy")})`;
    } else if (period === "mes") {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      startDate = start.toISOString();
      endDate = end.toISOString();
      const nomeMes = format(start, "MMMM", { locale: ptBR });
      cardSubtitleText = `Total ganho em ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)}`;
    } else if (period === "personalizado" && fromParam && toParam) {
      const start = new Date(fromParam);
      const end = new Date(toParam);
      startDate = startOfDay(start).toISOString();
      endDate = endOfDay(end).toISOString();
      cardSubtitleText = `Total ganho (${format(start, "dd/MM/yy")} a ${format(end, "dd/MM/yy")})`;
    } else if (period === "personalizado") {
      cardSubtitleText = "Selecione as datas...";
    }

    // A. APENAS AGENDAMENTOS FUTUROS
    const { data: appointmentsRaw } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, client_name, services (name, price)")
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${staffData.profile_id}`)
      .in("status", ["scheduled", "confirmed"])
      .order("scheduled_at", { ascending: true });

    agendamentosAAtender = (appointmentsRaw as unknown as AppointmentData[]) || [];

    // B. SOMA DE GANHOS COM FILTRO DE DATA APLICADO
    let ledgerQuery = supabase
      .from("staff_financial_ledgers")
      .select("amount, transaction_type")
      .eq("staff_id", staffData.id)
      .in("transaction_type", ["commission_earned", "audit_adjustment"]);
      
    if (startDate) ledgerQuery = ledgerQuery.gte("created_at", startDate);
    if (endDate) ledgerQuery = ledgerQuery.lte("created_at", endDate);

    const { data: ledgerSummary } = await ledgerQuery;
    const ledgers = (ledgerSummary as unknown as LedgerEntrySummary[]) || [];
    totalGanho = ledgers.reduce((acc, curr) => acc + Number(curr.amount), 0);
  }

  // NODE DA AGENDA FUTURA
  const agendaNode = (
    <Card className="border-none shadow-sm bg-background">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-base sm:text-lg">Compromissos Agendados</CardTitle>
        <CardDescription>Lista cronológica de clientes alocados.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
        <Table>
          <TableHeader className="bg-muted/40 sm:bg-transparent">
            <TableRow>
              <TableHead className="w-25">Horário</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agendamentosAAtender.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm italic">
                  Nenhum compromisso futuro agendado.
                </TableCell>
              </TableRow>
            ) : (
              agendamentosAAtender.map((ap) => {
                const serviceInfo = ap.services;
                const scheduledDate = new Date(ap.scheduled_at);
                const timeString = scheduledDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
                const dateString = scheduledDate.toLocaleDateString("pt-BR");

                return (
                  <TableRow key={ap.id} className="hover:bg-muted/20">
                    <TableCell className="font-semibold text-primary">{timeString}</TableCell>
                    <TableCell className="text-sm">{dateString}</TableCell>
                    <TableCell className="font-medium text-sm">{ap.client_name || "---"}</TableCell>
                    <TableCell className="text-sm">{serviceInfo?.name || "Serviço pendente"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {isManagerLogged ? (
                        <Link href="/agendamentos">
                          <Button variant="outline" size="sm">Modificar</Button>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-xs">Apenas Leitura</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      
      {/* HEADER: INFORMAÇÕES DO STAFF E BARRA DE FERRAMENTAS */}
      <div className="flex flex-col space-y-4 lg:flex-row lg:justify-between lg:items-start lg:space-y-0 border-b pb-6">
        <div className="shrink-0">
          {isManagerLogged && !isViewingOwnProfile && (
            <Link href="/equipe" className="text-xs text-muted-foreground flex items-center mb-2 hover:text-primary transition-colors">
              <ArrowLeft className="mr-1 h-3 w-3" /> Voltar para a gestão
            </Link>
          )}
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {isViewingOwnProfile ? `Olá, ${staffData.full_name}` : `Painel de ${staffData.full_name}`}
            </h2>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700 hidden sm:flex">
              {roleLabels[staffData.role] || "Profissional"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isReceptionist ? "Seu painel de controle operacional." : "Métricas de desempenho e extrato financeiro."}
          </p>
        </div>

        {/* NOVA BARRA DE FERRAMENTAS: LINHA ÚNICA RESPONSIVA (CARROSSEL NO MOBILE) */}
        <div className="flex flex-row items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          
          {/* 1. Bancada */}
          {!isReceptionist && !isAdminOnly && (
            <div className="flex items-center gap-2 bg-muted/40 border border-border text-foreground px-3 h-10 rounded-md shadow-sm shrink-0">
              <Armchair className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium whitespace-nowrap">
                {staffWorkStation ? staffWorkStation.name : "Sem bancada"}
              </span>
            </div>
          )}

          {/* 2. Filtro de Período */}
          {!isReceptionist && !isAdminOnly && (
            <div className="shrink-0">
              <StaffPeriodFilter />
            </div>
          )}

          {/* 3. Configurar Contrato */}
          {isManagerLogged && (
            <div className="shrink-0">
              <EditStaffButton staffId={staffData.id} />
            </div>
          )}
        </div>
      </div>

      {/* VISÃO ESPECÍFICA: RECEPCIONISTA */}
      {isReceptionist && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Card className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer">
            <Link href="/pdv" className="block h-full">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full gap-4">
                <div className="p-4 bg-emerald-100 text-emerald-600 rounded-full">
                  <Calculator className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Caixa / PDV</h3>
                  <p className="text-sm text-muted-foreground">Finalizar serviços e vendas</p>
                </div>
              </CardContent>
            </Link>
          </Card>
          
          <Card className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer">
            <Link href="/agendamentos" className="block h-full">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full gap-4">
                <div className="p-4 bg-blue-100 text-blue-600 rounded-full">
                  <Calendar className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Agenda da Equipe</h3>
                  <p className="text-sm text-muted-foreground">Visualizar todos os horários</p>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="hover:border-primary/50 transition-colors shadow-sm cursor-pointer">
            <Link href="/fila" className="block h-full">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center h-full gap-4">
                <div className="p-4 bg-purple-100 text-purple-600 rounded-full">
                  <Users className="size-8" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Fila Virtual</h3>
                  <p className="text-sm text-muted-foreground">Gerenciar clientes na espera</p>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>
      )}

      {/* VISÃO ESPECÍFICA: ADMINISTRADOR (Sem cadeira) */}
      {!isReceptionist && isAdminOnly && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <MonitorPlay className="size-12 text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-700">Perfil Administrativo</h3>
            <p className="text-slate-500 mt-2 max-w-md">
              Você atua exclusivamente na gestão da barbearia. Como não possui uma bancada de trabalho nem comissões atribuídas, seu painel operacional está desativado.
            </p>
            <Link href="/dashboard">
              <Button className="mt-6">Ir para o Dashboard Geral</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* VISÃO ESPECÍFICA: PROFISSIONAL/BARBEIRO */}
      {!isReceptionist && !isAdminOnly && (
        <>
          {/* CARDS DE RESUMO SUPERIOR */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            
            {/* CARD 1: Comissões */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <CardTitle className="text-sm font-medium tracking-wide">Comissões Acumuladas</CardTitle>
                <DollarSign className={`h-4 w-4 ${totalGanho < 0 ? 'text-rose-500' : 'text-emerald-500'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalGanho < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  R$ {totalGanho.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {cardSubtitleText}
                </p>
              </CardContent>
            </Card>

            {/* CARD 2: Comissionamento */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <CardTitle className="text-sm font-medium tracking-wide">Comissionamento</CardTitle>
                <TrendingUp className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                {staffData.payment_model === "fixed_fee" ? (
                  <>
                    <div className="text-2xl font-bold text-rose-600">
                      R$ {Number(staffData.fixed_rental_fee || 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Taxa Fixa Mensal</p>
                  </>
                ) : isUniformCommission ? (
                  <>
                    <div className="text-2xl font-bold text-emerald-600">
                      {uniformPercentageValue}%
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                      Para todos os serviços
                    </p>
                  </>
                ) : (
                  <div className="flex flex-col gap-1.5 mt-1 max-h-16 overflow-y-auto pr-2 custom-scrollbar">
                    {staffCommissions.length > 0 ? (
                      staffCommissions.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center border-b border-border/40 pb-1 last:border-0 last:pb-0">
                          <span className="text-xs text-muted-foreground truncate pr-2" title={c.services?.name || "Serviço"}>
                            {c.services?.name || "Serviço"}
                          </span>
                          <span className="text-sm font-bold text-emerald-600">
                            {Number(c.commission_percentage)}%
                          </span>
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="text-xl font-bold text-muted-foreground">Pendente</div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Sem comissões configuradas.</p>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CARD 3: Próximos Serviços */}
            <Card className="shadow-sm sm:col-span-2 lg:col-span-1">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <CardTitle className="text-sm font-medium tracking-wide">Próximos Serviços</CardTitle>
                <Clock className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agendamentosAAtender.length}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Pendentes na agenda</p>
              </CardContent>
            </Card>
          </div>

          {/* AS ABAS INTERATIVAS */}
          <StaffTabsClient 
            staffId={staffData.id} 
            isManager={isManagerLogged} 
            agendaNode={agendaNode} 
          />
        </>
      )}
    </div>
  );
}
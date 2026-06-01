import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { 
  Calendar, Clock, DollarSign, Armchair, TrendingUp, CheckCircle2, 
  AlertCircle, History, ArrowLeft, MonitorPlay, Users, Calculator
} from "lucide-react";

import { EditStaffButton } from "@/components/edit-staff-button";

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

interface LedgerEntry {
  id: string;
  created_at: string;
  transaction_type: string;
  amount: number;
  description: string | null;
}

// Histórico Híbrido Unificado (Fila + Agenda + PDV)
interface UnifiedHistoryEntry {
  id: string;
  date: string;
  client_name: string;
  service_name: string;
  price: number | null;
  is_paid: boolean;
  source_type: "Fila Virtual" | "Agenda" | "Caixa (PDV)";
}

// ATUALIZADO: Agora reflete as novas colunas da arquitetura robusta
interface PosItemData {
  id: string;
  unit_price: number;
  services: { name: string } | null;
  pos_orders: { created_at: string; customer_name: string | null; source_type: string | null } | null;
}

interface PendingApptData {
  id: string;
  scheduled_at: string;
  client_name: string | null;
  services: { name: string; price: number } | null;
}

interface PendingQueueData {
  id: string;
  joined_at: string;
  client_name: string | null;
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

  if (staffError || !staffData) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center min-h-100">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Nenhum painel encontrado</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-1 mb-6">
          Não foi possível carregar os dados deste profissional.
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
  const staffWorkStation = staffData.work_stations as unknown as WorkStation | null;
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

  // Variáveis para as abas
  let agendamentosAAtender: AppointmentData[] = [];
  let historicoAtendidos: UnifiedHistoryEntry[] = [];
  let financialLedger: LedgerEntry[] = [];
  let totalGanho = 0;

  if (!isReceptionist && !isAdminOnly) {
    // =========================================================================
    // A. APENAS AGENDAMENTOS FUTUROS (Aba Agenda)
    // =========================================================================
    const { data: appointmentsRaw } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, client_name, services (name, price)")
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${staffData.profile_id}`)
      .in("status", ["scheduled", "confirmed"])
      .order("scheduled_at", { ascending: true });

    agendamentosAAtender = (appointmentsRaw as unknown as AppointmentData[]) || [];

    // =========================================================================
    // B. HISTÓRICO HÍBRIDO (PAGOS VIA PDV + PENDENTES NA CADEIRA)
    // =========================================================================
    
    // B1. ITENS PAGOS - Consulta blindada direto do PDV (ARQUITETURA ENTERPRISE)
    // Sem necessidade de mapear clientes ou perfis, pois o nome e origem já estão na pos_orders
    const { data: posItemsRaw } = await supabase
      .from("pos_order_items")
      .select(`
        id,
        unit_price,
        services ( name ),
        pos_orders ( created_at, customer_name, source_type )
      `)
      .eq("barber_id", staffData.id)
      .eq("item_type", "service");

    const posItems = (posItemsRaw as unknown as PosItemData[]) || [];

    const paidHistory: UnifiedHistoryEntry[] = posItems.map(item => ({
      id: item.id,
      date: item.pos_orders?.created_at || new Date().toISOString(),
      client_name: item.pos_orders?.customer_name || "Cliente Avulso",
      service_name: item.services?.name || "Serviço Avulso",
      price: Number(item.unit_price) || 0,
      is_paid: true,
      source_type: item.pos_orders?.source_type === 'queue' ? "Fila Virtual" : item.pos_orders?.source_type === 'appointment' ? "Agenda" : "Caixa (PDV)"
    }));

    // B2. ITENS PENDENTES - Agenda
    const { data: pendingApptsRaw } = await supabase
      .from("appointments")
      .select("id, scheduled_at, client_name, services (name, price)")
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${staffData.profile_id}`)
      .in("status", ["awaiting_payment", "finished"]);

    const pendingApptHistory: UnifiedHistoryEntry[] = ((pendingApptsRaw as unknown as PendingApptData[]) || []).map(a => ({
      id: a.id,
      date: a.scheduled_at,
      client_name: a.client_name || "Cliente Avulso",
      service_name: a.services?.name || "Serviço de Agenda",
      price: a.services?.price ? Number(a.services.price) : null,
      is_paid: false,
      source_type: "Agenda"
    }));

    // B3. ITENS PENDENTES - Fila Virtual
    const { data: pendingQueueRaw } = await supabase
      .from("virtual_queue")
      .select("id, joined_at, client_name")
      .or(`barber_id.eq.${staffData.id},barber_id.eq.${staffData.profile_id}`)
      .in("status", ["awaiting_payment", "finished"]);

    const pendingQueueHistory: UnifiedHistoryEntry[] = ((pendingQueueRaw as unknown as PendingQueueData[]) || []).map(q => ({
      id: q.id,
      date: q.joined_at,
      client_name: q.client_name || "Cliente da Fila",
      service_name: "Atendimento da Fila",
      price: null,
      is_paid: false,
      source_type: "Fila Virtual"
    }));

    // Mescla todas as fontes e ordena por data
    historicoAtendidos = [...paidHistory, ...pendingApptHistory, ...pendingQueueHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // =========================================================================
    // C. EXTRATO FINANCEIRO (Aba Relatórios)
    // =========================================================================
    const { data: ledgerEntriesRaw } = await supabase
      .from("staff_financial_ledgers")
      .select("*")
      .eq("staff_id", staffData.id)
      .order("created_at", { ascending: false });

    financialLedger = (ledgerEntriesRaw as unknown as LedgerEntry[]) || [];
    
    totalGanho = financialLedger
      .filter(item => item.transaction_type === "commission_earned")
      .reduce((acc, curr) => acc + Number(curr.amount), 0);
  }

  return (
    <div className="flex flex-col space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto w-full">
      
      <div className="flex flex-col space-y-4 md:flex-row md:justify-between md:items-center md:space-y-0 border-b pb-6">
        <div>
          {isManagerLogged && !isViewingOwnProfile && (
            <Link href="/equipe" className="text-xs text-muted-foreground flex items-center mb-2 hover:text-primary transition-colors">
              <ArrowLeft className="mr-1 h-3 w-3" /> Voltar para a gestão
            </Link>
          )}
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              {isViewingOwnProfile ? `Olá, ${staffData.full_name}` : `Painel de ${staffData.full_name}`}
            </h2>
            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
              {roleLabels[staffData.role] || "Profissional"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isReceptionist ? "Seu painel de controle operacional." : "Métricas de desempenho e extrato financeiro."}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {!isReceptionist && !isAdminOnly && (
            <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl border border-border/60">
              <div className="p-2 bg-background rounded-lg border shadow-sm">
                <Armchair className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bancada</p>
                <p className="text-sm font-bold text-foreground">
                  {staffWorkStation ? staffWorkStation.name : "Nenhuma Atribuída"}
                </p>
              </div>
            </div>
          )}
          {isManagerLogged && <EditStaffButton staffId={staffData.id} />}
        </div>
      </div>

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

      {!isReceptionist && !isAdminOnly && (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <CardTitle className="text-sm font-medium tracking-wide">Comissões Acumuladas</CardTitle>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">R$ {totalGanho.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground mt-0.5">Total bruto distribuído</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-5">
                <CardTitle className="text-sm font-medium tracking-wide">Retenções contratuais</CardTitle>
                <TrendingUp className="h-4 w-4 text-rose-500" />
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
                      Para <span className="underline decoration-emerald-200">todos</span> os serviços
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

          <Tabs defaultValue="historico" className="space-y-4 w-full">
            <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/80 p-1 rounded-xl">
              <TabsTrigger value="agenda" className="rounded-lg gap-2 text-xs sm:text-sm">
                <Calendar className="h-4 w-4 hidden sm:inline" /> Agenda
              </TabsTrigger>
              <TabsTrigger value="historico" className="rounded-lg gap-2 text-xs sm:text-sm">
                <History className="h-4 w-4 hidden sm:inline" /> Histórico
              </TabsTrigger>
              <TabsTrigger value="financeiro" className="rounded-lg gap-2 text-xs sm:text-sm">
                <DollarSign className="h-4 w-4 hidden sm:inline" /> Relatórios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agenda" className="space-y-4">
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
                              <TableCell className="text-sm">
                                {serviceInfo?.name || "Serviço pendente"}
                              </TableCell>
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
            </TabsContent>

            <TabsContent value="historico" className="space-y-4">
              <Card className="border-none shadow-sm bg-background">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="text-base sm:text-lg">Atendimentos e Vendas</CardTitle>
                  <CardDescription>Acompanhe tudo que você realizou e se os clientes já pagaram no caixa.</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
                  <Table>
                    <TableHeader className="bg-muted/40 sm:bg-transparent">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Serviço</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Situação Caixa</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicoAtendidos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm italic">
                            Nenhum registo histórico encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        historicoAtendidos.map((item) => {
                          const scheduledDate = new Date(item.date);
                          const timeString = scheduledDate.toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' });
                          const dateString = scheduledDate.toLocaleDateString("pt-BR");

                          return (
                            <TableRow key={item.id} className="hover:bg-muted/20">
                              <TableCell className="text-sm">
                                {dateString} - {timeString}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold">
                                  {item.source_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-bold text-sm text-slate-700">{item.client_name}</TableCell>
                              <TableCell className="font-medium text-sm text-slate-500">
                                {item.service_name}
                              </TableCell>
                              <TableCell className="text-right font-medium text-slate-400">
                                {item.price !== null ? `R$ ${item.price.toFixed(2)}` : <span className="text-xs">---</span>}
                              </TableCell>
                              <TableCell className="text-right">
                                {item.is_paid ? (
                                  <div className="inline-flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/50 shadow-sm">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-1.5 text-amber-600 font-bold text-xs bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/50 shadow-sm">
                                    <Clock className="h-3.5 w-3.5" /> Pendente
                                  </div>
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
            </TabsContent>

            <TabsContent value="financeiro" className="space-y-4">
              <Card className="border-none shadow-sm bg-background">
                <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg">Livro Razão de Lançamentos</CardTitle>
                    <CardDescription>Extrato contábil detalhado.</CardDescription>
                  </div>
                  {isManagerLogged && (
                    <Link href="/pdv">
                      <Button size="sm" variant="outline">
                        <DollarSign className="h-4 w-4 mr-2" /> Lançamento Manual
                      </Button>
                    </Link>
                  )}
                </CardHeader>
                <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
                  <Table>
                    <TableHeader className="bg-muted/40 sm:bg-transparent">
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Operação</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Repasse</TableHead>
                        {isManagerLogged && <TableHead className="text-right w-16">Auditar</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {financialLedger.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={isManagerLogged ? 5 : 4} className="text-center py-8 text-muted-foreground text-sm italic">
                            Nenhuma transação contábil registada.
                          </TableCell>
                        </TableRow>
                      ) : (
                        financialLedger.map((record) => (
                          <TableRow key={record.id} className="hover:bg-muted/20">
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(record.created_at).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={record.amount > 0 ? "outline" : "destructive"}
                                className={record.amount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}
                              >
                                {record.transaction_type === "commission_earned" && "Comissão"}
                                {record.transaction_type === "chair_rental_fee" && "Aluguer"}
                                {record.transaction_type === "payout_withdrawal" && "Saque"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm font-medium max-w-60 truncate">
                              {record.description}
                            </TableCell>
                            <TableCell className={`text-right font-semibold ${Number(record.amount) > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {Number(record.amount) > 0 ? "+" : ""}R$ {Number(record.amount).toFixed(2)}
                            </TableCell>
                            {isManagerLogged && (
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                  <AlertCircle className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
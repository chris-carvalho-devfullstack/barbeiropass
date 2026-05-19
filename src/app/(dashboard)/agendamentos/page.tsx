// src/app/(dashboard)/agendamentos/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Calendar, Loader2, CheckCircle, XCircle, UserX, Clock } from "lucide-react";
import { toast } from "sonner";
import { getAppointmentsAction, updateAppointmentStatusAction } from "./actions";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog";

// Tipagem exata baseada na nossa Server Action
type AppointmentData = {
  id: string;
  scheduled_at: string;
  status: string;
  client_name: string;
  client_phone: string | null;
  services: {
    name: string;
    price: number;
    duration_minutes: number;
  } | null;
};

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAgendamentos() {
    setLoading(true);
    const res = await getAppointmentsAction();
    if (res.error) {
      toast.error(res.error);
    } else if (res.data) {
      // O TypeScript sabe exatamente o formato do dado agora
      setAgendamentos(res.data as unknown as AppointmentData[]);
    }
    setLoading(false);
  }

  async function updateStatus(id: string, novoStatus: string) {
    const toastId = toast.loading("Atualizando status...");
    const res = await updateAppointmentStatusAction(id, novoStatus);

    if (res.error) {
      toast.error(res.error, { id: toastId });
    } else {
      toast.success("Status atualizado com sucesso!", { id: toastId });
      fetchAgendamentos(); 
    }
  }

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const formatarDataHora = (isoString: string) => {
    const data = new Date(isoString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    }).format(data);
  };

  // Badges super modernos para o Light Mode
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200 shadow-sm"><Clock className="h-3 w-3 mr-1"/> Agendado</Badge>;
      case "completed":
        return <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm"><CheckCircle className="h-3 w-3 mr-1"/> Concluído</Badge>;
      case "cancelled":
        return <Badge className="bg-slate-100 text-slate-600 border-slate-200 shadow-sm"><XCircle className="h-3 w-3 mr-1"/> Cancelado</Badge>;
      case "no_show":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200 shadow-sm"><UserX className="h-3 w-3 mr-1"/> Faltou</Badge>;
      default:
        return <Badge variant="outline" className="bg-slate-50 text-slate-600">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 bg-slate-50 min-h-[calc(100vh-4rem)]">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
            <Calendar className="size-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Agenda</h2>
            <p className="text-sm text-slate-500 font-medium">Controle os horários e serviços do salão.</p>
          </div>
        </div>
        <CreateAppointmentDialog onAppointmentCreated={fetchAgendamentos} />
      </div>

      {/* Tabela Branca (Light Mode Force) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center py-24 gap-3">
            <Loader2 className="size-8 animate-spin text-blue-500" />
            <p className="text-slate-500 font-medium">Carregando horários...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 border-b border-slate-100">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-slate-700">Data / Hora</TableHead>
                  <TableHead className="font-bold text-slate-700">Cliente</TableHead>
                  <TableHead className="font-bold text-slate-700">Serviço</TableHead>
                  <TableHead className="font-bold text-slate-700">Status</TableHead>
                  <TableHead className="w-[180px] text-right font-bold text-slate-700">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agendamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-slate-400 font-medium">
                      Nenhum agendamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  agendamentos.map((ag) => (
                    <TableRow key={ag.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="font-bold text-slate-900">
                        {formatarDataHora(ag.scheduled_at)}
                      </TableCell>
                      
                      <TableCell>
                        <p className="font-bold text-slate-800">{ag.client_name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {ag.client_phone || "Sem telefone"}
                        </p>
                      </TableCell>
                      
                      <TableCell>
                        {ag.services ? (
                          <>
                            <p className="font-bold text-slate-800">{ag.services.name}</p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-medium">
                              <span>{ag.services.duration_minutes} min</span>
                              <span>•</span>
                              <span className="text-emerald-600 font-bold">{ag.services.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-sm">Serviço avulso</span>
                        )}
                      </TableCell>

                      <TableCell>{getStatusBadge(ag.status)}</TableCell>
                      
                      <TableCell className="text-right">
                        {ag.status === "scheduled" && (
                          <div className="flex justify-end gap-1">
                            {/* Concluir */}
                            <Button
                              variant="ghost" size="icon"
                              className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-9 w-9 rounded-lg"
                              title="Marcar como Concluído"
                              onClick={() => updateStatus(ag.id, "completed")}
                            >
                              <CheckCircle className="size-4" />
                            </Button>
                            {/* Faltou */}
                            <Button
                              variant="ghost" size="icon"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-9 w-9 rounded-lg"
                              title="Não Compareceu"
                              onClick={() => updateStatus(ag.id, "no_show")}
                            >
                              <UserX className="size-4" />
                            </Button>
                            {/* Cancelar */}
                            <Button
                              variant="ghost" size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-9 w-9 rounded-lg"
                              title="Cancelar Horário"
                              onClick={() => updateStatus(ag.id, "cancelled")}
                            >
                              <XCircle className="size-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
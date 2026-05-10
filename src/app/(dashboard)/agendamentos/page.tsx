"use client";

// 1. Blindagem da Cloudflare
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Calendar, Loader2, CheckCircle, XCircle, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateAppointmentDialog } from "@/components/create-appointment-dialog";

interface Agendamento {
  id: string;
  data_hora: string;
  status: string;
  clientes: { nome: string; telefone: string };
  servicos: { nome: string; preco: string; tempo: string };
}

export default function AgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAgendamentos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("agendamentos")
        .select(
          `
          id, data_hora, status,
          clientes ( nome, telefone ),
          servicos ( nome, preco, tempo )
        `,
        )
        .order("data_hora", { ascending: true });

      if (error) throw error;
      setAgendamentos((data as any) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar a agenda.");
    } finally {
      setLoading(false);
    }
  }

  // NOVA FUNÇÃO: Atualiza o status no banco de dados
  async function updateStatus(id: string, novoStatus: string) {
    const toastId = toast.loading(`Atualizando para ${novoStatus}...`);

    const { error } = await supabase
      .from("agendamentos")
      .update({ status: novoStatus })
      .eq("id", id);

    if (error) {
      console.error(error);
      toast.error("Erro ao atualizar status.", { id: toastId });
      return;
    }

    toast.success(`Status atualizado para ${novoStatus}`, { id: toastId });
    fetchAgendamentos(); // Recarrega a lista para refletir a mudança
  }

  useEffect(() => {
    fetchAgendamentos();
  }, []);

  const formatarDataHora = (isoString: string) => {
    const data = new Date(isoString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Agendado":
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            Agendado
          </Badge>
        );
      case "Concluído":
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            Concluído
          </Badge>
        );
      case "Cancelado":
        return (
          <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Cancelado
          </Badge>
        );
      case "Faltou":
        return <Badge variant="destructive">Faltou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    // 2. Animação de entrada
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Suporte a Dark Mode no ícone */}
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <Calendar className="size-5 text-zinc-700 dark:text-zinc-300" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Agenda</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Controle os horários e serviços do dia.
            </p>
          </div>
        </div>
        <CreateAppointmentDialog onAppointmentCreated={fetchAgendamentos} />
      </div>

      {/* Suporte a Dark Mode na Tabela */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-2">
            <Loader2 className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Serviço</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[150px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agendamentos.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-10 text-zinc-500 dark:text-zinc-400"
                  >
                    Agenda vazia no momento.
                  </TableCell>
                </TableRow>
              ) : (
                agendamentos.map((ag) => (
                  <TableRow key={ag.id}>
                    <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formatarDataHora(ag.data_hora)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{ag.clientes?.nome}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {ag.clientes?.telefone}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{ag.servicos?.nome}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {ag.servicos?.tempo} min
                      </p>
                    </TableCell>
                    <TableCell className="font-medium text-zinc-900 dark:text-zinc-100">
                      R$ {ag.servicos?.preco}
                    </TableCell>
                    <TableCell>{getStatusBadge(ag.status)}</TableCell>
                    <TableCell className="text-right">
                      {ag.status === "Agendado" && (
                        <div className="flex justify-end gap-1">
                          {/* BOTÃO CONCLUIR */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 dark:text-emerald-500"
                            title="Concluir Serviço"
                            onClick={() => updateStatus(ag.id, "Concluído")}
                          >
                            <CheckCircle className="size-4" />
                          </Button>

                          {/* BOTÃO FALTOU */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/30 dark:text-orange-500"
                            title="Não Compareceu"
                            onClick={() => updateStatus(ag.id, "Faltou")}
                          >
                            <UserX className="size-4" />
                          </Button>

                          {/* BOTÃO CANCELAR */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 dark:text-red-500"
                            title="Cancelar Horário"
                            onClick={() => updateStatus(ag.id, "Cancelado")}
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
        )}
      </div>
    </div>
  );
}
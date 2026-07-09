// src/components/appointment-details-dialog.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { toast } from "sonner";
import { 
  CalendarClock, Scissors, UserCircle2, X, Trash2, 
  UserX, CheckCircle2, Clock, Wallet, AlertCircle, Edit
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Replicando a tipagem para o componente
type AppointmentData = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "canceled" | "awaiting_payment";
  client_name: string;
  client_phone: string | null;
  services: { name: string; price: number; duration_minutes: number; } | null;
  staff: { profiles: { full_name: string | null } | { full_name: string | null }[] | null } | null;
};

interface AppointmentDetailsProps {
  appointment: AppointmentData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function AppointmentDetailsDialog({ appointment, isOpen, onClose, onUpdate }: AppointmentDetailsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!appointment) return null;

  const dataHora = new Date(appointment.scheduled_at);
  const dataFormatada = format(dataHora, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
  
  // Helper do barbeiro
  const barberName = Array.isArray(appointment.staff?.profiles) 
    ? appointment.staff?.profiles[0]?.full_name 
    : appointment.staff?.profiles?.full_name;

  // Função para atualizar o status (PATCH)
  const handleUpdateStatus = async (newStatus: AppointmentData["status"], successMessage: string) => {
    setIsUpdating(true);
    const toastId = toast.loading("A atualizar...");
    try {
      const res = await fetch(`/api/agendamentos/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Falha ao atualizar estado.");
      toast.success(successMessage, { id: toastId });
      onUpdate();
      onClose();
    } catch (error) {
      toast.error("Erro ao atualizar o agendamento.", { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  // Função para excluir (DELETE)
  const handleDelete = async () => {
    if (!confirm("Tem a certeza que deseja excluir este agendamento permanentemente?")) return;
    
    setIsDeleting(true);
    const toastId = toast.loading("A excluir...");
    try {
      const res = await fetch(`/api/agendamentos/${appointment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      toast.success("Agendamento excluído com sucesso.", { id: toastId });
      onUpdate();
      onClose();
    } catch (error) {
      toast.error("Erro ao excluir o registro.", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  // Renderizador da Tag de Status Visual
  const renderStatusBadge = () => {
    const s = appointment.status;
    if (s === "scheduled") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none"><Clock className="w-3 h-3 mr-1"/> Agendado</Badge>;
    if (s === "in_progress") return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none"><Scissors className="w-3 h-3 mr-1"/> Na Cadeira</Badge>;
    if (s === "awaiting_payment") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"><Wallet className="w-3 h-3 mr-1"/> Aguardando Pagamento</Badge>;
    if (s === "completed") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> Concluído</Badge>;
    if (s === "canceled") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none"><X className="w-3 h-3 mr-1"/> Cancelado / Falta</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white border-none shadow-2xl rounded-3xl">
        
        {/* Cabeçalho Premium */}
        <div className="bg-slate-50 p-6 pb-5 border-b border-slate-100">
          <div className="flex justify-between items-start mb-4">
            {renderStatusBadge()}
            <DialogDescription className="sr-only">Detalhes do Agendamento</DialogDescription>
          </div>
          <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
            {appointment.client_name}
          </DialogTitle>
          {appointment.client_phone && (
            <p className="text-slate-500 text-sm mt-1 font-medium">{appointment.client_phone}</p>
          )}
        </div>

        {/* Corpo do Modal (Informações) */}
        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 text-slate-700">
            <div className="bg-blue-50 p-2.5 rounded-xl"><CalendarClock className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Data e Hora</p>
              <p className="font-bold capitalize">{dataFormatada}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-700">
            <div className="bg-slate-100 p-2.5 rounded-xl"><UserCircle2 className="w-5 h-5 text-slate-600" /></div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Profissional</p>
              <p className="font-bold">{barberName || "Não atribuído"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-700">
            <div className="bg-slate-100 p-2.5 rounded-xl"><Scissors className="w-5 h-5 text-slate-600" /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Serviço</p>
              <div className="flex justify-between items-center w-full">
                <p className="font-bold">{appointment.services?.name || "Serviço Avulso"}</p>
                <p className="font-black text-blue-600">
                  {appointment.services?.price ? `R$ ${appointment.services.price.toFixed(2)}` : "--"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-slate-100" />

        {/* Ações Inteligentes Baseadas no Status */}
        <div className="p-6 bg-slate-50 flex flex-col gap-3">
          
          {/* Se estiver agendado, botão principal é INICIAR */}
          {appointment.status === "scheduled" && (
            <Button 
              onClick={() => handleUpdateStatus("in_progress", "Atendimento Iniciado!")} 
              disabled={isUpdating}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md"
            >
              <Scissors className="w-4 h-4 mr-2" /> Iniciar Atendimento
            </Button>
          )}

          {/* Se estiver na cadeira, botão principal é COBRAR/FINALIZAR */}
          {appointment.status === "in_progress" && (
            <Button 
              onClick={() => handleUpdateStatus("awaiting_payment", "Enviado para o Caixa!")} 
              disabled={isUpdating}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md"
            >
              <Wallet className="w-4 h-4 mr-2" /> Finalizar e Cobrar
            </Button>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            <Button 
              variant="outline" 
              onClick={() => toast.info("Edição completa será liberada em breve.")}
              className="h-11 rounded-xl font-bold text-slate-600 border-slate-200"
            >
              <Edit className="w-4 h-4 mr-2" /> Alterar
            </Button>
            
            {/* Botão de Não Compareceu (Falta) */}
            {appointment.status === "scheduled" && (
              <Button 
                variant="outline" 
                disabled={isUpdating}
                onClick={() => handleUpdateStatus("canceled", "Marcado como não compareceu.")}
                className="h-11 rounded-xl font-bold text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100 hover:text-amber-800"
              >
                <UserX className="w-4 h-4 mr-2" /> Faltou
              </Button>
            )}
            
            {/* Excluir Permanentemente */}
            <Button 
              variant="outline" 
              disabled={isDeleting}
              onClick={handleDelete}
              className={cn("h-11 rounded-xl font-bold text-red-600 bg-red-50 border-red-200 hover:bg-red-100 hover:text-red-700", appointment.status !== "scheduled" && "col-span-2")}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </Button>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
// src/components/appointment-details-dialog.tsx
"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { toast } from "sonner";
import { 
  CalendarClock, Scissors, UserCircle2, X, Trash2, 
  UserX, CheckCircle2, Clock, Wallet, Edit, AlertCircle 
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// Tipagem atualizada: agora 'services' é um Array de objetos
export type AppointmentData = {
  id: string;
  scheduled_at: string;
  status: "scheduled" | "in_progress" | "completed" | "canceled" | "awaiting_payment" | "no_show";
  client_name: string;
  client_phone: string | null;
  client_avatar?: string | null;
  services: { id: string; name: string; price: number; duration_minutes: number; }[];
  staff: { profiles: { full_name: string | null } | { full_name: string | null }[] | null } | null;
};

interface AppointmentDetailsProps {
  appointment: AppointmentData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onEdit?: (appointment: AppointmentData) => void;
}

export function AppointmentDetailsDialog({ appointment, isOpen, onClose, onUpdate, onEdit }: AppointmentDetailsProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);

  if (!appointment) return null;

  const dataHora = new Date(appointment.scheduled_at);
  const dataFormatada = format(dataHora, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR });
  
  const barberName = Array.isArray(appointment.staff?.profiles) 
    ? appointment.staff?.profiles[0]?.full_name 
    : appointment.staff?.profiles?.full_name;

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
    } catch {
      toast.error("Erro ao atualizar o agendamento.", { id: toastId });
    } finally {
      setIsUpdating(false);
    }
  };

  const executeDelete = async () => {
    setIsDeleting(true);
    const toastId = toast.loading("A excluir agendamento...");
    try {
      const res = await fetch(`/api/agendamentos/${appointment.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      toast.success("Agendamento excluído com sucesso.", { id: toastId });
      onUpdate();
      setShowDeleteAlert(false);
      onClose();
    } catch {
      toast.error("Erro ao excluir o registro.", { id: toastId });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderStatusBadge = () => {
    const s = appointment.status;
    if (s === "scheduled") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none"><Clock className="w-3 h-3 mr-1"/> Agendado</Badge>;
    if (s === "in_progress") return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none"><Scissors className="w-3 h-3 mr-1"/> Na Cadeira</Badge>;
    if (s === "awaiting_payment") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"><Wallet className="w-3 h-3 mr-1"/> Aguardando Pagamento</Badge>;
    if (s === "completed") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> Concluído</Badge>;
    if (s === "canceled") return <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none"><X className="w-3 h-3 mr-1"/> Cancelado</Badge>;
    if (s === "no_show") return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none"><UserX className="w-3 h-3 mr-1"/> Não Compareceu</Badge>;
  };

  const fallbackImage = "https://avatars.githubusercontent.com/u/124599?v=4";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-105 p-0 overflow-hidden bg-white border-none shadow-2xl rounded-3xl">
          
          <div className="bg-slate-50 p-6 pb-5 border-b border-slate-100">
            <div className="flex justify-between items-start mb-4">
              {renderStatusBadge()}
              <DialogDescription className="sr-only">Detalhes do Agendamento</DialogDescription>
            </div>
            
            <div className="flex items-center gap-4 mt-2">
              <Avatar className="h-16 w-16 border-2 border-white shadow-md">
                <AvatarImage src={appointment.client_avatar || fallbackImage} alt={appointment.client_name} />
                <AvatarFallback className="bg-slate-200 text-slate-600 font-bold">
                  {appointment.client_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <DialogTitle className="text-2xl font-black text-slate-900 leading-tight">
                  {appointment.client_name}
                </DialogTitle>
                {appointment.client_phone ? (
                  <p className="text-slate-500 text-sm mt-0.5 font-medium">{appointment.client_phone}</p>
                ) : (
                  <p className="text-slate-400 text-sm mt-0.5 italic">Sem contato cadastrado</p>
                )}
              </div>
            </div>
          </div>

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

            <div className="flex items-start gap-3 text-slate-700">
              <div className="bg-slate-100 p-2.5 rounded-xl mt-1"><Scissors className="w-5 h-5 text-slate-600" /></div>
              <div className="flex-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Serviços</p>
                
                {appointment.services && appointment.services.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {appointment.services.map((srv, idx) => (
                      <div key={idx} className="flex justify-between items-center w-full border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                        <p className="font-bold text-sm">{srv.name}</p>
                        <p className="font-bold text-slate-600 text-sm">
                          {srv.price != null ? `R$ ${srv.price.toFixed(2)}` : "--"}
                        </p>
                      </div>
                    ))}
                    <div className="flex justify-between items-center w-full mt-2 pt-2 border-t-2 border-slate-100">
                      <p className="font-black text-slate-800">Total Estimado</p>
                      <p className="font-black text-blue-600 text-lg">
                        R$ {appointment.services.reduce((acc, curr) => acc + (curr.price || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="font-bold text-slate-500 italic">Nenhum serviço registrado</p>
                )}
              </div>
            </div>
          </div>

          <Separator className="bg-slate-100" />

          <div className="p-6 bg-slate-50 flex flex-col gap-3">
            
            {appointment.status === "scheduled" && (
              <Button 
                onClick={() => handleUpdateStatus("in_progress", "Atendimento Iniciado!")} 
                disabled={isUpdating}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all"
              >
                <Scissors className="w-4 h-4 mr-2" /> Iniciar Atendimento
              </Button>
            )}

            {appointment.status === "in_progress" && (
              <Button 
                onClick={() => handleUpdateStatus("awaiting_payment", "Enviado para o Caixa!")} 
                disabled={isUpdating}
                className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-md transition-all"
              >
                <Wallet className="w-4 h-4 mr-2" /> Finalizar e Cobrar
              </Button>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <Button 
                variant="outline" 
                disabled={isUpdating || appointment.status === "completed" || appointment.status === "canceled"}
                onClick={() => {
                  if (onEdit) {
                    onClose();
                    onEdit(appointment);
                  } else {
                    toast.info("Função de edição não conectada.");
                  }
                }}
                className="h-11 rounded-xl font-bold text-slate-600 border-slate-200 hover:bg-slate-100"
              >
                <Edit className="w-4 h-4 mr-2" /> Alterar
              </Button>
              
              {appointment.status === "scheduled" && (
                <Button 
                  variant="outline" 
                  disabled={isUpdating}
                  onClick={() => handleUpdateStatus("no_show", "Marcado como não compareceu.")}
                  className="h-11 rounded-xl font-bold text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100 hover:text-orange-800"
                >
                  <UserX className="w-4 h-4 mr-2" /> Faltou
                </Button>
              )}
              
              <Button 
                variant="outline" 
                disabled={isDeleting}
                onClick={() => setShowDeleteAlert(true)}
                className={cn(
                  "h-11 rounded-xl font-bold text-red-600 bg-red-50 border-red-200 hover:bg-red-100 hover:text-red-700", 
                  appointment.status !== "scheduled" && "col-span-2"
                )}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Excluir Agendamento
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600">
              Tem certeza que deseja excluir o agendamento de <strong>{appointment.client_name}</strong> permanentemente? Esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel className="rounded-xl font-bold border-slate-200">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                executeDelete();
              }}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold"
            >
              {isDeleting ? "A excluir..." : "Sim, Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
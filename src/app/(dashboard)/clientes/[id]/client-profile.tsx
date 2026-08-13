// src/app/(dashboard)/clientes/[id]/client-profile.tsx
"use client";

import { useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { 
  User, Phone, Mail, Calendar, History, Clock, 
  Receipt, UserPlus, Ticket, Pencil, Save, NotebookPen 
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateCliente } from "../actions";

export default function ClientProfile({ cliente, timeline }: { cliente: any, timeline: any[] }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Estados dos Formulários
  const [formData, setFormData] = useState({
    name: cliente.name || "",
    phone: cliente.phone || "",
    email: cliente.email || "",
    cpf: cliente.cpf || "",
  });

  const [notes, setNotes] = useState(cliente.notes || "");

  const getInitials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await updateCliente(cliente.id, formData);
      toast.success("Ficha atualizada com sucesso!");
      setIsEditing(false);
    } catch (error) {
      toast.error("Erro ao atualizar os dados.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      await updateCliente(cliente.id, { ...formData, notes });
      toast.success("Anotações salvas com segurança!");
    } catch (error) {
      toast.error("Erro ao salvar anotações.");
    } finally {
      setIsSaving(false);
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'QUEUE_ENTERED': return <Ticket className="size-4 text-blue-500" />;
      case 'CHECKOUT_COMPLETED': return <Receipt className="size-4 text-emerald-500" />;
      case 'CUSTOMER_CREATED': return <UserPlus className="size-4 text-amber-500" />;
      default: return <History className="size-4 text-slate-400" />;
    }
  };

  const getEventDescription = (type: string) => {
    switch (type) {
      case 'QUEUE_ENTERED': return "Entrou na fila de espera";
      case 'CHECKOUT_COMPLETED': return "Finalizou um atendimento";
      case 'CUSTOMER_CREATED': return "Cadastro criado no sistema";
      default: return "Ação registrada no sistema";
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 w-full max-w-[100vw] overflow-hidden">
      
      {/* HEADER DA FICHA DO CLIENTE (100% Mobile First) */}
      <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 sm:h-32 bg-gradient-to-r from-blue-600 to-indigo-700 opacity-10"></div>
        
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 relative z-10 mt-4 sm:mt-0">
          <Avatar className="h-24 w-24 sm:h-28 sm:w-28 shadow-xl ring-4 ring-white">
            <AvatarFallback className="bg-slate-900 text-white font-black text-2xl sm:text-3xl">
              {getInitials(cliente.name)}
            </AvatarFallback>
          </Avatar>

          <div className="text-center sm:text-left flex-1 w-full">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 line-clamp-2">{cliente.name}</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1 uppercase tracking-widest flex items-center justify-center sm:justify-start gap-1.5">
              <User className="size-3.5 sm:size-4" /> ID: {cliente.id.split('-')[0]}
            </p>
            
            {/* Badges roláveis no celular para não quebrar a tela */}
            <div className="flex overflow-x-auto sm:flex-wrap gap-3 mt-5 pb-2 sm:pb-0 justify-start sm:justify-start no-scrollbar snap-x">
              {cliente.phone && (
                <span className="snap-start shrink-0 flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 shadow-sm">
                  <Phone className="size-3.5 sm:size-4 text-blue-500" /> {cliente.phone}
                </span>
              )}
              {cliente.email && (
                <span className="snap-start shrink-0 flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 shadow-sm max-w-[200px] sm:max-w-none truncate">
                  <Mail className="size-3.5 sm:size-4 text-slate-400 shrink-0" /> <span className="truncate">{cliente.email}</span>
                </span>
              )}
              <span className="snap-start shrink-0 flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 shadow-sm">
                <Calendar className="size-3.5 sm:size-4 text-amber-500" /> 
                Desde {format(new Date(cliente.created_at), "dd/MM/yy")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ABAS DO CRM REAL */}
      <Tabs defaultValue="overview" className="w-full">
        {/* Scroll horizontal nativo no mobile para as abas não esmagarem */}
        <div className="w-full overflow-x-auto no-scrollbar pb-2 mb-4 sm:mb-8">
          <TabsList className="inline-flex sm:grid sm:w-full min-w-max sm:min-w-0 sm:grid-cols-3 h-14 bg-slate-200/50 rounded-2xl p-1 gap-1">
            <TabsTrigger value="overview" className="px-6 sm:px-0 rounded-xl font-bold text-sm sm:text-base text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="edit" className="px-6 sm:px-0 rounded-xl font-bold text-sm sm:text-base text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
              Ficha Cadastral
            </TabsTrigger>
            <TabsTrigger value="notes" className="px-6 sm:px-0 rounded-xl font-bold text-sm sm:text-base text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
              Anotações Livres
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ABA 1: VISÃO GERAL E TIMELINE */}
        <TabsContent value="overview" className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-5 sm:p-6 rounded-[2rem] text-white shadow-xl">
              <h3 className="text-slate-400 font-bold text-xs sm:text-sm uppercase tracking-wider mb-2">Visitas Concluídas</h3>
              <p className="text-4xl sm:text-5xl font-black">{cliente.total_visits || 1}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 sm:p-6 rounded-[2rem] text-white shadow-xl">
              <h3 className="text-emerald-200 font-bold text-xs sm:text-sm uppercase tracking-wider mb-2">Valor Gerado (LTV)</h3>
              <p className="text-4xl sm:text-5xl font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cliente.ltv || 0)}</p>
            </div>
          </div>

          <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm mt-4 sm:mt-8">
            <h4 className="font-black text-lg sm:text-xl text-slate-800 mb-6 flex items-center gap-3">
              <History className="size-5 sm:size-6 text-blue-600" /> Linha do Tempo
            </h4>
            
            {timeline.length === 0 ? (
              <p className="text-center text-sm font-medium text-slate-400 py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Nenhum registro encontrado na timeline.
              </p>
            ) : (
              <div className="relative border-l-2 border-slate-100 ml-3 sm:ml-4 space-y-6 sm:space-y-8 pb-4">
                {timeline.map((evento) => (
                  <div key={evento.id} className="relative pl-5 sm:pl-6">
                    <span className="absolute -left-[15px] sm:-left-[17px] top-1 bg-white border-4 border-slate-50 p-1.5 rounded-full shadow-sm">
                      {getEventIcon(evento.event_type)}
                    </span>
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                      <p className="font-bold text-sm sm:text-base text-slate-800">
                        {getEventDescription(evento.event_type)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="size-3.5 text-slate-400" />
                        <span className="text-xs sm:text-sm font-medium text-slate-500">
                          {formatDistanceToNow(new Date(evento.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA 2: EDITAR DADOS */}
        <TabsContent value="edit" className="animate-in fade-in">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <h4 className="font-black text-lg sm:text-xl text-slate-800 flex items-center gap-3">
                <Pencil className="size-5 sm:size-6 text-blue-600" /> Dados Cadastrais
              </h4>
              <Button 
                onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                disabled={isSaving}
                className={`h-12 w-full sm:w-auto px-6 rounded-xl font-bold shadow-lg transition-all ${isEditing ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {isEditing ? <><Save className="size-4 mr-2"/> Salvar Alterações</> : "Editar Ficha"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                <Input 
                  disabled={!isEditing} 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="h-14 bg-slate-50 border-slate-200 rounded-xl text-sm sm:text-base font-semibold text-slate-800 disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">WhatsApp</label>
                <Input 
                  disabled={!isEditing} 
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="h-14 bg-slate-50 border-slate-200 rounded-xl text-sm sm:text-base font-semibold text-slate-800 disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">E-mail</label>
                <Input 
                  disabled={!isEditing} 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="h-14 bg-slate-50 border-slate-200 rounded-xl text-sm sm:text-base font-semibold text-slate-800 disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">CPF</label>
                <Input 
                  disabled={!isEditing} 
                  value={formData.cpf}
                  placeholder="Apenas números"
                  onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                  className="h-14 bg-slate-50 border-slate-200 rounded-xl text-sm sm:text-base font-semibold text-slate-800 disabled:opacity-70 disabled:cursor-not-allowed" 
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ABA 3: NOTAS INTERNAS */}
        <TabsContent value="notes" className="animate-in fade-in">
          <div className="bg-white p-5 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h4 className="font-black text-lg sm:text-xl text-slate-800 flex items-center gap-3">
                  <NotebookPen className="size-5 sm:size-6 text-amber-500" /> Preferências e Notas
                </h4>
                <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2">
                  Área segura da barbearia. O cliente não vê essas anotações.
                </p>
              </div>
              <Button 
                onClick={handleSaveNotes}
                disabled={isSaving}
                className="h-12 w-full sm:w-auto px-6 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200 transition-all shrink-0"
              >
                <Save className="size-4 mr-2"/> Salvar
              </Button>
            </div>
            
            <Textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Usa degradê navalhado. Torce pro Flamengo. Bebe café sem açúcar."
              className="min-h-[200px] sm:min-h-[250px] bg-amber-50/30 border-2 border-amber-100 rounded-2xl p-4 sm:p-6 text-sm sm:text-base font-medium text-slate-700 focus:border-amber-400 focus:ring-0 outline-none resize-y"
            />
          </div>
        </TabsContent>
      </Tabs>

    </div>
  );
}
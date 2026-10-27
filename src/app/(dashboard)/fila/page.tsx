// src/app/(dashboard)/fila/page.tsx
"use client";
export const dynamic = "force-dynamic";
export const runtime = "edge";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateQueueStatusAction, addManualClientAction, generateNewPinAction, getBarbershopPinAction } from "@/app/(dashboard)/fila/actions";
import { QRCodeSVG } from "qrcode.react";
import { Users, Play, CheckCircle2, XCircle, QrCode, Loader2, UserCheck, Monitor, RefreshCw, UserPlus, Scissors, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
// Tipagens
type QueueStatus = "waiting" | "in_progress" | "finished" | "cancelled";
interface QueueItem {
    id: string;
    client_name: string;
    client_id: string | null;
    client_auth_id: string | null;
    status: "waiting" | "in_progress";
    joined_at: string;
    barber_name: string | null;
    barber_id: string | null;
    preferred_barber_id: string | null;
    preferred_staff: {
        full_name: string;
    } | {
        full_name: string;
    }[] | null;
    staff: {
        full_name: string;
    } | {
        full_name: string;
    }[] | null;
}
interface ServiceItem {
    id: string;
    name: string;
    price: number;
}
interface BarbershopInfo {
    id: string;
    slug: string;
}
interface MemberResponse {
    barbershop_id: string;
    barbershops: {
        slug: string;
    } | null;
}
interface QueueStartConfirmationState {
    id: string;
    clientName: string;
    requiresClientConsent: boolean;
    requiresQueueOrderOverride: boolean;
    preferredBarberName: string | null;
    waitingAheadCount: number;
}

function formatQueueClientName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) {
        return parts[0] || "Cliente";
    }
    return `${parts[0]} ${parts.at(-1)}`;
}
export default function FilaDashboard() {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [barbershop, setBarbershop] = useState<BarbershopInfo | null>(null);
    // Estados da Torre de Comando
    const [currentPin, setCurrentPin] = useState<string>("----");
    const [manualName, setManualName] = useState("");
    const [isAddingManual, setIsAddingManual] = useState(false);
    const [isGeneratingPin, setIsGeneratingPin] = useState(false);
    // ==========================================
    // ESTADOS DO MODAL (ATUALIZADOS PARA ARRAY)
    // ==========================================
    const [services, setServices] = useState<ServiceItem[]>([]);
    const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
    const [finishingQueueId, setFinishingQueueId] = useState<string | null>(null);
    const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]); // <-- ARRAY AQUI
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [startConfirmation, setStartConfirmation] = useState<QueueStartConfirmationState | null>(null);
    const [clientConsentConfirmed, setClientConsentConfirmed] = useState(false);
    const [queueOrderConfirmed, setQueueOrderConfirmed] = useState(false);
    const supabase = useMemo(() => createClient(), []);
    // Fetch da Fila
    const fetchQueue = useCallback(async (bid: string) => {
        try {
            const { data, error } = await supabase
                .from("virtual_queue")
                .select("id, client_name, client_id, client_auth_id, status, joined_at, barber_name, barber_id, preferred_barber_id, staff!virtual_queue_barber_id_fkey(full_name), preferred_staff:staff!virtual_queue_preferred_barber_fk(full_name)")
                .eq("barbershop_id", bid)
                .in("status", ["waiting", "in_progress"])
                .order("joined_at", { ascending: true });
            if (error)
                throw error;
            setQueue((data as QueueItem[]) || []);
        }
        catch (error) {
            console.error(error);
            toast.error("Erro ao carregar a lista da fila.");
        }
    }, [supabase]);
    // Fetch dos Serviços da Barbearia
    const fetchServices = useCallback(async (bid: string) => {
        try {
            const { data, error } = await supabase
                .from("services")
                .select("id, name, price")
                .eq("barbershop_id", bid)
                .eq("is_active", true)
                .order("name", { ascending: true });
            if (!error && data) {
                setServices(data as ServiceItem[]);
            }
        }
        catch (err) {
            console.error(err);
        }
    }, [supabase]);
    // Fetch Inicial
    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user)
                    return;
                const { data, error } = await supabase
                    .from("barbershop_members")
                    .select("barbershop_id, barbershops(slug)")
                    .eq("profile_id", user.id)
                    .single();
                const member = data as unknown as MemberResponse;
                if (error)
                    throw error;
                if (member && member.barbershops) {
                    const info = { id: member.barbershop_id, slug: member.barbershops.slug };
                    setBarbershop(info);
                    await Promise.all([
                        fetchQueue(info.id),
                        fetchServices(info.id)
                    ]);
                    const pinResult = await getBarbershopPinAction(info.id);
                    setCurrentPin(pinResult.pin);
                }
            }
            catch (error) {
                console.error(error);
                toast.error("Erro ao carregar dados da barbearia.");
            }
            finally {
                setLoading(false);
            }
        }
        loadData();
    }, [supabase, fetchQueue, fetchServices]);
    // Realtime Subscription
    useEffect(() => {
        if (!barbershop?.id)
            return;
        const channel = supabase
            .channel(`dashboard-queue-${barbershop.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "virtual_queue", filter: `barbershop_id=eq.${barbershop.id}` }, () => {
            fetchQueue(barbershop.id);
        })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [barbershop?.id, fetchQueue, supabase]);
    // Handler para Múltipla Seleção
    function toggleService(id: string) {
        setSelectedServiceIds(prev => prev.includes(id)
            ? prev.filter(serviceId => serviceId !== id)
            : [...prev, id]);
    }
    // Mudar o estado de um cliente (Chamar ou Cancelar)
    async function handleStatus(id: string, status: QueueStatus) {
        setIsSubmitting(true);
        try {
            const res = await updateQueueStatusAction(id, status);

            if ("confirmationRequired" in res && res.confirmationRequired) {
                setStartConfirmation({
                    id,
                    clientName: res.clientName || queue.find((item) => item.id === id)?.client_name || "Cliente",
                    requiresClientConsent: res.requiresClientConsent,
                    requiresQueueOrderOverride: res.requiresQueueOrderOverride,
                    preferredBarberName: res.preferredBarberName,
                    waitingAheadCount: res.waitingAheadCount,
                });
                setClientConsentConfirmed(false);
                setQueueOrderConfirmed(false);
                return;
            }

            if ("success" in res && res.success) {
                toast.success(status === "cancelled" ? "Cliente removido da fila." : "Fila atualizada!");
                if (barbershop) await fetchQueue(barbershop.id);
                return;
            }

            toast.error(("error" in res && res.error) || "Erro ao atualizar.");
        } catch (error) {
            console.error("Erro ao atualizar atendimento:", error);
            toast.error("Não foi possível atualizar a fila. Tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleConfirmStart() {
        if (!startConfirmation) return;

        setIsSubmitting(true);
        try {
            const res = await updateQueueStatusAction(
                startConfirmation.id,
                "in_progress",
                undefined,
                undefined,
                {
                    clientAcceptedDifferentBarber: clientConsentConfirmed,
                    confirmedOutOfOrder: queueOrderConfirmed,
                }
            );

            if ("confirmationRequired" in res && res.confirmationRequired) {
                setStartConfirmation({
                    id: startConfirmation.id,
                    clientName: res.clientName || startConfirmation.clientName,
                    requiresClientConsent: res.requiresClientConsent,
                    requiresQueueOrderOverride: res.requiresQueueOrderOverride,
                    preferredBarberName: res.preferredBarberName,
                    waitingAheadCount: res.waitingAheadCount,
                });
                setClientConsentConfirmed(false);
                setQueueOrderConfirmed(false);
                toast.message("A fila mudou. Revise as confirmações antes de iniciar.");
                return;
            }

            if ("success" in res && res.success) {
                toast.success("Atendimento iniciado.");
                setStartConfirmation(null);
                setClientConsentConfirmed(false);
                setQueueOrderConfirmed(false);
                if (barbershop) await fetchQueue(barbershop.id);
                return;
            }

            toast.error(("error" in res && res.error) || "Não foi possível iniciar o atendimento.");
        } catch (error) {
            console.error("Erro ao iniciar atendimento:", error);
            toast.error("Não foi possível iniciar o atendimento. Atualize a fila e tente novamente.");
        } finally {
            setIsSubmitting(false);
        }
    }
    // Abrir Modal de Finalização
    function openFinishModal(queueId: string) {
        setFinishingQueueId(queueId);
        setSelectedServiceIds([]); // Reseta as seleções
        setIsFinishModalOpen(true);
    }
    // Confirmar Finalização e Enviar para o PDV
    async function handleConfirmFinish() {
        if (!finishingQueueId || selectedServiceIds.length === 0)
            return;
        setIsSubmitting(true);
        // Envia o array de IDs selecionados para a action! Sem erro TS2345
        const res = await updateQueueStatusAction(finishingQueueId, "finished", undefined, selectedServiceIds);
        if (res.success) {
            toast.success("Atendimento enviado para o Caixa!");
            if (barbershop)
                fetchQueue(barbershop.id);
            setIsFinishModalOpen(false);
        }
        else {
            toast.error(res.error || "Erro ao finalizar atendimento.");
        }
        setIsSubmitting(false);
    }
    // Adicionar cliente manualmente
    async function handleAddManual(e: React.FormEvent) {
        e.preventDefault();
        if (!manualName.trim() || !barbershop)
            return;
        setIsAddingManual(true);
        const res = await addManualClientAction(barbershop.id, manualName);
        if (res.success) {
            toast.success(`${manualName} entrou na fila!`);
            setManualName("");
        }
        else {
            toast.error(res.error || "Erro ao adicionar cliente.");
        }
        setIsAddingManual(false);
    }
    // Gerar um novo PIN
    async function handleGeneratePin() {
        if (!barbershop)
            return;
        setIsGeneratingPin(true);
        const res = await generateNewPinAction(barbershop.id);
        if (res.success && res.newPin) {
            setCurrentPin(res.newPin);
            toast.success(`Novo PIN gerado: ${res.newPin}`);
        }
        else {
            toast.error(res.error || "Erro ao gerar PIN.");
        }
        setIsGeneratingPin(false);
    }
    const qrUrl = useMemo(() => {
        if (typeof window === "undefined" || !barbershop?.slug)
            return "";
        return `${window.location.origin}/b/${barbershop.slug}?origem=balcao`;
    }, [barbershop?.slug]);
    return (<div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* HEADER PRINCIPAL */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div className="flex items-center gap-3">

          <div className="p-3 bg-white rounded-2xl shadow-sm">

            <Users className="text-blue-600 size-6"/>

          </div>

          <div>

            <h1 className="text-2xl font-black text-slate-900 text-left">Fila Virtual</h1>

            <p className="text-sm text-slate-500 font-medium tracking-tight text-left">

              Gerencie os clientes presenciais em tempo real.

            </p>

          </div>

        </div>

        <div className="flex items-center gap-2">

          <Button variant="outline" onClick={() => window.open(`/monitor/${barbershop?.slug}`, '_blank')} className="border-slate-200 text-slate-600 gap-2 rounded-xl h-12 px-6 font-bold hover:bg-slate-100 hidden md:flex">

            <Monitor className="size-5"/> Monitor (TV)

          </Button>

          <Dialog>

            <DialogTrigger asChild>

              <Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2 rounded-xl h-12 px-6 font-bold shadow-lg transition-all active:scale-95">

                <QrCode className="size-5"/> Totem & PIN

              </Button>

            </DialogTrigger>

            <DialogContent className="bg-white rounded-3xl border-0 shadow-2xl sm:max-w-sm">

              <DialogHeader className="text-center pt-4">

                <DialogTitle className="text-2xl font-black text-slate-900">Acesso Presencial</DialogTitle>

              </DialogHeader>

              <div className="flex flex-col items-center p-6 gap-6">

                <div className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center justify-between">

                  <div>

                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">PIN Atual</p>

                    <p className="text-3xl font-black text-slate-900 tracking-[0.2em]">{currentPin}</p>

                  </div>

                  <Button onClick={handleGeneratePin} disabled={isGeneratingPin} variant="outline" className="h-12 w-12 p-0 rounded-xl border-slate-200">

                    <RefreshCw className={`size-5 text-slate-600 ${isGeneratingPin ? 'animate-spin' : ''}`}/>

                  </Button>

                </div>

                <div className="p-4 bg-white border-8 border-slate-50 rounded-[2rem] shadow-inner">

                  {qrUrl && <QRCodeSVG value={qrUrl} size={180}/>}

                </div>

                <p className="text-center text-slate-500 font-medium text-xs leading-relaxed">

                  O cliente escaneia o QR Code ou digita o PIN no seu próprio celular.

                </p>

              </div>

            </DialogContent>

          </Dialog>

        </div>

      </div>

      {/* BLOCO: CONTROLE RÁPIDO (Adicionar Manual) */}

      <div className="bg-white p-2 pl-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-4 max-w-xl">

        <div className="flex items-center gap-3 w-full">

          <UserPlus className="text-slate-400 size-5"/>

          <form onSubmit={handleAddManual} className="w-full flex">

            <input type="text" placeholder="Adicionar cliente sem telemóvel..." value={manualName} onChange={(e) => setManualName(e.target.value)} className="w-full bg-transparent border-0 focus:ring-0 text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none"/>

            <Button type="submit" disabled={isAddingManual || !manualName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-10 px-6 font-bold shadow-sm shrink-0">

              {isAddingManual ? <Loader2 className="size-4 animate-spin"/> : "Adicionar"}

            </Button>

          </form>

        </div>

      </div>

      {/* LISTA DA FILA */}

      <div className="grid gap-4">

        {loading ? (<div className="flex flex-col items-center justify-center py-20 gap-3">

            <Loader2 className="animate-spin size-8 text-blue-600"/>

            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sincronizando Fila...</p>

          </div>) : queue.length === 0 ? (<div className="bg-white rounded-[2rem] border border-dashed border-slate-300 py-24 text-center">

             <Users className="size-12 text-slate-200 mx-auto mb-4"/>

             <p className="text-slate-400 font-bold text-lg">Nenhum cliente na fila no momento.</p>

          </div>) : (queue.map((item, index) => (<div key={item.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group">

              <div className="flex items-center gap-5">

                <div className="text-2xl font-black text-blue-600/30 bg-blue-50/50 w-12 h-12 flex items-center justify-center rounded-full transition-colors">

                  {String(index + 1).padStart(2, '0')}

                </div>

                <div className="flex flex-col">

                  <div className="flex items-center gap-2 mb-1">

                    <p className="font-black text-slate-800 text-xl leading-tight">{formatQueueClientName(item.client_name)}</p>

                    {item.client_auth_id && (<div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100 pointer-events-none">

                        <UserCheck className="size-3"/>

                        <span className="text-[10px] font-black uppercase tracking-tight">App</span>

                      </div>)}

                  </div>

                  {/* TAGS DE STATUS E PREFERÊNCIA */}

                  <div className="flex gap-2 items-center">

                    {item.status === 'in_progress' ? (<span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-emerald-200">

                        Na Cadeira

                      </span>) : (<span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-200">

                        Aguardando

                      </span>)}

                    {(() => {
                let displayName = null;
                let prefix = "Pref:";
                if (item.status === "in_progress" && item.barber_name) {
                    displayName = item.barber_name;
                    prefix = "Com:";
                }
                else if (item.status === "waiting") {
                    // Preferência canônica para novos tickets; item.staff é fallback
                    // para tickets antigos que guardavam a preferência em barber_id.
                    const preferredStaff = item.preferred_staff ?? item.staff;
                    if (preferredStaff) {
                        displayName = Array.isArray(preferredStaff)
                            ? preferredStaff[0]?.full_name
                            : preferredStaff.full_name;
                    }
                }
                if (!displayName)
                    return null;
                return (<Badge variant="secondary" className="text-[10px] font-bold text-slate-600 bg-slate-100 uppercase tracking-wider px-2 py-0.5 rounded-lg border border-slate-200 pointer-events-none">

                          {prefix} {displayName}

                        </Badge>);
            })()}

                  </div>

                </div>

              </div>

              {/* Controles do Barbeiro */}

              <div className="flex gap-2">

                {item.status === 'waiting' && (<>

                    <Button variant="ghost" onClick={() => handleStatus(item.id, 'in_progress')} disabled={isSubmitting} className="text-blue-600 hover:bg-blue-50 h-12 w-12 p-0 rounded-2xl transition-all" title="Iniciar Atendimento">

                      <Play className="size-6 fill-current"/>

                    </Button>

                    <Button variant="ghost" onClick={() => handleStatus(item.id, 'cancelled')} className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-12 w-12 p-0 rounded-2xl transition-all" title="Remover da Fila">

                      <XCircle className="size-6"/>

                    </Button>

                  </>)}

                {item.status === 'in_progress' && (<Button variant="ghost" onClick={() => openFinishModal(item.id)} className="text-emerald-600 hover:bg-emerald-50 h-12 w-12 p-0 rounded-2xl transition-all" title="Finalizar Atendimento">

                    <CheckCircle2 className="size-6"/>

                  </Button>)}

              </div>

            </div>)))}

      </div>

      {/* CONFIRMAÇÃO DE PREFERÊNCIA E ORDEM DA FILA */}
      <Dialog
        open={Boolean(startConfirmation)}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) {
            setStartConfirmation(null);
            setClientConsentConfirmed(false);
            setQueueOrderConfirmed(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-950">
              Confirmar início do atendimento
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm leading-6 text-slate-600">
            Você está prestes a iniciar o atendimento de <strong className="font-semibold text-slate-900">{startConfirmation?.clientName}</strong>.
            Revise as condições abaixo antes de continuar.
          </p>

          {startConfirmation?.requiresClientConsent && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm leading-5 text-amber-950">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-amber-700"
                checked={clientConsentConfirmed}
                onChange={(event) => setClientConsentConfirmed(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>
                O cliente informou que aceita ser atendido por outro profissional, apesar da preferência cadastrada
                {startConfirmation.preferredBarberName ? ` por ${startConfirmation.preferredBarberName}` : ""}.
                Confirmo que obtive essa aceitação antes de iniciar.
              </span>
            </label>
          )}

          {startConfirmation?.requiresQueueOrderOverride && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-5 text-slate-800">
              <input
                type="checkbox"
                className="mt-1 size-4 shrink-0 accent-slate-900"
                checked={queueOrderConfirmed}
                onChange={(event) => setQueueOrderConfirmed(event.target.checked)}
                disabled={isSubmitting}
              />
              <span>
                Estou ciente de que há {startConfirmation.waitingAheadCount} {startConfirmation.waitingAheadCount === 1 ? "cliente aguardando" : "clientes aguardando"} antes deste na ordem da fila e confirmo que devo iniciar este atendimento fora da ordem.
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => {
                setStartConfirmation(null);
                setClientConsentConfirmed(false);
                setQueueOrderConfirmed(false);
              }}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={
                isSubmitting ||
                !startConfirmation ||
                (startConfirmation.requiresClientConsent && !clientConsentConfirmed) ||
                (startConfirmation.requiresQueueOrderOverride && !queueOrderConfirmed)
              }
              onClick={handleConfirmStart}
              className="bg-slate-950 text-white hover:bg-slate-800"
            >
              {isSubmitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirmar e iniciar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL MODERNO DE SELEÇÃO DE MÚLTIPLOS SERVIÇOS */}

      <Dialog open={isFinishModalOpen} onOpenChange={setIsFinishModalOpen}>

        <DialogContent className="bg-white rounded-[2.5rem] border-0 shadow-2xl sm:max-w-md p-6 [&>button]:hidden outline-none" onInteractOutside={(e) => e.preventDefault()} // Impede de fechar clicando fora
     onEscapeKeyDown={(e) => e.preventDefault()} // Impede de fechar com ESC
    >

          <DialogHeader className="text-left mb-2">

            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">

              <Scissors className="text-emerald-600 size-6"/>

              Finalizar Atendimento

            </DialogTitle>

            <p className="text-sm text-slate-500 font-medium pt-1">

              Quais serviços foram realizados? Você pode selecionar mais de um.

            </p>

          </DialogHeader>

          <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-2 pb-2 mt-4 custom-scrollbar">

            {services.length === 0 ? (<div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100">

                <p className="text-slate-400 font-bold text-sm">Nenhum serviço cadastrado.</p>

              </div>) : (services.map(s => {
            const isSelected = selectedServiceIds.includes(s.id);
            return (<button key={s.id} onClick={() => toggleService(s.id)} className={`text-left p-4 rounded-2xl border-2 transition-all flex items-center justify-between group ${isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                    : 'border-slate-100 hover:border-emerald-200 hover:bg-slate-50'}`}>

                    <div className="flex items-center gap-3">

                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-emerald-300'}`}>

                        {isSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4}/>}

                      </div>

                      <span className={`font-bold text-lg transition-colors ${isSelected ? 'text-emerald-900' : 'text-slate-700 group-hover:text-slate-900'}`}>

                        {s.name}

                      </span>

                    </div>

                    <span className={`font-black tracking-tight transition-colors ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>

                      R$ {Number(s.price).toFixed(2)}

                    </span>

                  </button>);
        }))}

          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100">

            <Button variant="ghost" onClick={() => setIsFinishModalOpen(false)} className="flex-1 font-bold rounded-xl h-14 text-slate-500 hover:text-slate-700 hover:bg-slate-100">

              Cancelar

            </Button>

            <Button disabled={selectedServiceIds.length === 0 || isSubmitting} onClick={handleConfirmFinish} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-lg rounded-xl h-14 shadow-lg shadow-emerald-200 transition-all active:scale-95 disabled:opacity-50">

              {isSubmitting ? <Loader2 className="animate-spin size-6"/> : "Enviar p/ Caixa"}

            </Button>

          </div>

        </DialogContent>

      </Dialog>

    </div>);
}

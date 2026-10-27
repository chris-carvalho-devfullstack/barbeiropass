// Shared queue workspace for administrative and professional portals
"use client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateQueueStatusAction, addManualClientAction, generateNewPinAction, getBarbershopPinAction, getQueueStaffNamesAction } from "@/app/(dashboard)/fila/actions";
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
    status: "waiting" | "in_progress" | "in_chair";
    joined_at: string;
    barber_name: string | null;
    barber_id: string | null;
    preferred_barber_id: string | null;
    preferred_staff: { full_name: string } | { full_name: string }[] | null;
    assigned_staff: { full_name: string } | { full_name: string }[] | null;
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
interface StartConfirmationState {
    queueId: string;
    clientName: string;
    requiresPreferenceChange: boolean;
    requiresOutOfOrder: boolean;
    earlierWaitingCount: number;
    clientAcceptedPreferenceChange: boolean;
    outOfOrderConfirmed: boolean;
}
function formatQueueClientName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) {
        return parts[0] || "Cliente";
    }
    return `${parts[0]} ${parts.at(-1)}`;
}
interface QueueWorkspaceProps {
    mode?: "admin" | "professional";
}

export function QueueWorkspace({ mode = "admin" }: QueueWorkspaceProps) {
    const [queue, setQueue] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [barbershop, setBarbershop] = useState<BarbershopInfo | null>(null);
    const [currentStaffId, setCurrentStaffId] = useState<string | null>(null);
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
    const [startConfirmation, setStartConfirmation] = useState<StartConfirmationState | null>(null);
    const supabase = useMemo(() => createClient(), []);
    // Fetch da Fila
    const fetchQueue = useCallback(async (bid: string) => {
        try {
            const { data, error } = await supabase
                .from("virtual_queue")
                .select("id, client_name, client_id, client_auth_id, status, joined_at, barber_name, barber_id, preferred_barber_id")
                .eq("barbershop_id", bid)
                .in("status", ["waiting", "in_progress", "in_chair"])
                .order("joined_at", { ascending: true })
                .order("id", { ascending: true });
            if (error)
                throw error;

            const queueRows = data || [];
            const staffIds = Array.from(new Set(queueRows.flatMap((item) => {
                const preferredId = item.preferred_barber_id || (item.status === "waiting" ? item.barber_id : null);
                return [preferredId, item.barber_id].filter((staffId): staffId is string => Boolean(staffId));
            })));

            const staffNamesById = new Map<string, string>();
            if (staffIds.length > 0) {
                const staffNamesResult = await getQueueStaffNamesAction(bid, staffIds);
                if ("error" in staffNamesResult) {
                    throw new Error(staffNamesResult.error);
                }
                for (const [staffId, staffName] of Object.entries(staffNamesResult.staffNames)) {
                    staffNamesById.set(staffId, staffName);
                }
            }

            const mappedQueue: QueueItem[] = queueRows.map((item) => {
                const preferredId = item.preferred_barber_id || (item.status === "waiting" ? item.barber_id : null);
                const assignedId = item.barber_id;
                const preferredName = preferredId ? staffNamesById.get(preferredId) : undefined;
                const assignedName = assignedId ? staffNamesById.get(assignedId) : undefined;

                return {
                    ...item,
                    preferred_staff: preferredName ? { full_name: preferredName } : null,
                    assigned_staff: assignedName ? { full_name: assignedName } : null,
                } as QueueItem;
            });

            setQueue(mappedQueue);
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
                    if (mode === "professional") {
                        const { data: ownStaff, error: ownStaffError } = await supabase
                            .from("staff")
                            .select("id")
                            .eq("profile_id", user.id)
                            .eq("barbershop_id", member.barbershop_id)
                            .eq("role", "barber")
                            .eq("is_active", true)
                            .maybeSingle();

                        if (ownStaffError || !ownStaff) {
                            throw new Error("Seu cadastro profissional ativo não foi encontrado.");
                        }
                        setCurrentStaffId(ownStaff.id);
                    }

                    const info = { id: member.barbershop_id, slug: member.barbershops.slug };
                    setBarbershop(info);
                    await Promise.all([
                        fetchQueue(info.id),
                        fetchServices(info.id)
                    ]);
                    if (mode === "admin") {
                        const pinResult = await getBarbershopPinAction(info.id);
                        setCurrentPin(pinResult.pin);
                    }
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
    }, [supabase, fetchQueue, fetchServices, mode]);
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
        const res = await updateQueueStatusAction(id, status);

        if ("requiresConfirmation" in res && res.requiresConfirmation) {
            const targetItem = queue.find((item) => item.id === id);
            setStartConfirmation({
                queueId: id,
                clientName: targetItem?.client_name || "Cliente",
                requiresPreferenceChange: res.confirmationRequirements.preferenceChange,
                requiresOutOfOrder: res.confirmationRequirements.outOfOrder,
                earlierWaitingCount: res.confirmationRequirements.earlierWaitingCount,
                clientAcceptedPreferenceChange: false,
                outOfOrderConfirmed: false,
            });
            return;
        }

        if (res.success) {
            toast.success(status === "in_progress" ? "Atendimento iniciado." : "Fila atualizada!");
            if (barbershop) await fetchQueue(barbershop.id);
        } else {
            toast.error(res.error || "Erro ao atualizar.");
        }
    }

    async function handleConfirmStart() {
        if (!startConfirmation || isSubmitting) return;

        if (
            (startConfirmation.requiresPreferenceChange && !startConfirmation.clientAcceptedPreferenceChange) ||
            (startConfirmation.requiresOutOfOrder && !startConfirmation.outOfOrderConfirmed)
        ) {
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await updateQueueStatusAction(
                startConfirmation.queueId,
                "in_progress",
                undefined,
                undefined,
                {
                    clientAcceptedPreferenceChange: startConfirmation.clientAcceptedPreferenceChange,
                    outOfOrderConfirmed: startConfirmation.outOfOrderConfirmed,
                }
            );

            if ("requiresConfirmation" in res && res.requiresConfirmation) {
                setStartConfirmation((current) => current ? {
                    ...current,
                    requiresPreferenceChange: res.confirmationRequirements.preferenceChange,
                    requiresOutOfOrder: res.confirmationRequirements.outOfOrder,
                    earlierWaitingCount: res.confirmationRequirements.earlierWaitingCount,
                    clientAcceptedPreferenceChange: current.clientAcceptedPreferenceChange && res.confirmationRequirements.preferenceChange,
                    outOfOrderConfirmed: current.outOfOrderConfirmed && res.confirmationRequirements.outOfOrder,
                } : current);
                toast.warning("A fila mudou. Revise as confirmações antes de continuar.");
                if (barbershop) await fetchQueue(barbershop.id);
                return;
            }

            if (!res.success) {
                toast.error(res.error || "Não foi possível iniciar o atendimento.");
                if (barbershop) await fetchQueue(barbershop.id);
                return;
            }

            toast.success("Atendimento iniciado.");
            setStartConfirmation(null);
            if (barbershop) await fetchQueue(barbershop.id);
        } catch (error) {
            console.error("[QUEUE_START_CONFIRMATION_ERROR]", error);
            toast.error("Erro ao confirmar o início do atendimento.");
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
    const activeProfessionalQueueItem = mode === "professional" && currentStaffId
        ? queue.find((item) =>
            (item.status === "in_progress" || item.status === "in_chair") && item.barber_id === currentStaffId
        )
        : undefined;
    const professionalHasActiveService = Boolean(activeProfessionalQueueItem);

    return (<div className={mode === "professional" ? "space-y-6" : "p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen"}>

      {/* HEADER PRINCIPAL */}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

        <div className="flex items-center gap-3">

          <div className="p-3 bg-white rounded-2xl shadow-sm">

            <Users className="text-blue-600 size-6"/>

          </div>

          <div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-left">{mode === "professional" ? "Fila de atendimento" : "Fila Virtual"}</h1>

            <p className="text-sm text-slate-500 font-medium tracking-tight text-left">

              {mode === "professional" ? "Acompanhe a ordem de chegada e inicie seus atendimentos." : "Gerencie os clientes presenciais em tempo real."}

            </p>

          </div>

        </div>

        {mode === "admin" && (
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
        )}

      </div>

      {mode === "admin" && (
<>
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

      
</>
)}

      {/* LISTA DA FILA */}

      {professionalHasActiveService && activeProfessionalQueueItem && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Você já está atendendo {formatQueueClientName(activeProfessionalQueueItem.client_name)}. Finalize esse atendimento antes de iniciar outro.
        </div>
      )}

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

                    {item.status !== 'waiting' ? (<span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-emerald-200">

                        Na Cadeira

                      </span>) : (<span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-200">

                        Aguardando

                      </span>)}

                    {(() => {
                const preferredStaff = item.preferred_staff || (item.status === "waiting" ? item.assigned_staff : null);
                const preferredName = Array.isArray(preferredStaff) ? preferredStaff[0]?.full_name : preferredStaff?.full_name;
                const assignedStaff = item.assigned_staff;
                const assignedName = item.barber_name || (Array.isArray(assignedStaff) ? assignedStaff[0]?.full_name : assignedStaff?.full_name) || null;

                if (item.status === "waiting") {
                    if (!preferredName) return null;
                    return (
                        <Badge variant="secondary" className="text-[10px] font-bold text-slate-600 bg-slate-100 uppercase tracking-wider px-2 py-0.5 rounded-lg border border-slate-200 pointer-events-none">
                            Pref: {preferredName}
                        </Badge>
                    );
                }

                return (
                    <>
                        {assignedName && (
                            <Badge variant="secondary" className="text-[10px] font-bold text-slate-600 bg-slate-100 uppercase tracking-wider px-2 py-0.5 rounded-lg border border-slate-200 pointer-events-none">
                                Com: {assignedName}
                            </Badge>
                        )}
                        {preferredName && preferredName !== assignedName && (
                            <Badge variant="outline" className="text-[10px] font-bold text-slate-600 uppercase tracking-wider px-2 py-0.5 rounded-lg pointer-events-none">
                                Pref: {preferredName}
                            </Badge>
                        )}
                    </>
                );
            })()}

                  </div>

                </div>

              </div>

              {/* Controles do Barbeiro */}

              <div className="flex gap-2">

                {item.status === 'waiting' && (<>

                    <Button variant="ghost" onClick={() => handleStatus(item.id, 'in_progress')} disabled={mode === "professional" && professionalHasActiveService} className="text-blue-600 hover:bg-blue-50 h-12 w-12 p-0 rounded-2xl transition-all disabled:cursor-not-allowed disabled:opacity-40" title={mode === "professional" && professionalHasActiveService ? "Finalize o atendimento atual antes de iniciar outro" : "Iniciar Atendimento"}>

                      <Play className="size-6 fill-current"/>

                    </Button>

                    {mode === "admin" && (
                      <Button variant="ghost" onClick={() => handleStatus(item.id, 'cancelled')} className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-12 w-12 p-0 rounded-2xl transition-all" title="Remover da Fila">
                        <XCircle className="size-6"/>
                      </Button>
                    )}

                  </>)}

                {item.status !== 'waiting' && (mode === "admin" || item.barber_id === currentStaffId) && (<Button variant="ghost" onClick={() => openFinishModal(item.id)} className="text-emerald-600 hover:bg-emerald-50 h-12 w-12 p-0 rounded-2xl transition-all" title="Finalizar Atendimento">

                    <CheckCircle2 className="size-6"/>

                  </Button>)}

              </div>

            </div>)))}

      </div>

      {/* Confirmações obrigatórias antes de iniciar exceções na fila */}
      <Dialog open={!!startConfirmation} onOpenChange={(open) => {
        if (!open && !isSubmitting) setStartConfirmation(null);
      }}>
        <DialogContent
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl sm:max-w-lg p-6"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader className="text-left space-y-2">
            <DialogTitle className="text-xl font-semibold text-slate-900">
              Confirmar início do atendimento
            </DialogTitle>
            <p className="text-sm text-slate-600">
              Você está prestes a iniciar o atendimento de <strong>{startConfirmation?.clientName}</strong>.
            </p>
          </DialogHeader>

          {startConfirmation?.requiresPreferenceChange && (
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-slate-900"
                checked={startConfirmation.clientAcceptedPreferenceChange}
                onChange={(event) => setStartConfirmation((current) => current ? {
                  ...current,
                  clientAcceptedPreferenceChange: event.target.checked,
                } : current)}
              />
              <span className="text-sm leading-6 text-slate-700">
                Confirmo que o cliente aceitou ser atendido por um profissional diferente daquele que indicou como preferência.
              </span>
            </label>
          )}

          {startConfirmation?.requiresOutOfOrder && (
            <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-slate-900"
                checked={startConfirmation.outOfOrderConfirmed}
                onChange={(event) => setStartConfirmation((current) => current ? {
                  ...current,
                  outOfOrderConfirmed: event.target.checked,
                } : current)}
              />
              <span className="text-sm leading-6 text-slate-700">
                Confirmo que vou atender fora da ordem de chegada, embora existam {startConfirmation.earlierWaitingCount} {startConfirmation.earlierWaitingCount === 1 ? "cliente aguardando" : "clientes aguardando"} antes deste atendimento.
              </span>
            </label>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              disabled={isSubmitting}
              onClick={() => setStartConfirmation(null)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              disabled={isSubmitting || !startConfirmation ||
                (startConfirmation.requiresPreferenceChange && !startConfirmation.clientAcceptedPreferenceChange) ||
                (startConfirmation.requiresOutOfOrder && !startConfirmation.outOfOrderConfirmed)}
              onClick={handleConfirmStart}
            >
              {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : null}
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

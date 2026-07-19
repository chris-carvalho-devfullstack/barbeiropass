// src/app/(public)/b/[slug]/queue-form.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import { 
  Loader2, Sparkles, LogOut, CheckCircle2, MapPin, Camera, 
  Users, Clock, Scissors, Star, MessageSquare, BellRing, Zap, ShieldCheck,
  User as UserIcon, Phone, Mail, XCircle
} from "lucide-react"; 
import { type User } from "@supabase/supabase-js"; 
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner"; 
import Image from "next/image";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// =========================================================================
// TIPAGENS DE ESTRUTURA
// =========================================================================
interface Barber {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

interface QueueFormProps {
  barbershopId: string;
  barbershopName: string;
  barbers: Barber[];
  user: User | null; 
  isLocal: boolean;
  initialWaitingCount: number;
  initialQueueData: { 
    id: string; 
    status: string; 
    barber_name: string | null; 
    chair_number: string | null; 
    is_rated: boolean; 
    joined_at: string | null 
  } | null;
  initialUserPosition: number | null;
}

interface QueueRowPayload {
  id: string;
  barbershop_id: string;
  client_auth_id: string | null;
  status: string;
  barber_name: string | null;
  chair_number: string | null;
  is_rated: boolean;
  joined_at: string | null;
}

// =========================================================================
// ZOD SCHEMA E MÁSCARA PARA CLIENTES AVULSOS
// =========================================================================
const walkInSchema = z.object({
  clientName: z.string().min(2, "O nome deve ter no mínimo 2 caracteres."),
  phone: z.string().refine((val) => {
    const clean = val.replace(/\D/g, "");
    return clean === "" || clean.length === 10 || clean.length === 11;
  }, {
    message: "Telefone incompleto ou inválido.",
  }),
  email: z.string().refine((val) => {
    return val === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, {
    message: "Formato de e-mail inválido.",
  }),
});

type WalkInFormValues = z.infer<typeof walkInSchema>;

const applyPhoneMask = (value: string): string => {
  let v = value.replace(/\D/g, "");
  if (v.length <= 10) {
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{4})(\d)/, "$1-$2");
  } else {
    v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
    v = v.replace(/(\d{5})(\d)/, "$1-$2");
  }
  return v.substring(0, 15);
};

export default function QueueForm({ 
  barbershopId, 
  barbershopName, 
  barbers, 
  user, 
  isLocal, 
  initialWaitingCount, 
  initialQueueData, 
  initialUserPosition 
}: QueueFormProps) {
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isTerminalStatus = (status: string | null) => {
    return status === "awaiting_payment" || status === "completed" || status === "canceled";
  };

  const [waitingCount, setWaitingCount] = useState(initialWaitingCount);
  const [userPosition, setUserPosition] = useState<number | null>(initialUserPosition);
  
  const [inQueue, setInQueue] = useState(!!initialQueueData && !isTerminalStatus(initialQueueData.status)); 
  const [currentStatus, setCurrentStatus] = useState<string | null>(initialQueueData?.status || null);
  
  // A MÁGICA DE ESTABILIDADE: O useRef garante que as funções em background sempre vejam o ID mais recente
  const [queueId, setQueueId] = useState<string | null>(initialQueueData?.id || null);
  const queueIdRef = useRef<string | null>(queueId);
  const userRef = useRef<User | null>(user);
  
  const [walkInName, setWalkInName] = useState<string | null>(null);

  const [barberName, setBarberName] = useState<string | null>(initialQueueData?.barber_name || null);
  const [chairNumber, setChairNumber] = useState<string | null>(initialQueueData?.chair_number || null);
  const [hasRated, setHasRated] = useState<boolean>(!!initialQueueData?.is_rated);
  const [joinedAt, setJoinedAt] = useState<string | null>(initialQueueData?.joined_at || null);

  const [selectedBarberId, setSelectedBarberId] = useState<string>("next");

  const [barberRating, setBarberRating] = useState(0);
  const [hoverBarberRating, setHoverBarberRating] = useState(0);
  const [barbershopRating, setBarbershopRating] = useState(0);
  const [hoverBarbershopRating, setHoverBarbershopRating] = useState(0);
  
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const turnstileRef = useRef<TurnstileInstance>(null); 
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  const [showManualPin, setShowManualPin] = useState(false); 
  const [manualPin, setManualPin] = useState("");            
  const [verifyingPin, setVerifyingPin] = useState(false);   

  // FIX CRÍTICO: Memoização do client do Supabase
  const [supabase] = useState(() => createClient()); 
  
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Cliente";
  const estimatedWaitTime = waitingCount * 20;

  // React Hook Form para o Cliente Avulso
  const {
    register,
    handleSubmit,
    setValue,
    reset: resetWalkInForm,
    formState: { errors, isSubmitting: isSubmittingWalkIn }
  } = useForm<WalkInFormValues>({
    resolver: zodResolver(walkInSchema),
    mode: "onChange",
    defaultValues: { clientName: "", phone: "", email: "" }
  });

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "America/Sao_Paulo"
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  // Mantém a ref do usuário sempre atualizada
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Função centralizada para atualizar ID de forma síncrona
  const handleSetQueueId = (id: string | null) => {
    setQueueId(id);
    queueIdRef.current = id;
  };

  // BUSCA INDIVIDUAL (Auto-cura para WebSockets caídos ou se o celular desligou a tela)
  const syncMyStatus = useCallback(async () => {
    const activeQueueId = queueIdRef.current;
    const currentUser = userRef.current;
    
    if (!currentUser && !activeQueueId) return;

    let query = supabase
      .from("virtual_queue")
      .select("*")
      .eq("barbershop_id", barbershopId)
      .order("joined_at", { ascending: false })
      .limit(1);
      
    if (currentUser) {
      query = query.eq("client_auth_id", currentUser.id);
    } else if (activeQueueId) {
      query = query.eq("id", activeQueueId);
    }

    const { data } = await query.maybeSingle();
    if (data) {
      handleSetQueueId(data.id);
      setCurrentStatus(data.status);
      setBarberName(data.barber_name);
      setChairNumber(data.chair_number);
      setHasRated(data.is_rated);
      setJoinedAt(data.joined_at);
      setInQueue(!isTerminalStatus(data.status));
    }
  }, [barbershopId, supabase]);

  const updateGlobalCountAndPosition = useCallback(async (forcedQueueId?: string | null) => {
    const { data: waitingList } = await supabase
      .from("virtual_queue")
      .select("id, client_auth_id")
      .eq("barbershop_id", barbershopId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (waitingList) {
      setWaitingCount(waitingList.length);
      
      const activeQueueId = forcedQueueId !== undefined ? forcedQueueId : queueIdRef.current;
      const currentUser = userRef.current;

      if (currentUser) {
        const idx = waitingList.findIndex(x => x.client_auth_id === currentUser.id);
        setUserPosition(idx !== -1 ? idx + 1 : null);
      } else if (activeQueueId) {
        const idx = waitingList.findIndex(x => x.id === activeQueueId);
        setUserPosition(idx !== -1 ? idx + 1 : null);
      } else {
        setUserPosition(null);
      }
    } else {
      setWaitingCount(0);
      setUserPosition(null);
    }
  }, [barbershopId, supabase]); 

  // Transformando as funções em Refs para não causarem re-renders
  const syncRef = useRef(syncMyStatus);
  useEffect(() => { 
    syncRef.current = syncMyStatus; 
  }, [syncMyStatus]);
  
  const updateGlobalRef = useRef(updateGlobalCountAndPosition);
  useEffect(() => { 
    updateGlobalRef.current = updateGlobalCountAndPosition; 
  }, [updateGlobalCountAndPosition]);

  // =========================================================================
  // CANAL WEBSOCKET BLINDADO
  // =========================================================================
  useEffect(() => {
    // Canal único por barbearia (não desconecta nunca!)
    const channel = supabase
      .channel(`public-queue-${barbershopId}`)
      .on(
        "postgres_changes", 
        { event: "*", schema: "public", table: "virtual_queue", filter: `barbershop_id=eq.${barbershopId}` }, 
        () => {
          // A MÁGICA AQUI: Não importam os dados quebrados do payload.
          // Se qualquer coisa mudou na fila, a gente sincroniza a sua posição real!
          if (syncRef.current) syncRef.current();
          if (updateGlobalRef.current) updateGlobalRef.current();
        }
      )
      .subscribe();

    // Sincronização inicial pra garantir a tela certa no F5
    if (syncRef.current) syncRef.current();
    if (updateGlobalRef.current) updateGlobalRef.current();

    return () => { supabase.removeChannel(channel); };
  }, [barbershopId, supabase]);

  // SENSOR DE TELA LIGADA (Cura a perda de eventos no 4G quando bloqueia a tela)
  useEffect(() => {
    const handleVisibilityAndFocus = () => {
      if (document.visibilityState === 'visible') {
        if (syncRef.current) syncRef.current();
        if (updateGlobalRef.current) updateGlobalRef.current();
      }
    };
    window.addEventListener('visibilitychange', handleVisibilityAndFocus);
    window.addEventListener('focus', handleVisibilityAndFocus);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityAndFocus);
      window.removeEventListener('focus', handleVisibilityAndFocus);
    };
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const currentPath = window.location.pathname;
    const nextUrl = isLocal ? `${currentPath}?origem=balcao` : currentPath;

    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: "google", 
      options: { 
        redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextUrl)}` 
      } 
    });
    
    if (error) { 
      toast.error("Erro ao conectar com Google."); 
      setLoading(false); 
    }
  };

  const handleLogout = async () => { 
    setLoading(true); 
    await supabase.auth.signOut(); 
    window.location.assign(window.location.pathname); 
  };

  const handleRejoinQueue = () => {
    const timestamp = new Date().getTime();
    window.location.assign(`${window.location.pathname}?t=${timestamp}${isLocal ? '&origem=balcao' : ''}`);
  };

  // Submissão para quem JÁ ESTÁ LOGADO (Via Google)
  const handleJoinQueue = async () => {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (!turnstileToken && !isLocalhost) { 
      toast.error("Aguarde a validação de segurança..."); 
      return; 
    }
    
    setLoading(true);
    try {
      const finalBarberId = selectedBarberId === "next" ? null : selectedBarberId;
      const res = await fetch('/api/join-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbershopId: barbershopId, 
          clientName: userName,
          barberId: finalBarberId,
          turnstileToken: turnstileToken || "bypass_for_localhost" 
        })
      });

      const textResponse = await res.text();
      let result;
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        console.error("Erro HTML recebido do servidor:", textResponse, e);
        toast.error("Erro interno (500). Verifique o terminal do VS Code.");
        setLoading(false);
        return;
      }
      
      if (result.error) {
        toast.error(result.error);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        handleSetQueueId(result.queueId);
        setInQueue(true);
        setCurrentStatus("waiting");
        if (updateGlobalRef.current) updateGlobalRef.current(result.queueId);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão. Tente novamente.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setLoading(false);
    }
  };

  // Submissão para QUEM É AVULSO (Sem Conta)
  const onSubmitWalkIn = async (data: WalkInFormValues) => {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (!turnstileToken && !isLocalhost) { 
      toast.error("Aguarde a validação de segurança..."); 
      return; 
    }
    
    try {
      const finalBarberId = selectedBarberId === "next" ? null : selectedBarberId;
      const res = await fetch('/api/join-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          barbershopId: barbershopId, 
          clientName: data.clientName,
          phone: data.phone,
          email: data.email,
          barberId: finalBarberId,
          turnstileToken: turnstileToken || "bypass_for_localhost" 
        })
      });

      const textResponse = await res.text();
      let result;
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        console.error("Erro HTML recebido do servidor:", textResponse, e);
        toast.error("Erro interno (500). Verifique o terminal do VS Code.");
        return;
      }
      
      if (result.error) {
        toast.error(result.error);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        toast.success("Cliente adicionado à fila!");
        // Salva os dados para entrar na tela ao vivo instantaneamente
        handleSetQueueId(result.queueId);
        setWalkInName(data.clientName);
        setInQueue(true);
        setCurrentStatus("waiting");
        if (updateGlobalRef.current) updateGlobalRef.current(result.queueId);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão. Tente novamente.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  // Sair ou Cancelar a fila
  const handleLeaveQueue = async () => {
    if (!queueIdRef.current) return;
    try {
      await fetch('/api/leave-queue', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ queueId: queueIdRef.current, barbershopId })
      });
      toast.success("Cancelado com sucesso.");
      
      setInQueue(false);
      handleSetQueueId(null);
      setWalkInName(null);
      setCurrentStatus(null);
      resetWalkInForm();
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      if (updateGlobalRef.current) updateGlobalRef.current(null);
    } catch (error) { 
      toast.error("Erro ao cancelar a fila."); 
    }
  };

  // Reset total para deixar a tela limpa para outra pessoa no tablet
  const handleResetWalkInView = () => {
    setInQueue(false);
    handleSetQueueId(null);
    setWalkInName(null);
    setCurrentStatus(null);
    resetWalkInForm();
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  };

  const handleScanSuccess = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const text = detectedCodes[0].rawValue;
      if (text.includes("origem=balcao")) { 
        toast.success("Presença confirmada!"); 
        setIsScanning(false); 
        window.location.assign(text); 
      } else { 
        toast.error("QR Code inválido."); 
        setIsScanning(false); 
      }
    }
  };

  const handleVerifyPin = async () => {
    if (!manualPin || manualPin.length < 4) return;
    setVerifyingPin(true);
    try {
      const res = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barbershopId, providedPin: manualPin })
      });
      const result = await res.json();
      if (result.success) {
        window.location.assign(`${window.location.pathname}?origem=balcao`);
      } else {
        toast.error(result.error);
        setVerifyingPin(false);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão. Tente novamente.");
      setVerifyingPin(false);
    }
  };

  const handleSubmitReview = async () => {
    const activeId = queueIdRef.current;
    if (!activeId || barberRating === 0 || barbershopRating === 0) return;
    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: activeId, barbershopId, barberName, barberRating, barbershopRating, comment: reviewComment })
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Obrigado pela sua avaliação!");
        setHasRated(true); 
      } else {
        toast.error(result.error || "Erro ao enviar avaliação.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // DRY: Fragmentos Reutilizáveis
  const renderBarberSelection = () => (
    <div className="w-full mt-2">
      <Label className="flex items-center justify-center gap-2 text-[11px] font-black text-slate-500 uppercase tracking-widest mb-4">
        <Scissors className="size-4 text-blue-500" /> Preferência de Barbeiro?
      </Label>
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <button
          type="button"
          onClick={() => setSelectedBarberId("next")}
          className={cn(
            "snap-start shrink-0 w-28 flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.98]",
            selectedBarberId === "next" ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
          )}
        >
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center transition-colors", selectedBarberId === "next" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-500")}>
            <Zap className="size-6" />
          </div>
          <div className="text-center w-full">
            <p className={cn("text-xs font-black line-clamp-1", selectedBarberId === "next" ? "text-blue-700" : "text-slate-700")}>Qualquer um</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Mais Rápido</p>
          </div>
        </button>

        {barbers.map((b) => {
          const isSelected = selectedBarberId === b.id;
          const firstName = b.full_name.split(' ')[0];
          return (
            <button key={b.id} type="button" onClick={() => setSelectedBarberId(b.id)} className={cn("snap-start shrink-0 w-28 flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border-2 transition-all active:scale-[0.98]", isSelected ? "border-blue-500 bg-blue-50/50 shadow-sm" : "border-slate-100 bg-white hover:border-slate-200")}>
              {b.avatar_url ? (
                <Image src={b.avatar_url} alt={firstName} width={48} height={48} className={cn("w-12 h-12 rounded-full object-cover shadow-sm transition-all", isSelected ? "ring-2 ring-blue-500 ring-offset-2" : "border border-slate-200")} />
              ) : (
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-sm transition-all", isSelected ? "bg-blue-500 text-white ring-2 ring-blue-500 ring-offset-2" : "bg-slate-200 text-slate-500 border border-slate-300")}>
                  {getInitials(b.full_name)}
                </div>
              )}
              <div className="text-center w-full">
                <p className={cn("text-xs font-bold line-clamp-1", isSelected ? "text-blue-700" : "text-slate-700")}>{firstName}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Barbeiro</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderTurnstile = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return null;
    }

    return (
      <div className="flex justify-center w-full min-h-25 mt-2 mb-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center w-full space-y-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck className="size-4 text-emerald-500" />
            <span>Validação de Segurança</span>
          </div>
          <Turnstile ref={turnstileRef} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={(token) => setTurnstileToken(token)} options={{ theme: "light" }} />
        </div>
      </div>
    );
  };

  if (!mounted) return null; 

  return (
    <div className="w-full space-y-6">
      
      {!isTerminalStatus(currentStatus) && (
        <div className="flex items-center justify-center gap-8 py-4 border-b border-slate-100 mb-2">
           <div className="flex flex-col items-center">
             <Users className="text-blue-500 mb-1" size={24} />
             <span className="font-black text-slate-800 text-lg">{waitingCount}</span>
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Na Fila</span>
           </div>
           <div className="w-px h-10 bg-slate-100"></div>
           <div className="flex flex-col items-center">
             <Clock className="text-amber-500 mb-1" size={24} />
             <span className="font-black text-slate-800 text-lg">{estimatedWaitTime} <span className="text-sm">min</span></span>
             <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Espera Est.</span>
           </div>
        </div>
      )}

      {/* SAUDAÇÃO INTELIGENTE (Para Logados ou Avulsos na Fila) */}
      {!isScanning && !showManualPin && !isTerminalStatus(currentStatus) && (
         <p className="text-sm font-medium text-slate-600 text-center">
           {user ? (
             <>Olá, <span className="font-bold text-slate-900">{userName}</span>!</>
           ) : walkInName && inQueue ? (
             <>Ficha de <span className="font-bold text-slate-900">{walkInName}</span></>
           ) : null}
         </p>
      )}

      {/* ========================================================= */}
      {/* FLUXO DESLOGADO: ABAS (Login vs Avulso) */}
      {/* ========================================================= */}
      {!user && !inQueue && !isTerminalStatus(currentStatus) && (
        <Tabs defaultValue="login" className="w-full animate-in fade-in">
          <TabsList className="grid w-full grid-cols-2 h-14 bg-slate-200/50 rounded-2xl mb-6 p-1">
            <TabsTrigger value="login" className="rounded-xl font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
              Fazer Login
            </TabsTrigger>
            <TabsTrigger value="avulso" className="rounded-xl font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
              Entrar Sem Conta
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Google Auth */}
          <TabsContent value="login" className="space-y-4 animate-in fade-in">
            <Button onClick={handleGoogleLogin} disabled={loading} variant="outline" className="w-full h-14 rounded-2xl border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm">
              {loading ? <Loader2 className="animate-spin size-5 text-slate-400" /> : "Identificar-se com Google"}
            </Button>
            <p className="text-xs text-center text-slate-500 font-medium px-4">
              Recomendado para pontuar no clube de fidelidade e visualizar o seu histórico completo.
            </p>
          </TabsContent>

          {/* Tab 2: Walk-In Form (Smart Merge) */}
          <TabsContent value="avulso" className="space-y-6 animate-in fade-in">
            <form onSubmit={handleSubmit(onSubmitWalkIn)} className="space-y-4">
              
              <div className="space-y-3 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">Seu Nome *</label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      {...register("clientName")} 
                      placeholder="Como podemos te chamar?" 
                      className={`pl-9 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600/20 ${errors.clientName ? 'border-red-400' : ''}`} 
                    />
                  </div>
                  {errors.clientName && <span className="text-[10px] text-red-500 font-bold ml-1 mt-1 block">{errors.clientName.message}</span>}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">WhatsApp (Opcional)</label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      {...register("phone")} 
                      placeholder="(11) 99999-9999" 
                      maxLength={15}
                      onChange={(e) => {
                        const masked = applyPhoneMask(e.target.value);
                        e.target.value = masked;
                        setValue("phone", masked, { shouldValidate: true });
                      }}
                      className={`pl-9 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600/20 ${errors.phone ? 'border-red-400' : ''}`} 
                    />
                  </div>
                  {errors.phone && <span className="text-[10px] text-red-500 font-bold ml-1 mt-1 block">{errors.phone.message}</span>}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail (Opcional)</label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      {...register("email")} 
                      type="email"
                      placeholder="Para enviar seu recibo" 
                      className={`pl-9 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600/20 ${errors.email ? 'border-red-400' : ''}`} 
                    />
                  </div>
                  {errors.email && <span className="text-[10px] text-red-500 font-bold ml-1 mt-1 block">{errors.email.message}</span>}
                </div>
              </div>

              {renderBarberSelection()}
              {renderTurnstile()}
              
              <Button type="submit" disabled={isSubmittingWalkIn || (!turnstileToken && typeof window !== 'undefined' && window.location.hostname !== 'localhost')} className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]">
                {isSubmittingWalkIn ? <Loader2 className="animate-spin size-6" /> : <div className="flex items-center gap-2"><Sparkles className="size-5" /><span>Entrar na Fila</span></div>}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      )}

      {/* ========================================================= */}
      {/* TELA DE AVALIAÇÃO: SÓ APARECE SE O STATUS FOR TERMINAL */}
      {/* ========================================================= */}
      {isTerminalStatus(currentStatus) && currentStatus !== "canceled" && (
        <div className="w-full animate-in zoom-in duration-300">
          {!hasRated ? (
            <div className="bg-white border-2 border-amber-100 rounded-[2rem] p-6 shadow-xl shadow-amber-100/50 flex flex-col items-center space-y-6">
              <div className="text-center space-y-1">
                <h3 className="font-black text-slate-900 text-xl">Como foi a experiência?</h3>
                <p className="text-sm text-slate-500 font-medium">Sua opinião ajuda a melhorar o serviço.</p>
              </div>

              <div className="w-full space-y-5">
                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-700 mb-2">O atendimento com {barberName}</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={`barber-${star}`} type="button" onClick={() => setBarberRating(star)} onMouseEnter={() => setHoverBarberRating(star)} onMouseLeave={() => setHoverBarberRating(0)} className="p-1 transition-transform hover:scale-110 focus:outline-none">
                        <Star size={32} className={`transition-colors duration-200 ${(hoverBarberRating || barberRating) >= star ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-sm font-bold text-slate-700 mb-2">O ambiente ({barbershopName})</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button key={`shop-${star}`} type="button" onClick={() => setBarbershopRating(star)} onMouseEnter={() => setHoverBarbershopRating(star)} onMouseLeave={() => setHoverBarbershopRating(0)} className="p-1 transition-transform hover:scale-110 focus:outline-none">
                        <Star size={32} className={`transition-colors duration-200 ${(hoverBarbershopRating || barbershopRating) >= star ? "fill-blue-500 text-blue-500" : "text-slate-200"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="w-full relative">
                <MessageSquare className="absolute left-3 top-3 text-slate-400 size-5" />
                <textarea placeholder="Deixe um elogio (opcional)..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-10 pr-4 py-3 text-sm font-medium text-slate-700 focus:border-amber-400 focus:ring-0 outline-none resize-none h-20" />
              </div>

              <div className="w-full space-y-3 pt-2">
                <Button 
                  onClick={handleSubmitReview} 
                  disabled={barberRating === 0 || barbershopRating === 0 || isSubmittingReview} 
                  className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl shadow-lg shadow-amber-200 transition-all active:scale-[0.98]"
                >
                  {isSubmittingReview ? <Loader2 className="animate-spin" /> : "Enviar Avaliação"}
                </Button>
                <button onClick={() => setHasRated(true)} className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-2">Pular avaliação</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6 pt-4">
               <div className="h-16 w-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                 <CheckCircle2 size={32} />
               </div>
               <div className="text-center px-4">
                 <h3 className="font-black text-slate-900 text-xl">Tudo pronto!</h3>
                 <p className="text-sm text-slate-500 font-medium mt-3 max-w-xs mx-auto leading-relaxed">
                   Seu último atendimento foi com o profissional <span className="font-bold text-slate-800">{barberName || "Barbeiro"}</span> em <span className="font-bold text-slate-800">{formatDateTime(joinedAt)}</span>.
                   <br /><br />
                   Ficamos felizes por escolher a <span className="font-bold text-blue-600">{barbershopName}</span>!
                 </p>
               </div>
               
               {isLocal ? (
                 <div className="w-full space-y-4 pt-4 border-t border-slate-100">
                    <Button onClick={user ? handleRejoinQueue : handleResetWalkInView} className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg shadow-lg transition-all active:scale-[0.98]">
                      Voltar para Início
                    </Button>
                 </div>
               ) : (
                  <p className="text-xs font-bold text-amber-500 bg-amber-50 px-4 py-2 rounded-lg">Dirija-se à barbearia para entrar novamente.</p>
               )}
            </div>
          )}
          
          {user ? (
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
              <LogOut size={14} /> Sair da conta
            </button>
          ) : (
            <button onClick={handleResetWalkInView} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
              <LogOut size={14} /> Encerrar sessão avulsa
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* STATUS NA FILA (Chamando para cadeira ou Esperando) */}
      {/* ========================================================= */}
      {inQueue && !isTerminalStatus(currentStatus) && (
        <div className="w-full">
          {currentStatus === "in_progress" || currentStatus === "serving" ? (
            <div className="space-y-4 animate-in zoom-in duration-500 flex flex-col items-center py-4 bg-emerald-50/60 rounded-[2rem] border border-emerald-100 p-4">
              <div className="h-16 w-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mb-2 shadow-md shadow-emerald-100 animate-pulse">
                <Scissors size={28} />
              </div>
              <h3 className="font-black text-emerald-900 text-xl">Sua vez chegou!</h3>
              <div className="text-center space-y-1">
                <p className="text-sm text-emerald-800 font-medium">Você está em atendimento com:</p>
                <p className="text-lg font-black text-slate-900 uppercase tracking-tight">{barberName}</p>
                {chairNumber && <p className="text-xs inline-block bg-white text-emerald-700 font-bold px-3 py-1 rounded-full border border-emerald-200 mt-2">Cadeira {chairNumber}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in flex flex-col items-center py-2">
              {userPosition === 1 ? (
                 <>
                   <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-2 shadow-inner animate-pulse ring-4 ring-blue-50">
                     <BellRing size={32} />
                   </div>
                   <h3 className="font-black text-blue-900 text-2xl tracking-tight">Você é o Próximo!</h3>
                   <p className="text-sm text-blue-600 text-center font-bold px-4">
                     Prepare-se, o barbeiro vai chamá-lo num instante.
                   </p>
                 </>
              ) : (
                 <>
                   <div className="h-16 w-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-2 shadow-inner">
                     <span className="text-3xl font-black">{userPosition || "-"}º</span>
                   </div>
                   <h3 className="font-black text-slate-900 text-xl">Você está na fila!</h3>
                   <p className="text-sm text-slate-500 text-center font-medium px-4">
                     Fique atento. Sua vez chegará em breve.
                   </p>
                 </>
              )}

              {/* Botões de Ação Dinâmicos para controle da fila */}
              <div className="w-full pt-4 space-y-3">
                 <Button onClick={handleLeaveQueue} variant="outline" className="w-full h-12 border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 font-semibold rounded-xl transition-all">
                   <XCircle className="size-4 mr-2" /> Cancelar / Sair da Fila
                 </Button>

                 {!user && (
                    <Button onClick={handleResetWalkInView} variant="ghost" className="w-full h-12 text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-semibold rounded-xl transition-all">
                      <LogOut className="size-4 mr-2" /> Deixar o celular para outra pessoa
                    </Button>
                 )}
              </div>
            </div>
          )}
          
          {user && (
            <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
              <LogOut size={14} /> Sair da conta Google
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* FLUXO LOGADO (Sem estar na fila) */}
      {/* ========================================================= */}
      {!inQueue && !isTerminalStatus(currentStatus) && user && (
        <>
          {/* Se estiver no tablet local, mostra o botão final de fila */}
          {isLocal && (
            <div className="w-full space-y-6 animate-in fade-in">
              {renderBarberSelection()}
              {renderTurnstile()}
              <div className="space-y-4">
                <Button onClick={handleJoinQueue} disabled={loading || (!turnstileToken && typeof window !== 'undefined' && window.location.hostname !== 'localhost')} className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]">
                  {loading ? <Loader2 className="animate-spin size-6" /> : <div className="flex items-center gap-2"><Sparkles className="size-5" /><span>Entrar na Fila</span></div>}
                </Button>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2"><LogOut size={14} />Não é você? Trocar de conta</button>
              </div>
            </div>
          )}

          {/* Se estiver em casa/remoto (Para ler o QR Code e confirmar presença) */}
          {!isLocal && !isScanning && !showManualPin && (
            <div className="space-y-4 w-full flex flex-col items-center animate-in fade-in">
              <div className="bg-blue-50 p-4 rounded-2xl w-full border border-blue-100 flex flex-col items-center text-center space-y-2 mb-2">
                <MapPin className="text-blue-500 mb-1" size={28} />
                <h4 className="font-bold text-blue-900">Acompanhamento Remoto</h4>
                <p className="text-xs text-blue-700/80 font-medium leading-relaxed">Para entrar na fila de atendimento, dirija-se até a recepção.</p>
              </div>
              <Button onClick={() => setIsScanning(true)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg">
                <Camera className="mr-2" size={20} /> Ler QR Code da Recepção
              </Button>
              <button onClick={() => setShowManualPin(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-4 pt-2 pb-2 transition-colors">
                Câmera não funciona? Digitar código
              </button>
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 border-t border-slate-100 mt-2">
                <LogOut size={14} /> Sair da conta
              </button>
            </div>
          )}

          {!isLocal && isScanning && (
            <div className="space-y-4 w-full flex flex-col items-center animate-in zoom-in">
              <div className="w-full max-w-70 rounded-2xl overflow-hidden shadow-lg border-4 border-slate-800">
                <Scanner onScan={handleScanSuccess} onError={(err: unknown) => console.log(err)} />
              </div>
              <Button onClick={() => setIsScanning(false)} variant="ghost" className="text-slate-500 w-full">Cancelar leitura</Button>
            </div>
          )}

          {!isLocal && showManualPin && (
            <div className="space-y-4 w-full flex flex-col items-center animate-in slide-in-from-bottom-4">
              <div className="w-full space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                <label className="text-sm font-bold text-slate-700 block text-center">Digite o Código de Check-in</label>
                <input type="text" maxLength={6} value={manualPin} onChange={(e) => setManualPin(e.target.value)} placeholder="Ex: 7392" className="w-full h-14 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-2xl font-black tracking-widest text-slate-800 focus:border-blue-500 outline-none transition-all" />
                <Button onClick={handleVerifyPin} disabled={verifyingPin} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl">
                  {verifyingPin ? <Loader2 className="animate-spin size-5" /> : "Validar Código"}
                </Button>
              </div>
              <Button onClick={() => setShowManualPin(false)} variant="ghost" className="text-slate-500 w-full">Voltar para QR Code</Button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
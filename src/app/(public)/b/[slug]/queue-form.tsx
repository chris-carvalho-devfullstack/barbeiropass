// src/app/(public)/b/[slug]/queue-form.tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { toast } from "sonner";
import { useRouter } from "next/navigation"; 
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
// ÍCONE OFICIAL DO GOOGLE (SVG OTIMIZADO E SEGURO)
// =========================================================================
const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

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
  
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isTerminalStatus = useCallback((status: string | null) => {
    return status === "awaiting_payment" || status === "completed" || status === "finished" || status === "cancelled";
  }, []);

  const [waitingCount, setWaitingCount] = useState(initialWaitingCount);
  const [userPosition, setUserPosition] = useState<number | null>(initialUserPosition);
  
  const [inQueue, setInQueue] = useState(!!initialQueueData && !isTerminalStatus(initialQueueData.status)); 
  const [currentStatus, setCurrentStatus] = useState<string | null>(initialQueueData?.status || null);
  
  const [queueId, setQueueId] = useState<string | null>(initialQueueData?.id || null);
  const queueIdRef = useRef<string | null>(queueId);
  const userRef = useRef<User | null>(user);
  
  const [walkInName, setWalkInName] = useState<string | null>(null);

  // Estados para Login com E-mail
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

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
  const [countdown, setCountdown] = useState<number | null>(null);

  const [supabase] = useState(() => createClient()); 
  
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Cliente";
  const estimatedWaitTime = waitingCount * 20;

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

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const handleSetQueueId = useCallback((id: string | null) => {
    setQueueId(id);
    queueIdRef.current = id;
  }, []);

  const handleResetTerminalState = useCallback(() => {
    setInQueue(false);
    handleSetQueueId(null);
    setCurrentStatus(null);
    setWalkInName(null);
    if (typeof document !== "undefined") {
      document.cookie = "walkInQueueId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"; 
    }
  }, [handleSetQueueId]);

  const handleResetWalkInView = useCallback(() => {
    setInQueue(false);
    handleSetQueueId(null);
    setWalkInName(null);
    setCurrentStatus(null);
    resetWalkInForm();
    turnstileRef.current?.reset();
    setTurnstileToken(null);
    if (typeof document !== "undefined") {
      document.cookie = "walkInQueueId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"; 
    }
  }, [handleSetQueueId, resetWalkInForm]);

  // =========================================================================
  // SINCRONIZAÇÃO FORÇADA DE DADOS DO SERVIDOR
  // =========================================================================
  useEffect(() => {
    if (initialQueueData) {
       const isTerminal = isTerminalStatus(initialQueueData.status);
       if (initialQueueData.id === queueIdRef.current || !queueIdRef.current) {
          setCurrentStatus(initialQueueData.status);
          if (initialQueueData.barber_name) setBarberName(initialQueueData.barber_name);
          if (initialQueueData.chair_number) setChairNumber(initialQueueData.chair_number);
          setHasRated(initialQueueData.is_rated);
          setInQueue(!isTerminal);
          if (!queueIdRef.current) {
             handleSetQueueId(initialQueueData.id);
          }
       }
    }
  }, [initialQueueData, isTerminalStatus, handleSetQueueId]);

  // =========================================================================
  // O RADAR SILENCIOSO
  // =========================================================================
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (inQueue) {
       interval = setInterval(() => {
          router.refresh(); 
       }, 8000); 
    }
    return () => {
       if (interval) clearInterval(interval);
    };
  }, [inQueue, router]);

  // =========================================================================
  // TIMER: RETORNO AUTOMÁTICO PARA A TELA INICIAL
  // =========================================================================
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const isTerminal = isTerminalStatus(currentStatus);
    if (isTerminal && currentStatus !== "cancelled" && hasRated && userRef.current) {
      setCountdown(20); 
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null) return null;
          if (prev <= 1) {
            clearInterval(interval);
            handleResetTerminalState();
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setCountdown(null);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentStatus, hasRated, isTerminalStatus, handleResetTerminalState]);

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
      const isTerminal = isTerminalStatus(data.status);

      if (isTerminal && data.is_rated) {
         if (queueIdRef.current !== data.id) {
           handleSetQueueId(null);
           setCurrentStatus(null);
           setInQueue(false);
           if (typeof document !== "undefined") document.cookie = "walkInQueueId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
           return; 
         }
      }

      handleSetQueueId(data.id);
      setCurrentStatus(data.status);
      setBarberName(data.barber_name);
      setChairNumber(data.chair_number);
      setHasRated(data.is_rated);
      setJoinedAt(data.joined_at);
      setInQueue(!isTerminal);
    }
  }, [barbershopId, supabase, isTerminalStatus, handleSetQueueId]);

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

  const syncRef = useRef(syncMyStatus);
  useEffect(() => { 
    syncRef.current = syncMyStatus; 
  }, [syncMyStatus]);
  
  const updateGlobalRef = useRef(updateGlobalCountAndPosition);
  useEffect(() => { 
    updateGlobalRef.current = updateGlobalCountAndPosition; 
  }, [updateGlobalCountAndPosition]);

  // =========================================================================
  // RECUPERAÇÃO DE SESSÃO AVULSA
  // =========================================================================
  useEffect(() => {
    if (!user && !initialQueueData && typeof window !== "undefined") {
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
      };
      
      const savedQueueId = getCookie("walkInQueueId");
      if (savedQueueId && savedQueueId !== "undefined" && savedQueueId !== "null") {
        handleSetQueueId(savedQueueId);
        setTimeout(() => {
          if (syncRef.current) syncRef.current();
        }, 100);
      }
    }
  }, [user, initialQueueData, handleSetQueueId]);

  useEffect(() => {
    const channel = supabase
      .channel(`public-queue-${barbershopId}`)
      .on(
        "postgres_changes", 
        { event: "*", schema: "public", table: "virtual_queue" }, 
        (payload) => {
          
          if (payload.new && (payload.new as QueueRowPayload).id === queueIdRef.current) {
             const data = payload.new as QueueRowPayload;
             const isTerminal = isTerminalStatus(data.status);

             if (isTerminal && data.is_rated) {
                if (queueIdRef.current !== data.id) {
                  handleResetTerminalState();
                  return;
                }
             }

             handleSetQueueId(data.id);
             setCurrentStatus(data.status);
             if (data.barber_name) setBarberName(data.barber_name);
             if (data.chair_number) setChairNumber(data.chair_number);
             setHasRated(data.is_rated);
             if (data.joined_at) setJoinedAt(data.joined_at);
             setInQueue(!isTerminal);
          } else {
             if (syncRef.current) syncRef.current();
          }

          if (updateGlobalRef.current) updateGlobalRef.current();
        }
      )
      .subscribe();

    if (syncRef.current) syncRef.current();
    if (updateGlobalRef.current) updateGlobalRef.current();

    return () => { supabase.removeChannel(channel); };
  }, [barbershopId, supabase, isTerminalStatus, handleSetQueueId, handleResetTerminalState]);

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

  // =========================================================================
  // HANDLERS DE AUTENTICAÇÃO (Seguros via Turnstile)
  // =========================================================================
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (!turnstileToken && !isLocalhost) { 
      toast.error("Aguarde a validação de segurança..."); 
      return; 
    }
    if (!loginEmail || !loginPassword) {
      toast.error("Preencha e-mail e senha para continuar.");
      return;
    }
    
    setLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      toast.error("Credenciais inválidas. Verifique seu e-mail e senha.");
      setLoading(false);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } else {
      toast.success("Login realizado com sucesso!");
      window.location.reload(); 
    }
  };

  const handleGoogleLogin = async () => {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (!turnstileToken && !isLocalhost) { 
      toast.error("Aguarde a validação de segurança..."); 
      return; 
    }
    
    setLoading(true);
    const currentPath = window.location.pathname;
    let nextUrl = isLocal ? `${currentPath}?origem=balcao` : currentPath;

    if (queueIdRef.current && queueIdRef.current !== "undefined") {
      nextUrl += (nextUrl.includes('?') ? '&' : '?') + `link_queue=${queueIdRef.current}`;
    }

    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: "google", 
      options: { 
        redirectTo: `${window.location.origin}/callback?next=${encodeURIComponent(nextUrl)}` 
      } 
    });
    
    if (error) { 
      toast.error("Erro ao conectar com Google."); 
      setLoading(false); 
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  const handleLogout = async () => { 
    setLoading(true); 
    await supabase.auth.signOut(); 
    window.location.assign(window.location.pathname); 
  };

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
        toast.error("Erro interno (500). Verifique o terminal do VS Code.");
        setLoading(false);
        return;
      }
      
      if (result.error) {
        toast.error(result.error);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        const newQueueId = result.queueId || result.id || (result.data && result.data.id);
        if (!newQueueId) {
           toast.error("Erro no sistema: A API não devolveu o ID da fila.");
           setLoading(false);
           return;
        }

        handleSetQueueId(newQueueId);
        setInQueue(true);
        setCurrentStatus("waiting");
        if (updateGlobalRef.current) updateGlobalRef.current(newQueueId);
      }
      setLoading(false);
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setLoading(false);
    }
  };

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
        toast.error("Erro interno (500). Verifique o terminal do VS Code.");
        return;
      }
      
      if (result.error) {
        toast.error(result.error);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      } else {
        const newQueueId = result.queueId || result.id || (result.data && result.data.id);
        
        if (!newQueueId) {
           toast.error("Erro no sistema: A API não devolveu o ID da fila.");
           return;
        }

        toast.success("Cliente adicionado à fila!");
        handleSetQueueId(newQueueId);
        setWalkInName(data.clientName);
        setInQueue(true);
        setCurrentStatus("waiting");
        
        if (typeof document !== "undefined") {
          document.cookie = `walkInQueueId=${newQueueId}; path=/; max-age=86400; SameSite=Lax`;
        }

        if (updateGlobalRef.current) updateGlobalRef.current(newQueueId);
      }
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

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
      if (typeof document !== "undefined") {
        document.cookie = "walkInQueueId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      if (updateGlobalRef.current) updateGlobalRef.current(null);
    } catch (error) { 
      toast.error("Erro ao cancelar a fila."); 
    }
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
        body: JSON.stringify({ 
          queueId: activeId, 
          barbershopId, 
          barberName, 
          barberRating, 
          barbershopRating, 
          comment: reviewComment,
          skipped: false 
        })
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Obrigado pela sua avaliação!");
        setHasRated(true); 
      } else {
        toast.error(result.error || "Erro ao enviar avaliação.");
      }
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSkipReview = async () => {
    const activeId = queueIdRef.current;
    if (!activeId) return;
    
    setIsSubmittingReview(true);
    try {
      const res = await fetch('/api/submit-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          queueId: activeId, 
          barbershopId, 
          skipped: true
        })
      });
      
      const result = await res.json();
      if (result.success) {
        setHasRated(true); 
      } else {
        toast.error(result.error || "Erro ao pular avaliação.");
      }
    } catch (error) {
      toast.error("Erro de conexão. Tente novamente.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
      {/* TELA DE CHECK-IN / ENTRADA NA FILA                        */}
      {/* ========================================================= */}
      {!inQueue && !isTerminalStatus(currentStatus) && (
        <>
          {/* 1. SE FOR REMOTO (NÃO LOCAL): BLOQUEIA TUDO E EXIGE QR CODE */}
          {!isLocal ? (
            <>
              {!isScanning && !showManualPin && (
                <div className="space-y-4 w-full flex flex-col items-center animate-in fade-in">
                  <div className="bg-blue-50 p-4 rounded-2xl w-full border border-blue-100 flex flex-col items-center text-center space-y-2 mb-2">
                    <MapPin className="text-blue-500 mb-1" size={28} />
                    <h4 className="font-bold text-blue-900">Acompanhamento Remoto</h4>
                    <p className="text-xs text-blue-700/80 font-medium leading-relaxed">Para entrar na fila de atendimento, dirija-se até a recepção da barbearia.</p>
                  </div>
                  <Button onClick={() => setIsScanning(true)} className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg">
                    <Camera className="mr-2" size={20} /> Ler QR Code da Recepção
                  </Button>
                  <button onClick={() => setShowManualPin(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-800 underline underline-offset-4 pt-2 pb-2 transition-colors">
                    Câmera não funciona? Digitar código
                  </button>
                  
                  {user ? (
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 border-t border-slate-100 mt-2">
                      <LogOut size={14} /> Sair da conta
                    </button>
                  ) : (
                    <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 border-t border-slate-100 mt-2">
                      <UserIcon size={14} /> Fazer Login Antecipado
                    </button>
                  )}
                </div>
              )}

              {isScanning && (
                <div className="space-y-4 w-full flex flex-col items-center animate-in zoom-in">
                  <div className="w-full max-w-70 rounded-2xl overflow-hidden shadow-lg border-4 border-slate-800">
                    <Scanner onScan={handleScanSuccess} onError={(err: unknown) => console.log(err)} />
                  </div>
                  <Button onClick={() => setIsScanning(false)} variant="ghost" className="text-slate-500 w-full">Cancelar leitura</Button>
                </div>
              )}

              {showManualPin && (
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
          ) : (
            /* 2. SE ESTIVER NA BARBEARIA (LOCAL): MOSTRA AS OPÇÕES DE ENTRAR */
            <>
              {user ? (
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
              ) : (
                <Tabs defaultValue="login" className="w-full animate-in fade-in">
                  <TabsList className="grid w-full grid-cols-2 h-14 bg-slate-200/50 rounded-2xl mb-6 p-1">
                    <TabsTrigger value="login" className="rounded-xl font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                      Fazer Login
                    </TabsTrigger>
                    <TabsTrigger value="avulso" className="rounded-xl font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                      Entrar Sem Conta
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="space-y-6 animate-in fade-in">
                    <div className="space-y-3">
                      <Button 
                        onClick={handleGoogleLogin} 
                        disabled={loading || (!turnstileToken && typeof window !== 'undefined' && window.location.hostname !== 'localhost')} 
                        variant="outline" 
                        className="w-full h-14 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl shadow-sm transition-all active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="animate-spin size-5 text-slate-400" /> : (
                          <div className="flex items-center justify-center gap-2">
                            <GoogleIcon className="size-5" />
                            <span>Identificar-se com Google</span>
                          </div>
                        )}
                      </Button>
                      <p className="text-xs text-center text-slate-500 font-medium px-4">
                        Recomendado para pontuar no clube de fidelidade e visualizar o seu histórico completo.
                      </p>
                    </div>

                    <div className="relative flex items-center py-2">
                      <div className="flex-grow border-t border-slate-200"></div>
                      <span className="shrink-0 mx-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ou com e-mail</span>
                      <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    <form onSubmit={handleEmailLogin} className="space-y-4 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
                        <div className="relative mt-1">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            type="email" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="seu@email.com" 
                            className="pl-9 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600/20" 
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center ml-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Senha</label>
                          <a href="#" className="text-[10px] font-bold text-blue-500 hover:text-blue-700 transition-colors">Esqueci a senha</a>
                        </div>
                        <div className="relative mt-1">
                          <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            type="password" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="Sua senha secreta" 
                            className="pl-9 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-blue-600/20" 
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        disabled={loading || (!turnstileToken && typeof window !== 'undefined' && window.location.hostname !== 'localhost')} 
                        className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl shadow-lg transition-all active:scale-[0.98]"
                      >
                        {loading ? <Loader2 className="animate-spin size-6" /> : "Entrar com E-mail"}
                      </Button>
                    </form>

                    {renderTurnstile()}
                  </TabsContent>

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
            </>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* TELAS FINAIS: CONVERSÃO (Avulsos) OU AVALIAÇÃO (Logados)  */}
      {/* ========================================================= */}
      {isTerminalStatus(currentStatus) && currentStatus !== "cancelled" && (
        <div className="w-full animate-in zoom-in duration-300">
          
          {/* SE NÃO TEM CONTA: MOSTRA A TELA DE CONVERSÃO */}
          {!user ? (
            <div className="bg-white border-2 border-blue-100 rounded-[2rem] p-6 shadow-xl shadow-blue-100/50 flex flex-col items-center space-y-6">
              <div className="h-16 w-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                <Sparkles size={32} />
              </div>
              
              <div className="text-center space-y-2">
                <h3 className="font-black text-slate-900 text-2xl">Ficou no capricho?</h3>
                <p className="text-sm text-slate-500 font-medium">
                  Crie sua conta em 3 segundos para avaliar o {barberName || "barbeiro"} e desbloquear vantagens exclusivas!
                </p>
              </div>

              <div className="w-full space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-lg text-amber-600"><Star size={16} /></div>
                  <p className="text-xs font-bold text-slate-700">Avalie e favorite profissionais</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={16} /></div>
                  <p className="text-xs font-bold text-slate-700">Clube de Fidelidade e Cashback</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-600"><Scissors size={16} /></div>
                  <p className="text-xs font-bold text-slate-700">Histórico de cortes e estilo</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600"><Zap size={16} /></div>
                  <p className="text-xs font-bold text-slate-700">Fila expressa em 1 clique</p>
                </div>
              </div>

              <div className="w-full space-y-3 pt-2">
                {renderTurnstile()}
                <Button 
                  onClick={handleGoogleLogin} 
                  disabled={loading || (!turnstileToken && typeof window !== 'undefined' && window.location.hostname !== 'localhost')}
                  className="w-full h-14 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black rounded-2xl shadow-lg shadow-slate-200/50 transition-all active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="animate-spin text-slate-400" /> : (
                    <div className="flex items-center justify-center gap-2">
                      <GoogleIcon className="size-5" />
                      <span>Criar conta com Google</span>
                    </div>
                  )}
                </Button>
                <button 
                  onClick={handleResetWalkInView} 
                  className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-2 transition-colors"
                >
                  Agora não, só quero sair
                </button>
              </div>
            </div>
          ) : (
            /* SE JÁ TEM CONTA: FLUXO NORMAL DE AVALIAÇÃO / SUCESSO */
            <>
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
                    <button 
                      onClick={handleSkipReview} 
                      disabled={isSubmittingReview}
                      className="w-full text-xs font-bold text-slate-400 hover:text-slate-600 py-2 disabled:opacity-50"
                    >
                      Pular avaliação
                    </button>
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
                   
                   <div className="w-full space-y-4 pt-4 border-t border-slate-100">
                     {!isLocal && (
                       <p className="text-xs font-bold text-amber-500 bg-amber-50 px-4 py-3 rounded-lg text-center">
                         Para entrar na fila novamente, faça a leitura do QR Code na recepção.
                       </p>
                     )}
                     <Button 
                       onClick={user ? handleResetTerminalState : handleResetWalkInView} 
                       className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all active:scale-[0.98]"
                     >
                       Voltar para a Tela Inicial {countdown !== null ? `(${countdown}s)` : ""}
                     </Button>
                   </div>
                </div>
              )}
              
              <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
                <LogOut size={14} /> Sair da conta
              </button>
            </>
          )}
        </div>
      )}

      {inQueue && !isTerminalStatus(currentStatus) && (
        <div className="w-full">
          {currentStatus === "in_progress" || currentStatus === "in_chair" ? (
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

    </div>
  );
}
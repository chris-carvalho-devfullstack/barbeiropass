"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { Turnstile } from "@marsidev/react-turnstile";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles, LogOut, CheckCircle2, MapPin, Camera, Users, Clock, Scissors, Star, MessageSquare, BellRing } from "lucide-react"; 
import { type User } from "@supabase/supabase-js"; 
import { joinPublicQueueAction, verifyCheckinPinAction } from "./actions"; 
import { submitReviewAction } from "@/app/(dashboard)/fila/actions"; 
import { Scanner, IDetectedBarcode } from "@yudiel/react-qr-scanner"; 

interface QueueFormProps {
  barbershopId: string;
  barbershopName: string;
  user: User | null; 
  isLocal: boolean;
  initialWaitingCount: number;
  initialQueueData: { id: string; status: string; barber_name: string | null; chair_number: string | null; is_rated: boolean } | null;
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
}

export default function QueueForm({ barbershopId, barbershopName, user, isLocal, initialWaitingCount, initialQueueData, initialUserPosition }: QueueFormProps) {
  const [waitingCount, setWaitingCount] = useState(initialWaitingCount);
  const [userPosition, setUserPosition] = useState<number | null>(initialUserPosition);
  
  const [inQueue, setInQueue] = useState(!!initialQueueData && initialQueueData.status !== "finished"); 
  const [currentStatus, setCurrentStatus] = useState<string | null>(initialQueueData?.status || null);
  const [queueId, setQueueId] = useState<string | null>(initialQueueData?.id || null);
  const [barberName, setBarberName] = useState<string | null>(initialQueueData?.barber_name || null);
  const [chairNumber, setChairNumber] = useState<string | null>(initialQueueData?.chair_number || null);
  const [hasRated, setHasRated] = useState<boolean>(!!initialQueueData?.is_rated);

  const [barberRating, setBarberRating] = useState(0);
  const [hoverBarberRating, setHoverBarberRating] = useState(0);
  const [barbershopRating, setBarbershopRating] = useState(0);
  const [hoverBarbershopRating, setHoverBarbershopRating] = useState(0);
  
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false); 
  const [showManualPin, setShowManualPin] = useState(false); 
  const [manualPin, setManualPin] = useState("");            
  const [verifyingPin, setVerifyingPin] = useState(false);   

  const supabase = createClient(); 
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Cliente";
  const estimatedWaitTime = waitingCount * 20;

  // Busca a lista ordenada atualizada para recalcular contagem e posições dinamicamente
  const updateGlobalCountAndPosition = useCallback(async () => {
    const { data: waitingList } = await supabase
      .from("virtual_queue")
      .select("id, client_auth_id")
      .eq("barbershop_id", barbershopId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (waitingList) {
      setWaitingCount(waitingList.length);
      if (user) {
        const idx = waitingList.findIndex(x => x.client_auth_id === user.id);
        setUserPosition(idx !== -1 ? idx + 1 : null);
      } else {
        setUserPosition(null);
      }
    } else {
      setWaitingCount(0);
      setUserPosition(null);
    }
  }, [barbershopId, user, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`live-public-queue-${barbershopId}`)
      .on(
        "postgres_changes", 
        { event: "*", schema: "public", table: "virtual_queue", filter: `barbershop_id=eq.${barbershopId}` }, 
        (payload) => {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newRow = payload.new as QueueRowPayload;

            if (user && newRow.client_auth_id === user.id) {
              setQueueId(newRow.id);
              setCurrentStatus(newRow.status);
              setBarberName(newRow.barber_name);
              setChairNumber(newRow.chair_number);
              setHasRated(newRow.is_rated);
              setInQueue(newRow.status !== "finished");
            }
          }
          // Recalcula a fila inteira para atualizar a posição sempre que alguém entrar ou sair
          updateGlobalCountAndPosition();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [barbershopId, user, updateGlobalCountAndPosition, supabase]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/callback?next=${window.location.pathname}${isLocal ? '?origem=balcao' : ''}` } });
    if (error) { toast.error("Erro ao conectar."); setLoading(false); }
  };

  const handleLogout = async () => { setLoading(true); await supabase.auth.signOut(); window.location.reload(); };

  const handleJoinQueue = async () => {
    if (!turnstileToken) { toast.error("Aguarde a validação de segurança..."); return; }
    setLoading(true);
    const result = await joinPublicQueueAction({ barbershopId, turnstileToken });
    if (result?.error) { toast.error(result.error); setLoading(false); }
  };

  const handleScanSuccess = (detectedCodes: IDetectedBarcode[]) => {
    if (detectedCodes && detectedCodes.length > 0) {
      const text = detectedCodes[0].rawValue;
      if (text.includes("origem=balcao")) { toast.success("Presença confirmada!"); setIsScanning(false); window.location.assign(text); } 
      else { toast.error("QR Code inválido."); setIsScanning(false); }
    }
  };

  const handleVerifyPin = async () => {
    if (!manualPin || manualPin.length < 4) return;
    setVerifyingPin(true);
    const result = await verifyCheckinPinAction(barbershopId, manualPin);
    if (result.success) window.location.assign(`${window.location.pathname}?origem=balcao`);
    else { toast.error(result.error); setVerifyingPin(false); }
  };

  const handleSubmitReview = async () => {
    if (!queueId || barberRating === 0 || barbershopRating === 0) return;
    setIsSubmittingReview(true);
    
    const res = await submitReviewAction(
      queueId, barbershopId, barberName, barberRating, barbershopRating, reviewComment
    ); 
    
    if (res.success) {
      toast.success("Obrigado pela sua avaliação!");
      setHasRated(true);
    } else {
      toast.error("Erro ao enviar avaliação.");
    }
    setIsSubmittingReview(false);
  };

  const resetToJoin = () => {
    setCurrentStatus(null);
    setQueueId(null);
    setHasRated(false);
    setBarberRating(0);
    setBarbershopRating(0);
    setReviewComment("");
  };

  return (
    <div className="w-full space-y-6">
      
      {currentStatus !== "finished" && (
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

      {user && !isScanning && !showManualPin && currentStatus !== "finished" && (
         <p className="text-sm font-medium text-slate-600">
           Olá, <span className="font-bold text-slate-900">{userName}</span>!
         </p>
      )}

      {/* TELA DE AVALIAÇÃO E RETORNO */}
      {currentStatus === "finished" && (
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
               <div className="text-center">
                 <h3 className="font-black text-slate-900 text-xl">Tudo pronto!</h3>
                 <p className="text-sm text-slate-500 font-medium mt-1">Último atendimento: {barberName}</p>
               </div>
               
               {isLocal ? (
                 <div className="w-full space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex justify-center w-full min-h-16.25">
                      <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={(token) => setTurnstileToken(token)} options={{ theme: "light" }} />
                    </div>
                    <Button onClick={() => { resetToJoin(); }} className="w-full h-16 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg shadow-lg transition-all active:scale-[0.98]">
                      Quero entrar na fila novamente
                    </Button>
                 </div>
               ) : (
                  <p className="text-xs font-bold text-amber-500 bg-amber-50 px-4 py-2 rounded-lg">Dirija-se à barbearia para entrar novamente.</p>
               )}
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
            <LogOut size={14} /> Sair da conta
          </button>
        </div>
      )}

      {/* INTERFACE EM FILA / ATENDIMENTO */}
      {inQueue && currentStatus !== "finished" && (
        <div className="w-full">
          {currentStatus === "in_progress" ? (
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
              
              {/* LÓGICA DE POSIÇÃO DINÂMICA */}
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

            </div>
          )}
          <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2 mt-6 border-t border-slate-100 w-full pt-4">
            <LogOut size={14} /> Sair da conta
          </button>
        </div>
      )}

      {/* ENTRADA DE FILA BASE */}
      {!inQueue && currentStatus !== "finished" && (
        <>
          {!user && (
            <Button onClick={handleGoogleLogin} disabled={loading} variant="outline" className="w-full h-14 rounded-2xl border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm">
              {loading ? <Loader2 className="animate-spin size-5 text-slate-400" /> : "Identificar-se com Google"}
            </Button>
          )}

          {user && !isLocal && !isScanning && !showManualPin && (
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

          {user && !isLocal && isScanning && (
            <div className="space-y-4 w-full flex flex-col items-center animate-in zoom-in">
              <div className="w-full max-w-70 rounded-2xl overflow-hidden shadow-lg border-4 border-slate-800">
                <Scanner onScan={handleScanSuccess} onError={(err: unknown) => console.log(err)} />
              </div>
              <Button onClick={() => setIsScanning(false)} variant="ghost" className="text-slate-500 w-full">Cancelar leitura</Button>
            </div>
          )}

          {user && !isLocal && showManualPin && (
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

          {user && isLocal && (
            <div className="w-full space-y-6 animate-in fade-in">
              <div className="flex justify-center w-full min-h-16.25">
                <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} onSuccess={(token) => setTurnstileToken(token)} options={{ theme: "light" }} />
              </div>
              <div className="space-y-4">
                <Button onClick={handleJoinQueue} disabled={loading || !turnstileToken} className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-lg shadow-blue-200 transition-all active:scale-[0.98]">
                  {loading ? <Loader2 className="animate-spin size-6" /> : <div className="flex items-center gap-2"><Sparkles className="size-5" /><span>Confirmar Entrada na Fila</span></div>}
                </Button>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors py-2"><LogOut size={14} />Não é você? Trocar de conta</button>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
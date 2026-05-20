"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { CloudSun, Scissors, Loader2, Users, Timer, History, Tv } from "lucide-react";

interface QueueItem {
  id: string;
  client_name: string;
  status: "waiting" | "in_progress" | "finished";
  joined_at: string;
}
export const runtime = 'edge';

export default function PublicMonitorPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [lastCalled, setLastCalled] = useState<string | null>(null);
  const [barbershop, setBarbershop] = useState<{ id: string; name: string } | null>(null);
  const [activeChairs, setActiveChairs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<{ temp: number; city: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude, longitude } = pos.coords;
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
        const weatherData = await weatherRes.json();
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
        const geoData = await geoRes.json();
        const city = geoData.address.city || geoData.address.town || geoData.address.suburb || "Sua Região";
        setWeather({ temp: Math.round(weatherData.current_weather.temperature), city });
      } catch (e) { console.error(e); }
    });
  }, []);

  const fetchMonitorData = useCallback(async (barbershopId: string) => {
    const { data: queueData } = await supabase
      .from("virtual_queue")
      .select("id, client_name, status, joined_at")
      .eq("barbershop_id", barbershopId)
      .in("status", ["waiting", "in_progress"])
      .order("joined_at", { ascending: true });

    const { data: historyData } = await supabase
      .from("virtual_queue")
      .select("client_name")
      .eq("barbershop_id", barbershopId)
      .eq("status", "in_progress")
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setQueue((queueData as QueueItem[]) || []);
    if (historyData) setLastCalled(historyData.client_name);
  }, [supabase]);

  useEffect(() => {
    if (!slug) return;
    let channel: any;

    async function init() {
      const { data: bData } = await supabase.from("barbershops").select("id, name").eq("slug", slug).single();
      if (bData) {
        setBarbershop(bData);
        await fetchMonitorData(bData.id);
        const { count } = await supabase.from("barbershop_members").select("*", { count: "exact", head: true }).eq("barbershop_id", bData.id);
        setActiveChairs(count || 0);
        setLoading(false);

        channel = supabase.channel(`monitor_${bData.id}`);
        channel.on("postgres_changes", { event: "*", schema: "public", table: "virtual_queue", filter: `barbershop_id=eq.${bData.id}` }, 
          () => fetchMonitorData(bData.id)
        ).subscribe();
      }
    }
    init();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [slug, supabase, fetchMonitorData]);

  const waitingList = queue.filter(i => i.status === "waiting");
  const estimatedWait = Math.round((waitingList.length * 25) / (activeChairs || 1));

  if (loading) return (
    <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-blue-600 size-16 mb-4" />
      <p className="text-slate-400 font-black tracking-widest uppercase text-sm">Barber Flow Monitor</p>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-50 text-slate-900 flex flex-col overflow-hidden font-sans z-[9999]">
      
      {/* HEADER - ALTURA REDUZIDA PARA GANHAR ESPAÇO */}
      <header className="h-[16vh] bg-white border-b border-slate-200 flex items-center justify-between px-16 shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <Scissors className="size-12 text-slate-900" />
          <div className="h-16 w-px bg-slate-200" />
          <div>
            <h1 className="text-5xl font-black uppercase tracking-tighter leading-none">{barbershop?.name}</h1>
            <p className="text-slate-400 font-bold uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
              <Tv className="size-4" /> Monitor Digital
            </p>
          </div>
        </div>

        <div className="flex items-center gap-12 text-right">
          <div>
            <div className="text-7xl font-black tabular-nums leading-none">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-slate-400 font-bold uppercase tracking-widest mt-1 text-sm">
              {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(currentTime)}
            </div>
          </div>
          {weather && (
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-3xl flex items-center gap-4 shadow-inner">
              <CloudSun className="text-amber-500 size-10" />
              <div className="text-left leading-tight">
                <span className="text-3xl font-black block">{weather.temp}°C</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{weather.city}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* CONTEÚDO - DISTRIBUIÇÃO CORRIGIDA */}
      <main className="flex-1 grid grid-cols-12 p-8 gap-8 min-h-0">
        
        {/* LADO ESQUERDO: O PRÓXIMO */}
        <div className="col-span-7 flex flex-col min-h-0">
          <div className="bg-white rounded-[3rem] border border-slate-200 shadow-xl flex-1 flex flex-col items-center justify-center p-12 relative overflow-hidden">
            <span className="bg-blue-600 text-white px-10 py-3 rounded-full text-xl font-black uppercase tracking-[0.4em] mb-8 shadow-lg shadow-blue-100 animate-pulse shrink-0">
                Próximo da Fila
            </span>

            {waitingList.length > 0 ? (
                <div className="flex flex-col items-center justify-center w-full min-h-0">
                    <h2 className="text-[10vw] font-black text-slate-900 tracking-tighter leading-none mb-6 italic text-center break-words w-full">
                        {waitingList[0].client_name.split(' ')[0]}
                    </h2>
                    <p className="text-3xl font-bold text-slate-400 uppercase tracking-[0.2em] border-t-2 border-slate-50 pt-8 px-10">
                        Favor dirigir-se à recepção
                    </p>
                </div>
            ) : (
                <div className="text-center opacity-10 flex flex-col items-center">
                    <Scissors size={150} />
                    <p className="text-4xl font-black uppercase mt-4 tracking-widest">Cadeiras Livres</p>
                </div>
            )}
          </div>
        </div>

        {/* LADO DIREITO: DASHBOARD - AJUSTE DE ALTURAS */}
        <div className="col-span-5 flex flex-col gap-6 min-h-0">
          
          {/* STATS: FILA E CADEIRAS (SHRINK-0) */}
          <div className="grid grid-cols-2 gap-6 shrink-0">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-md">
                <span className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest mb-2">
                    <Users size={16} className="text-blue-600" /> Na Fila
                </span>
                <p className="text-6xl font-black text-slate-900 leading-none">{waitingList.length}</p>
            </div>
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-md">
                <span className="flex items-center gap-2 text-slate-400 font-black uppercase text-[10px] tracking-widest mb-2">
                    <Scissors size={16} className="text-blue-600" /> Cadeiras Ativas
                </span>
                <p className="text-6xl font-black text-slate-900 leading-none">{activeChairs}</p>
            </div>
          </div>

          {/* ESPERA ESTIMADA - ALTURA REDUZIDA (SHRINK-0) */}
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-md flex flex-col justify-center shrink-0">
                <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-1">Espera Estimada</span>
                <p className="text-7xl font-black text-blue-600 leading-none">
                  {estimatedWait} <small className="text-2xl opacity-30 italic font-bold">min</small>
                </p>
          </div>

          {/* CHAMADO ANTERIORMENTE - AGORA TEM ESPAÇO (FLEX-1) */}
          <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl flex-1 flex flex-col justify-center min-h-0 overflow-hidden relative">
              <span className="flex items-center gap-3 text-white/30 font-black uppercase text-xs tracking-widest mb-3">
                  <History size={18} /> Chamado Anteriormente
              </span>
              <p className="text-6xl font-black tracking-tighter truncate leading-tight uppercase">
                {lastCalled || "..."}
              </p>
              <Scissors className="absolute -right-8 -bottom-8 size-40 text-white/5 -rotate-12" />
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="h-20 bg-white border-t border-slate-200 flex items-center overflow-hidden shrink-0">
        <div className="bg-blue-600 h-full flex items-center px-10 z-20 shadow-xl">
            <span className="text-white font-black uppercase tracking-widest text-base">Informativo</span>
        </div>
        <div className="flex-1 relative flex items-center h-full">
            <div className="flex gap-24 animate-marquee whitespace-nowrap">
                <span className="text-2xl font-bold text-slate-500">Mantenha seu cadastro atualizado para receber benefícios exclusivos.</span>
                <span className="text-2xl font-bold text-slate-500">Siga nosso Instagram para conferir os melhores cortes: @{slug}</span>
                <span className="text-2xl font-bold text-slate-500">Conheça nossa linha de produtos Barber Flow para cuidados em casa.</span>
            </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
      `}</style>
    </div>
  );
}
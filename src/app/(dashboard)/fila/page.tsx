"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateQueueStatusAction } from "./actions";
import { QRCodeSVG } from "qrcode.react";
import { 
  Users, 
  Play, 
  CheckCircle2, 
  XCircle, 
  QrCode, 
  Loader2, 
  UserCheck, 
  Monitor // <-- ADICIONADO AQUI
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// =========================================================================
// TIPAGENS
// =========================================================================
type QueueStatus = "waiting" | "in_progress" | "finished" | "cancelled";

interface QueueItem {
  id: string;
  client_name: string;
  client_id: string | null;
  status: "waiting" | "in_progress";
  joined_at: string;
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

export default function FilaDashboard() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [barbershop, setBarbershop] = useState<BarbershopInfo | null>(null);

  const supabase = useMemo(() => createClient(), []);

  const fetchQueue = useCallback(async (bid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("virtual_queue")
        .select("id, client_name, client_id, status, joined_at")
        .eq("barbershop_id", bid)
        .in("status", ["waiting", "in_progress"])
        .order("joined_at", { ascending: true });

      if (error) throw error;
      setQueue((data as QueueItem[]) || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar a lista da fila.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("barbershop_members")
          .select("barbershop_id, barbershops(slug)")
          .eq("profile_id", user.id)
          .single();

        const member = data as unknown as MemberResponse;

        if (error) throw error;

        if (member && member.barbershops) {
          const info = { 
            id: member.barbershop_id, 
            slug: member.barbershops.slug 
          };
          setBarbershop(info);
          fetchQueue(info.id);
        }
      } catch (error) {
        console.error(error);
        toast.error("Erro ao carregar dados da barbearia.");
      }
    }
    loadData();
  }, [supabase, fetchQueue]);

  async function handleStatus(id: string, status: QueueStatus) {
    const res = await updateQueueStatusAction(id, status);
    if (res.success) {
      toast.success("Fila atualizada!");
      if (barbershop) {
        fetchQueue(barbershop.id);
      }
    } else {
      toast.error(res.error || "Erro ao atualizar.");
    }
  }

  const qrUrl = useMemo(() => {
    if (typeof window === "undefined" || !barbershop?.slug) return "";
    return `${window.location.origin}/fila/${barbershop.slug}`;
  }, [barbershop?.slug]);

  return (
    <div className="p-4 md:p-6 space-y-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-white rounded-2xl shadow-sm">
            <Users className="text-blue-600 size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 text-left">Fila Virtual</h1>
            <p className="text-sm text-slate-500 font-medium tracking-tight text-left">
              Gerencie os clientes presenciais em tempo real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* BOTÃO DO MONITOR (NOVO) */}
          <Button 
  variant="outline"
  onClick={() => window.open(`/monitor/${barbershop?.slug}`, '_blank')} // URL atualizada
  className="border-slate-200 text-slate-600 gap-2 rounded-xl h-12 px-6 font-bold hover:bg-slate-100 hidden md:flex"
>
  <Monitor className="size-5" /> Monitor (TV)
</Button>

          {/* Modal do QR Code */}
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white gap-2 rounded-xl h-12 px-6 font-bold shadow-lg transition-all active:scale-95">
                <QrCode className="size-5" /> Totem
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white rounded-3xl border-0 shadow-2xl sm:max-w-sm">
              <DialogHeader className="text-center pt-4">
                <DialogTitle className="text-2xl font-black text-slate-900">Totem de Autoatendimento</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col items-center p-6 gap-6">
                <div className="p-4 bg-white border-8 border-slate-50 rounded-[2rem] shadow-inner">
                  {qrUrl && <QRCodeSVG value={qrUrl} size={200} />}
                </div>
                <p className="text-center text-slate-500 font-medium text-sm leading-relaxed">
                  O cliente entra na fila pelo próprio celular escaneando este código.
                </p>
                <Button 
                  onClick={() => window.print()} 
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg"
                >
                  Imprimir QR Code
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Lista da Fila */}
      <div className="grid gap-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin size-8 text-blue-600" />
            <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Sincronizando Fila...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-[2rem] border border-dashed border-slate-300 py-24 text-center">
             <Users className="size-12 text-slate-200 mx-auto mb-4" />
             <p className="text-slate-400 font-bold text-lg">Nenhum cliente na fila no momento.</p>
          </div>
        ) : (
          queue.map((item, index) => (
            <div 
              key={item.id} 
              className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center gap-5">
                <div className="text-2xl font-black text-blue-600/30 bg-blue-50/50 w-12 h-12 flex items-center justify-center rounded-full transition-colors">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-black text-slate-800 text-xl leading-tight">{item.client_name}</p>
                    {item.client_id && (
                      <div className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg border border-blue-100 pointer-events-none">
                        <UserCheck className="size-3" />
                        <span className="text-[10px] font-black uppercase tracking-tight">Fiel</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {item.status === 'in_progress' ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-emerald-200">
                        Na Cadeira
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider border border-amber-200">
                        Aguardando
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {item.status === 'waiting' && (
                  <Button 
                    variant="ghost" 
                    onClick={() => handleStatus(item.id, 'in_progress')} 
                    className="text-blue-600 hover:bg-blue-50 h-12 w-12 p-0 rounded-2xl transition-all"
                    title="Iniciar Atendimento"
                  >
                    <Play className="size-6 fill-current" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  onClick={() => handleStatus(item.id, 'finished')} 
                  className="text-emerald-600 hover:bg-emerald-50 h-12 w-12 p-0 rounded-2xl transition-all"
                  title="Concluir"
                >
                  <CheckCircle2 className="size-6" />
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => handleStatus(item.id, 'cancelled')} 
                  className="text-slate-300 hover:text-red-500 hover:bg-red-50 h-12 w-12 p-0 rounded-2xl transition-all"
                  title="Remover"
                >
                  <XCircle className="size-6" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
export const runtime = 'edge';

import { createClient } from "@/utils/supabase/server";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import Image from "next/image"; 
import QueueForm from "./queue-form";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

type InitialQueueData = {
  id: string;
  status: string;
  barber_name: string | null;
  chair_number: string | null;
  is_rated: boolean;
  joined_at: string | null; // Adicionado para controle de data/hora
};

export default async function PublicBarbershopPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  
  const resolvedSearchParams = await searchParams;
  const isLocal = resolvedSearchParams.origem === "balcao";

  const supabase = await createClient();

  const { data: barbershop, error } = await supabase
    .from("barbershops")
    .select("id, name, logo_url")
    .eq("slug", slug)
    .single();

  if (error || !barbershop) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const { count: queueCount } = await supabase
    .from("virtual_queue")
    .select("*", { count: "exact", head: true })
    .eq("barbershop_id", barbershop.id)
    .eq("status", "waiting");
  
  const initialWaitingCount = queueCount || 0;

  let initialQueueData: InitialQueueData | null = null;
  let initialUserPosition: number | null = null;

  if (user) {
    const { data } = await supabase
      .from("virtual_queue")
      .select("id, status, barber_name, chair_number, is_rated, joined_at")
      .eq("barbershop_id", barbershop.id)
      .eq("client_auth_id", user.id)
      .in("status", ["waiting", "in_progress", "finished"])
      .order("joined_at", { ascending: false }) 
      .limit(1)
      .maybeSingle();
    
    if (data) {
      if (!(data.status === "finished" && data.is_rated === true)) {
        initialQueueData = {
          id: data.id,
          status: data.status,
          barber_name: data.barber_name,
          chair_number: data.chair_number,
          is_rated: data.is_rated || false,
          joined_at: data.joined_at, // Mapeado aqui
        };

        if (data.status === "waiting") {
          const { data: waitingList } = await supabase
            .from("virtual_queue")
            .select("id")
            .eq("barbershop_id", barbershop.id)
            .eq("status", "waiting")
            .order("joined_at", { ascending: true }); 

          if (waitingList) {
            const index = waitingList.findIndex(item => item.id === data.id);
            if (index !== -1) initialUserPosition = index + 1; 
          }
        }
      }
    }
  }

  return (
    <div className="min-[100dvh] w-full overflow-y-auto overflow-x-hidden pb-12 bg-slate-50 flex flex-col items-center p-6">
      <div className="w-full max-w-md space-y-6 mt-8 text-center">
        
        {barbershop.logo_url ? (
          <Image 
            src={barbershop.logo_url} 
            width={96}  
            height={96} 
            className="w-24 h-24 rounded-3xl mx-auto shadow-lg border-4 border-white object-cover bg-white" 
            alt={`Logótipo ${barbershop.name}`} 
            priority 
          />
        ) : (
          <div className="w-24 h-24 rounded-3xl mx-auto shadow-lg border-4 border-white bg-slate-200 flex items-center justify-center">
            <Store className="size-10 text-slate-400" />
          </div>
        )}

        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {barbershop.name}
          </h1>
          <p className="text-slate-500 font-medium italic mt-1">
            Fila Virtual Inteligente
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100">
          <div className="w-full">
            <QueueForm 
              barbershopId={barbershop.id} 
              barbershopName={barbershop.name}
              user={user} 
              isLocal={isLocal}
              initialWaitingCount={initialWaitingCount}
              initialQueueData={initialQueueData}
              initialUserPosition={initialUserPosition} 
            />
          </div>
        </div>
        
        <p className="text-[10px] text-slate-400 font-medium pt-2">
          Ambiente seguro. Protegido por autenticação e Cloudflare Turnstile.
        </p>

      </div>
    </div>
  );
}
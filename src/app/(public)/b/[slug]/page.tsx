// src/app/(public)/b/[slug]/page.tsx
export const dynamic = "force-dynamic";
export const runtime = 'edge';
export const fetchCache = 'force-no-store';

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
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
  client_auth_id: string | null;
  barber_name: string | null;
  chair_number: string | null;
  is_rated: boolean;
  joined_at: string | null;
};

export default async function PublicBarbershopPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  
  const resolvedSearchParams = await searchParams;
  const isLocal = resolvedSearchParams.origem === "balcao";

  const supabase = await createClient();
  const supabaseAdmin = createAdminClient();

  const { data: barbershop, error } = await supabase
    .from("barbershops")
    .select("id, name, logo_url")
    .eq("slug", slug)
    .single();

  if (error || !barbershop) notFound();

  const brazilTime = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const currentDow = brazilTime.getDay();

  // A consulta privilegiada é executada exclusivamente no servidor.
  // A resposta enviada ao componente público é limitada a id, nome e avatar.
  // Isso permite remover as políticas de leitura pública das tabelas staff e staff_working_hours.
  const { data: rawBarbers } = await supabaseAdmin
    .from("staff")
    .select(`
      id, 
      full_name, 
      avatar_url,
      staff_working_hours!inner (
        day_of_week,
        is_active,
        service_mode
      )
    `)
    .eq("barbershop_id", barbershop.id)
    .eq("role", "barber")
    .eq("is_active", true)
    .eq("staff_working_hours.day_of_week", currentDow) 
    .eq("staff_working_hours.is_active", true)        
    .in("staff_working_hours.service_mode", ["queue", "hybrid"]); 

  const barbers = rawBarbers?.map(b => ({
    id: b.id,
    full_name: b.full_name,
    avatar_url: b.avatar_url
  })) || [];

  const { data: { user } } = await supabase.auth.getUser();

  const { count: queueCount } = await supabaseAdmin
    .from("virtual_queue")
    .select("id", { count: "exact", head: true })
    .eq("barbershop_id", barbershop.id)
    .eq("status", "waiting");
  
  const initialWaitingCount = queueCount || 0;

  // O ticket do cliente não é mais buscado diretamente nesta página.
  // A posse do ticket é validada exclusivamente pela API pública através do cookie HttpOnly.
  const initialQueueData: InitialQueueData | null = null;
  const initialUserPosition: number | null = null;

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
              barbers={barbers}
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

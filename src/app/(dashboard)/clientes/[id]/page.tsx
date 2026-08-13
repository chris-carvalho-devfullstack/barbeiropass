// src/app/(dashboard)/clientes/[id]/page.tsx
import { getClienteById, getClienteTimeline } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ClientProfile from "./client-profile";

export default async function ClientePage({ params }: { params: { id: string } }) {
  // O Next.js 15 exige que você faça um "await" nos params dinâmicos
  const { id } = await params;
  
  const cliente = await getClienteById(id);
  const timeline = await getClienteTimeline(id);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      {/* Botão de Voltar Premium */}
      <div>
        <Link href="/clientes" className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-slate-800 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm w-fit">
          <ArrowLeft className="size-4" /> Voltar para Clientes
        </Link>
      </div>

      {/* Injeta os dados na Ficha Real do CRM */}
      <ClientProfile cliente={cliente} timeline={timeline} />
    </div>
  );
}
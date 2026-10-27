import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default function AccessDeniedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
        <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="size-7" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">BarbeiroPass</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Área não disponível para esta conta</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sua sessão está ativa, mas não encontramos um vínculo que autorize o acesso a esta área. Se você recebeu um convite profissional, abra novamente o link recebido. Caso contrário, entre na área compatível com sua conta ou solicite ajuda ao administrador da barbearia.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/agendar">Ir para a área do cliente</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

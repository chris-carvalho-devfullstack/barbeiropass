import Link from "next/link";
import { CalendarCheck, Home, LogIn, Scissors } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export default async function CustomerAreaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const metadataName = user?.user_metadata?.full_name;
  const customerName =
    typeof metadataName === "string" && metadataName.trim()
      ? metadataName.trim()
      : user?.email || null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-xl shadow-slate-200/50 sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CalendarCheck className="size-8" />
        </div>

        <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-blue-600">
          BarbeiroPass
        </p>
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Área do cliente
        </h1>

        {customerName ? (
          <p className="mt-3 text-sm font-medium text-slate-600">
            Olá, {customerName}. Seu atendimento foi finalizado.
          </p>
        ) : (
          <p className="mt-3 text-sm font-medium text-slate-600">
            Seu atendimento foi finalizado.
          </p>
        )}

        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-left">
          <div className="flex items-start gap-3">
            <Scissors className="mt-0.5 size-5 shrink-0 text-emerald-700" />
            <p className="text-sm leading-relaxed text-emerald-950">
              O acompanhamento deste atendimento foi encerrado. A posição da fila,
              a previsão de espera e os eventos em tempo real não serão mais
              atualizados nesta página.
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-500">
          Você pode voltar ao início do BarbeiroPass ou entrar na sua conta para
          continuar usando a plataforma.
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition-colors hover:bg-slate-800"
          >
            <Home className="size-4" />
            Ir para o início
          </Link>
          {!user && (
            <Link
              href="/login"
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <LogIn className="size-4" />
              Entrar na minha conta
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}

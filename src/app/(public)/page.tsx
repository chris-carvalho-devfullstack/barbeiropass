import Link from "next/link";
import { Scissors } from "lucide-react";

export default function Home() {
  return (
    // FIX MOBILE: Trocado min-h-screen por min-[100dvh] e adicionado overflow-x-hidden
    <div className="min-[100dvh] overflow-x-hidden bg-slate-50 flex flex-col items-center justify-center p-4">
      
      {/* IDENTIDADE VISUAL: Cores alinhadas (blue e slate) com o resto do SaaS */}
      <div className="flex justify-center text-blue-600 mb-6">
        <Scissors size={64} strokeWidth={1.5} />
      </div>
      
      <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 text-center tracking-tight">
        Bem-vindo ao Barbeiropass
      </h1>
      
      <p className="text-lg text-slate-600 mb-8 text-center max-w-md">
        A plataforma definitiva para gestão da sua barbearia. Fila virtual, PDV e agendamento num só lugar.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Link 
          href="/cadastro" 
          className="w-full sm:w-auto flex justify-center py-3 px-8 border border-transparent rounded-2xl shadow-md text-base font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98]"
        >
          Criar minha conta
        </Link>
        <Link 
          href="/login" 
          className="w-full sm:w-auto flex justify-center py-3 px-8 border border-slate-200 rounded-2xl shadow-sm text-base font-bold text-slate-700 bg-white hover:bg-slate-50 transition-all active:scale-[0.98]"
        >
          Já tenho uma conta
        </Link>
      </div>
      
    </div>
  );
}
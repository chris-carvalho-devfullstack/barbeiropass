import Link from "next/link";
import { Scissors } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <div className="flex justify-center text-indigo-600 mb-6">
        <Scissors size={64} strokeWidth={1.5} />
      </div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 mb-4 text-center">
        Bem-vindo ao Barbeiropass
      </h1>
      <p className="text-lg text-zinc-600 mb-8 text-center max-w-md">
        A plataforma definitiva para gestão da sua barbearia. Fila virtual, PDV e agendamento em um só lugar.
      </p>
      
      <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
        <Link 
          href="/cadastro" 
          className="w-full sm:w-auto flex justify-center py-3 px-8 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
        >
          Criar minha conta
        </Link>
        <Link 
          href="/login" 
          className="w-full sm:w-auto flex justify-center py-3 px-8 border border-zinc-300 rounded-lg shadow-sm text-base font-medium text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
        >
          Já tenho uma conta
        </Link>
      </div>
    </div>
  );
}
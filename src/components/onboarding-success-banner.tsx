"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X } from "lucide-react";

export function OnboardingSuccessBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Ao carregar a página, checa se o usuário já fechou este banner antes
    const isDismissed = localStorage.getItem("onboardingBannerDismissed");
    if (!isDismissed) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    // Salva no navegador para nunca mais exibir nesta máquina (a não ser que o score caia)
    localStorage.setItem("onboardingBannerDismissed", "true");
  };

  // Se já foi fechado, não renderiza nada, deixando a dashboard limpa
  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 p-6 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm animate-in fade-in duration-700 relative pr-12">
      
      {/* Botão de Fechar 'X' no canto superior direito */}
      <button 
        onClick={handleClose} 
        className="absolute top-4 right-4 p-1 text-yellow-600/50 hover:text-yellow-700 hover:bg-yellow-500/10 rounded-md transition-colors"
        aria-label="Fechar mensagem"
      >
        <X size={20} />
      </button>

      <div>
        <h3 className="font-bold text-yellow-700 flex items-center gap-2 text-lg">
          🏆 Perfil Ouro 100% Completo
        </h3>
        <p className="text-sm text-yellow-600/90 mt-1 max-w-2xl">
          Parabéns! Sua barbearia configurou todas as informações essenciais. Você está com força máxima no marketplace e pronto para atrair novos clientes com o máximo de destaque.
        </p>
      </div>
      
      <div className="mt-4 sm:mt-0 shrink-0">
        <Link href="/perfil/aparencia" className="inline-block px-5 py-2 bg-yellow-500 text-white rounded-lg text-sm font-semibold hover:bg-yellow-600 transition-colors shadow-sm">
          Ver Perfil Público
        </Link>
      </div>
    </div>
  );
}
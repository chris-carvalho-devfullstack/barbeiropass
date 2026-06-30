"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"; // ou do seu path padrão @/components/ui/dialog
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, ArrowUpRight } from "lucide-react";

interface UpgradePlanModalProps {
  children: React.ReactNode;
}

export function UpgradePlanModal({ children }: UpgradePlanModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-6 overflow-hidden border-zinc-800 bg-zinc-950 text-zinc-50">
        {/* Detalhe estético premium em degradê no topo do modal */}
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-600" />
        
        <DialogHeader className="flex flex-col items-center text-center space-y-4 pt-4">
          <div className="p-3 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Crown className="h-8 w-8" />
          </div>
          
          <div className="space-y-1">
            <DialogTitle className="text-xl font-bold tracking-tight flex items-center justify-center gap-2">
              Recurso Exclusivo Ultimate
              <Sparkles className="h-4 w-4 text-amber-400 fill-amber-400" />
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-sm max-w-xs mx-auto">
              A organização avançada por categorias está disponível apenas para parceiros do plano **Ultimate**.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="my-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 space-y-3 text-sm">
          <p className="font-medium text-zinc-300">O que você ganha no plano Ultimate:</p>
          <ul className="space-y-2 text-zinc-400 text-xs">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Categorias e subcategorias ilimitadas para produtos
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Gestão avançada de estoque multi-unidade
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Relatórios inteligentes de lucratividade líquida
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2 w-full">
          <Button 
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-zinc-950 font-semibold shadow-lg shadow-amber-500/10 transition-all duration-300 group"
            onClick={() => alert("Redirecionando para o checkout de upgrade...")}
          >
            Fazer Upgrade Agora
            <ArrowUpRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Button>
          
          <Button variant="ghost" className="w-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 text-xs">
            Continuar no Plano Atual
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
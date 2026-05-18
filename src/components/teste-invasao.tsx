// src/components/teste-invasao.tsx
"use client";

import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

export function BotaoTesteInvasao() {
  const handleTest = async () => {
    const supabase = createClient();
    
    // Simula um hacker que copiou o ID da barbearia do concorrente (um ID falso/aleatório aqui)
    const idBarbeariaAlvo = "818a6b6a-d779-4d48-b6fa-83eefb2b6f69";

    toast.loading("Tentando invadir a barbearia do concorrente...", { id: "teste-invasao" });

    // Tenta fazer o upload na pasta que NÃO pertence ao usuário logado
    const { data, error } = await supabase.storage
      .from('barbershop-media')
      .upload(`${idBarbeariaAlvo}/hacked.png`, "Este é um arquivo falso");

    if (error) {
      console.log("✅ ERRO ESPERADO (BLINDAGEM ATIVA):", error);
      toast.success("🛡️ BLINDAGEM FUNCIONOU! Acesso bloqueado.", {
        id: "teste-invasao",
        description: error.message,
        duration: 8000,
      });
    } else {
      console.error("🚨 FALHA DE SEGURANÇA:", data);
      toast.error("🚨 ALERTA: O arquivo foi enviado! RLS falhou.", {
        id: "teste-invasao",
        duration: 8000,
      });
    }
  };

  return (
    <button
      onClick={handleTest}
      className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-5 rounded-lg shadow-lg transition-all mb-8"
    >
      <ShieldAlert size={20} />
      Testar Invasão Lateral (Hacker Logado)
    </button>
  );
}
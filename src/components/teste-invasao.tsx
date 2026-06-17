"use client";

import { createClient } from "@/utils/supabase/client";

export function BotaoTesteInvasao() {
  const simularAtaque = async () => {
    const supabase = createClient();
    
    // Pegando o usuário atual logado (o atacante)
    const { data: { user } } = await supabase.auth.getUser();
    
    console.log("🚨 Tentando invadir o banco...");
    console.log("Seu UID é:", user?.id);
    
    // Substitua este UUID pelo ID de alguma barbearia real que exista no seu banco (que não seja a sua)
    // Se não tiver outra, pode usar o ID da sua própria barbearia só para ver o banco rejeitar o INSERT.
    const TARGET_BARBERSHOP_ID = '00000000-0000-0000-0000-000000000000'; 

    const { data, error } = await supabase.from('barbershop_members').insert({
      barbershop_id: TARGET_BARBERSHOP_ID,
      profile_id: user?.id,
      role: 'owner'
    });

    if (error) {
      console.error("✅ ATAQUE BLOQUEADO COM SUCESSO PELO RLS!", error.message);
      alert(`Acesso Negado! O RLS bloqueou a injeção.\nMotivo: ${error.message}`);
    } else {
      console.error("❌ FALHA DE SEGURANÇA: O ataque funcionou!", data);
      alert("Falha Crítica! O banco aceitou o registro.");
    }
  };

  return (
    <div className="p-4 border-2 border-red-500 bg-red-50 rounded-lg mb-8">
      <h3 className="font-bold text-red-700 mb-2">Painel de Teste de Segurança</h3>
      <button 
        onClick={simularAtaque} 
        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 font-bold rounded shadow-lg"
      >
        SIMULAR ATAQUE DE INJEÇÃO (MEMBER)
      </button>
    </div>
  );
}
// src/app/api/agendamentos/opcoes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = 'edge';

// Tipagem rigorosa para o retorno do Join do Supabase
interface StaffMemberData {
  id: string; // Agora referenciamos o ID da tabela staff
  role: string;
  full_name: string | null; // ADICIONADO: Nome salvo diretamente na tabela staff
  profiles: {
    full_name: string | null;
  } | {
    full_name: string | null;
  }[] | null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // 1. Descobrir a barbearia e cargo do usuário logado
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id, role")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      console.error("[ERRO_SUPABASE_MEMBER]", memberError);
      throw new Error("Acesso negado à barbearia.");
    }

    const isManagerOrOwner = member.role === "owner" || member.role === "manager";

    // 2. Buscar o ID do Staff do próprio utilizador logado
    const { data: myStaff } = await supabase
      .from("staff")
      .select("id")
      .eq("profile_id", user.id)
      .eq("barbershop_id", member.barbershop_id)
      .single();

    // 3. Buscar a Equipe (Barbeiros) na tabela STAFF
    // CORRIGIDO: Puxar também o full_name diretamente da tabela staff
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id, role, full_name, profiles ( full_name )")
      .eq("barbershop_id", member.barbershop_id)
      .in("role", ["owner", "manager", "barber"]);

    if (staffError) {
      console.error("[ERRO_SUPABASE_STAFF]", staffError);
      throw new Error("Falha ao carregar a equipe.");
    }

    const typedStaffData = staffData as unknown as StaffMemberData[];

    const barbers = typedStaffData?.map((s) => {
      // O Supabase pode retornar um objeto único ou um array no join, tratamos isso defensivamente
      const profileInfo = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
      
      return {
        id: s.id, 
        // LÓGICA DE FALLBACK: Tenta profile, se não tiver, usa o nome do staff
        name: profileInfo?.full_name || s.full_name || "Membro sem nome",
        role: s.role
      };
    }) || [];

    // 4. Buscar Serviços da Barbearia
    const { data: servicesData, error: servicesError } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price")
      .eq("barbershop_id", member.barbershop_id)
      .order("name");

    if (servicesError) {
      console.error("[ERRO_SUPABASE_SERVICES]", servicesError);
      throw new Error("Falha ao carregar os serviços.");
    }

    return NextResponse.json({
      data: {
        isManager: isManagerOrOwner,
        currentUserId: myStaff?.id || user.id, // Retorna o staff.id do usuário logado
        barbers,
        services: servicesData || []
      }
    }, { status: 200 });

  } catch (error: unknown) {
    console.error("[ERRO_API_OPCOES]", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
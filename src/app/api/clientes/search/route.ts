// src/app/api/clientes/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { z } from "zod";

// Validação rigorosa do parâmetro de pesquisa via Query String
const searchSchema = z.object({
  q: z.string().min(2, "O termo de pesquisa deve ter pelo menos 2 caracteres."),
});

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Autenticação Segura
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // 2. Extração e Validação do Termo de Pesquisa
    const { searchParams } = new URL(request.url);
    const queryParam = searchParams.get("q") || "";
    
    const validation = searchSchema.safeParse({ q: queryParam });
    if (!validation.success) {
      return NextResponse.json(
        { error: "Termo de busca inválido.", details: validation.error.format() },
        { status: 400 }
      );
    }

    const searchTerm = validation.data.q;

    // 3. Zero-Trust: Obter a barbearia a que o utilizador pertence
    const { data: member, error: memberError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .single();

    if (memberError || !member) {
      throw new Error("Acesso negado à barbearia.");
    }

    // 4. Executar a procura isolada (Ninguém vê clientes de outra barbearia)
    const { data: clientes, error: searchError } = await supabase
      .from("clientes")
      .select("id, name, phone")
      .eq("barbershop_id", member.barbershop_id)
      .ilike("name", `%${searchTerm}%`)
      .order("name", { ascending: true })
      .limit(5);

    if (searchError) {
      throw new Error(`Falha ao procurar clientes: ${searchError.message}`);
    }

    // Retorna os dados com tipagem implícita segura
    return NextResponse.json({ data: clientes }, { status: 200 });

  } catch (error: unknown) { // Sem "any"
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
  }
}
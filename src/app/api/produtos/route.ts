export const runtime = "edge";

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ============================================================
// ALTERAR STATUS (ATIVAR/DESATIVAR)
//
// O produto precisa pertencer à barbearia do usuário e não pode
// estar arquivado.
//
// O status atual é consultado no banco. Não confiamos no valor
// enviado pelo navegador para determinar o estado definitivo.
// ============================================================

export async function PATCH(req: Request) {
  try {
    const { productId, currentStatus } = await req.json();

    if (!productId || typeof currentStatus !== "boolean") {
      return NextResponse.json(
        { error: "Payload inválido" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { data: member, error: membershipError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .eq("profile_id", user.id)
      .in("role", ["owner", "manager"])
      .single();

    if (membershipError || !member) {
      return NextResponse.json(
        { error: "Permissão negada" },
        { status: 403 }
      );
    }

    // Busca somente produtos não arquivados da barbearia autorizada.
    const { data: product, error: productFetchError } = await supabase
      .from("products")
      .select("id, is_active")
      .eq("id", productId)
      .eq("barbershop_id", member.barbershop_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (productFetchError) {
      throw productFetchError;
    }

    if (!product) {
      return NextResponse.json(
        {
          error:
            "Produto não encontrado ou arquivado. Produtos arquivados não podem ser reativados por esta operação.",
        },
        { status: 404 }
      );
    }

    // Alterna o estado usando o valor atual consultado no banco.
    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        is_active: !product.is_active,
      })
      .eq("id", product.id)
      .eq("barbershop_id", member.barbershop_id)
      .is("deleted_at", null)
      .select("id, is_active")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedProduct) {
      return NextResponse.json(
        {
          error:
            "Não foi possível atualizar o produto. Ele pode ter sido arquivado ou removido da barbearia.",
        },
        { status: 404 }
      );
    }

    // Invalida o cache das telas afetadas.
    revalidatePath("/(dashboard)/produtos", "page");
    revalidatePath("/(dashboard)/pdv", "page");

    return NextResponse.json({
      success: true,
      is_active: updatedProduct.is_active,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error(
      "[API PRODUTOS] Erro no PATCH:",
      errorMessage
    );

    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    );
  }
}

// ============================================================
// ARQUIVAMENTO LÓGICO (SOFT DELETE)
//
// Não remove a linha da tabela products.
// Não altera o SKU ou o slug original.
// O arquivamento libera esses identificadores por meio dos
// índices únicos parciais configurados no banco.
// ============================================================

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("id");

    if (!productId) {
      return NextResponse.json(
        { error: "ID não fornecido" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const { data: member, error: membershipError } = await supabase
      .from("barbershop_members")
      .select("barbershop_id")
      .in("role", ["owner", "manager"])
      .eq("profile_id", user.id)
      .single();

    if (membershipError || !member) {
      return NextResponse.json(
        { error: "Permissão negada" },
        { status: 403 }
      );
    }

    // Arquiva sem apagar ou modificar a identidade histórica.
    // O filtro deleted_at IS NULL evita um novo arquivamento
    // de um produto que já esteja arquivado.
    const { data: archivedProduct, error: archiveError } =
      await supabase
        .from("products")
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", productId)
        .eq("barbershop_id", member.barbershop_id)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();

    if (archiveError) {
      throw archiveError;
    }

    if (!archivedProduct) {
      return NextResponse.json(
        {
          error:
            "Produto não encontrado, já arquivado ou não pertencente à sua barbearia.",
        },
        { status: 404 }
      );
    }

    // Invalida as telas de produtos e PDV.
    revalidatePath("/(dashboard)/produtos", "page");
    revalidatePath("/(dashboard)/pdv", "page");

    return NextResponse.json({
      success: true,
      message: "Produto arquivado com sucesso.",
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erro desconhecido";

    console.error(
      "[API PRODUTOS] Erro no DELETE:",
      errorMessage
    );

    return NextResponse.json(
      { error: "Erro interno no servidor" },
      { status: 500 }
    );
  }
}
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Tag, Trash2, Package, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CategoryManagerClient } from "./category-manager-client"; 
import { CreateCategoryDialog } from "@/components/create-category-dialog";
import { UpgradePlanModal } from "@/components/upgrade-plan-modal";

export const runtime = 'edge';

export const metadata = {
  title: "Categorias | BarberPass",
  description: "Gerenciamento de categorias de produtos.",
};

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id")
    .eq("profile_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  // ==========================================
  // CONTORNO TEMPORÁRIO PARA PLANOS DE ASSINATURA
  // Altere para true para simular um usuário Ultimate e liberar a criação
  // ==========================================
  const isUltimatePlan = false; // Altere para true para simular um usuário Ultimate e liberar a criação

  // 1. Buscamos todas as categorias (Globais + Locais da Barbearia)
  const { data: categories } = await supabase
    .from("product_categories")
    .select("id, name, barbershop_id")
    .or(`barbershop_id.is.null,barbershop_id.eq.${member.barbershop_id}`)
    .order("name");

  // 2. Buscamos todos os produtos ativos e não deletados para associar às categorias
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category_id, is_active")
    .eq("barbershop_id", member.barbershop_id)
    .is("deleted_at", null);

  // 3. Estruturamos os dados mesclando categorias e seus respectivos produtos
  const structuredCategories = (categories || []).map((cat) => {
    const isGlobal = cat.barbershop_id === null;
    const catProducts = (products || []).filter(p => p.category_id === cat.id);
    
    return {
      id: cat.id,
      name: cat.name,
      isGlobal,
      products: catProducts
    };
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/produtos">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
            <p className="text-muted-foreground">Gerencie a organização do seu catálogo.</p>
          </div>
        </div>

        {/* Botão Condicional baseado no Plano */}
        <div className="w-full sm:w-auto">
          {isUltimatePlan ? (
            <CreateCategoryDialog />
          ) : (
            <UpgradePlanModal>
              <Button className="w-full sm:w-auto flex items-center justify-center">
                <FolderPlus className="mr-2 h-4 w-4" />
                Criar Nova Categoria
              </Button>
            </UpgradePlanModal>
          )}
        </div>

      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listagem de Categorias</CardTitle>
          <CardDescription>
            Categorias do sistema são protegidas. Você pode apagar apenas as personalizadas que não possuam produtos vinculados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryManagerClient categories={structuredCategories} />
        </CardContent>
      </Card>
    </div>
  );
}
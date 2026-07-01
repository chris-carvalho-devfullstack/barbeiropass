import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FolderCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CreateProductDialog } from "@/components/create-product-dialog";
import { ProductFilters } from "@/components/product-filters";
import { PaginationControls } from "@/components/pagination-controls";
// IMPORTANTE: Importamos também a interface ProductRowExtended
import { ProductRow, ProductRowExtended } from "@/components/product-row"; 

export const runtime = 'edge';

export const metadata = {
  title: "Produtos | BarberPass",
  description: "Gerenciamento de produtos e estoque.",
};

export default async function ProdutosPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  const searchParams = await props.searchParams;
  const q = typeof searchParams.q === 'string' ? searchParams.q : "";
  const status = typeof searchParams.status === 'string' ? searchParams.status : "ativo";
  
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;
  const limit = typeof searchParams.limit === 'string' ? parseInt(searchParams.limit, 10) : 20;
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let supabaseQuery = supabase
    .from("products")
    .select(`id, name, description, sku, barcode, price, cost_price, stock_quantity, category_id, is_active, images, category:product_categories(name)`, { count: 'exact' })
    .eq("barbershop_id", member.barbershop_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (q) {
    supabaseQuery = supabaseQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%,barcode.ilike.%${q}%`);
  }

  if (status === "ativo") {
    supabaseQuery = supabaseQuery.eq("is_active", true);
  } else if (status === "inativo") {
    supabaseQuery = supabaseQuery.eq("is_active", false);
  }

  supabaseQuery = supabaseQuery.range(from, to);

  const { data, count } = await supabaseQuery;
  
  // TIPAGEM ESTRITA: Dizemos ao TypeScript exatamente o que retorna do banco
  const products = data as ProductRowExtended[] | null;

  return (
    <div className="px-0 py-3 sm:p-5 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o estoque e catálogo da sua barbearia.</p>
        </div>
        
        <div className="flex w-full sm:w-auto flex-col sm:flex-row items-center gap-3">
          <Link href="/produtos/categorias" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full sm:w-auto flex items-center justify-center">
              <FolderCog className="mr-2 h-4 w-4" />
              Gerenciar Categorias
            </Button>
          </Link>
          <div className="w-full sm:w-auto">
            <CreateProductDialog />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle>Estoque de Produtos</CardTitle>
          <CardDescription>
            Visualize, filtre e gerencie todos os produtos disponíveis no seu PDV.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="px-3 sm:px-6 pb-6">
          <div className="mb-4">
            <ProductFilters />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Imagem</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!products || products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {q || status !== "todos" 
                        ? "Nenhum produto encontrado com estes filtros." 
                        : "Nenhum produto cadastrado na barbearia."}
                    </TableCell>
                  </TableRow>
                ) : (
                  // Agora passamos o produto limpo e validado pelo TypeScript!
                  products.map((product) => (
                    <ProductRow key={product.id} product={product} />
                  ))
                )}
              </TableBody>
            </Table>
            
            <div className="p-4 border-t">
              <PaginationControls totalItems={count || 0} currentPage={page} limit={limit} />
            </div>
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
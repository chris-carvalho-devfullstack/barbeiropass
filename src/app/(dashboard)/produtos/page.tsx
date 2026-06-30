import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Package, Image as ImageIcon, Barcode } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductTableActions } from "@/components/product-table-actions";
import { CreateProductDialog } from "@/components/create-product-dialog";
import { ProductFilters } from "@/components/product-filters";
import { PaginationControls } from "@/components/pagination-controls"; // Importamos o novo componente

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
  
  // Parâmetros de Paginação (com defaults)
  const page = typeof searchParams.page === 'string' ? parseInt(searchParams.page, 10) : 1;
  const limit = typeof searchParams.limit === 'string' ? parseInt(searchParams.limit, 10) : 20;
  
  // Cálculo do Range para o Supabase (ex: page 1 com limit 20 = de 0 a 19)
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Query do Supabase com pedido explícito da contagem total
  let supabaseQuery = supabase
    .from("products")
    .select(`id, name, sku, barcode, price, cost_price, stock_quantity, category_id, is_active, images, category:product_categories(name)`, { count: 'exact' })
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

  // Aplicamos o limite de paginação
  supabaseQuery = supabaseQuery.range(from, to);

  const { data: products, count } = await supabaseQuery;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="text-muted-foreground">Gerencie o estoque e catálogo da sua barbearia.</p>
        </div>
        <CreateProductDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estoque de Produtos</CardTitle>
          <CardDescription>
            Visualize, filtre e gerencie todos os produtos disponíveis no seu PDV.
          </CardDescription>
        </CardHeader>
        <CardContent>
          
          <ProductFilters />

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
                  products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        {product.images && product.images.length > 0 ? (
                          <Image
                            src={product.images[0]}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-md object-cover w-10 h-10 border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center border">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground flex gap-1.5 items-center">
                            <Package className="w-3 h-3" /> SKU: {product.sku}
                          </span>
                          {product.barcode && (
                            <span className="text-xs text-muted-foreground flex gap-1.5 items-center">
                              <Barcode className="w-3 h-3" /> EAN: {product.barcode}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={product.stock_quantity > 5 ? "default" : product.stock_quantity > 0 ? "secondary" : "destructive"}
                          className="font-mono"
                        >
                          {product.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.is_active ? "outline" : "secondary"} className={product.is_active ? "text-emerald-500 border-emerald-500/30" : "opacity-50"}>
                          {product.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <ProductTableActions product={product} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            
            {/* Aqui incluímos os controlos de paginação, passando a contagem total */}
            <PaginationControls totalItems={count || 0} currentPage={page} limit={limit} />
            
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
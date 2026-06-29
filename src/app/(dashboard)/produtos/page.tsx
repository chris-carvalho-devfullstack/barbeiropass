import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import Image from "next/image"; // <-- Importado o componente Image do Next.js
import { Button } from "@/components/ui/button";
import { Plus, Package, Barcode, Image as ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProductTableActions } from "@/components/product-table-actions";
import { CreateProductDialog } from "@/components/create-product-dialog";

export const runtime = 'edge';

export const metadata = {
  title: "Produtos | BarberPass",
  description: "Gerenciamento de produtos e estoque.",
};

export default async function ProdutosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");

  const { data: member } = await supabase
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .single();

  if (!member) redirect("/dashboard");

  // Fetch ultrarrápido direto no servidor, já trazendo as categorias ligadas
  const { data: products } = await supabase
    .from("products")
    .select(`
      id, name, sku, barcode, price, stock_quantity, is_active, images,
      category:product_categories(name)
    `)
    .eq("barbershop_id", member.barbershop_id)
    .order("created_at", { ascending: false });

  const isManager = member.role === "owner" || member.role === "manager";

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Produtos</h2>
          <p className="text-muted-foreground text-sm">
            Gerencie seu catálogo, estoque e códigos de barra para o PDV.
          </p>
        </div>
        {isManager && (
  <CreateProductDialog />
)}
      </div>

      <Card className="border-border/50 shadow-sm bg-background/50 backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Estoque Atual
          </CardTitle>
          <CardDescription>
            {products?.length || 0} produtos cadastrados no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          <div className="rounded-md border border-border/50 overflow-x-auto">
            {/* CORREÇÃO 1: min-w-[800px] -> min-w-200 */}
            <Table className="min-w-200">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  {/* CORREÇÃO 2: w-[60px] -> w-15 */}
                  <TableHead className="w-15 text-center">Foto</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU / Barras</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead className="text-center">Estoque</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nenhum produto encontrado. Adicione seu primeiro item!
                    </TableCell>
                  </TableRow>
                ) : (
                  products?.map((product) => (
                    <TableRow key={product.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-center">
                        {product.images && product.images.length > 0 ? (
                          /* CORREÇÃO 3: <img> alterado para o componente hiper-otimizado <Image /> */
                          <Image 
                            src={product.images[0]} 
                            alt={product.name}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-md object-cover border border-border/50 shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center border border-border/50">
                            <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {product.name}
                        <div className="text-xs text-muted-foreground mt-1">
                          {/* CORREÇÃO 4: @ts-ignore -> @ts-expect-error */}
                          {/* @ts-expect-error - lidando com array do join do supabase */}
                          {product.category?.name || "Sem categoria"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono bg-muted/50 px-2 py-0.5 rounded w-fit border border-border/50">
                            {product.sku}
                          </span>
                          {product.barcode && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Barcode className="h-3 w-3" /> {product.barcode}
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
                        <ProductTableActions product={{ id: product.id, is_active: product.is_active, name: product.name }} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
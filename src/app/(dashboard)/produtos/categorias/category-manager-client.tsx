"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Tag, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface Product {
  id: string;
  name: string;
  is_active: boolean;
}

interface Category {
  id: string;
  name: string;
  isGlobal: boolean;
  products: Product[];
}

export function CategoryManagerClient({ categories }: { categories: Category[] }) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (categoryId: string, categoryName: string) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryName}"?`)) return;

    setIsDeleting(categoryId);
    try {
      const res = await fetch(`/api/categorias?id=${categoryId}`, { method: "DELETE" });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Falha ao excluir categoria");
      }
      
      toast.success("Categoria excluída com sucesso!");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      {categories.map((cat) => (
        <AccordionItem key={cat.id} value={cat.id} className="border-b dark:border-zinc-800">
          <AccordionTrigger className="hover:no-underline hover:bg-zinc-50 dark:hover:bg-zinc-900/50 px-4 rounded-md transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 gap-2">
              
              <div className="flex items-center gap-3">
                {cat.isGlobal ? (
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-md">
                    <Globe className="h-4 w-4" />
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-md">
                    <Tag className="h-4 w-4" />
                  </div>
                )}
                <span className="font-medium text-left">{cat.name}</span>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-auto ml-11 sm:ml-0">
                <Badge variant={cat.isGlobal ? "secondary" : "default"} className={cat.isGlobal ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}>
                  {cat.isGlobal ? "Padrão do Sistema" : "Personalizada"}
                </Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Package className="h-3 w-3" /> {cat.products.length}
                </span>
              </div>
              
            </div>
          </AccordionTrigger>
          
          <AccordionContent className="px-4 pt-4 pb-2">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-lg border dark:border-zinc-800">
              
              <div className="flex-1 w-full">
                <h4 className="text-sm font-semibold mb-2">Produtos vinculados ({cat.products.length})</h4>
                {cat.products.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum produto cadastrado nesta categoria.</p>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {cat.products.map(p => (
                      <li key={p.id} className="text-sm flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                        <span className="truncate">{p.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Só exibe o botão de apagar se FOR personalizada */}
              {!cat.isGlobal && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="w-full sm:w-auto shrink-0"
                  disabled={isDeleting === cat.id}
                  onClick={() => handleDelete(cat.id, cat.name)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isDeleting === cat.id ? "Apagando..." : "Apagar Categoria"}
                </Button>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
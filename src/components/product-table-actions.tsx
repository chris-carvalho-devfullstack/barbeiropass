"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings2, Edit, Trash, Power, PackagePlus } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreateProductDialog, ProductData } from "@/components/create-product-dialog";

interface ProductTableActionsProps {
  product: ProductData; 
}

export function ProductTableActions({ product }: ProductTableActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const router = useRouter();

  const handleToggleStatus = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/produtos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, currentStatus: product.is_active }),
      });
      
      if (!res.ok) throw new Error("Falha ao atualizar o status");
      
      toast.success(`Produto ${product.is_active ? "inativado" : "ativado"} com sucesso!`);
      router.refresh(); 
    } catch (error: unknown) {
      console.error(error);
      toast.error("Ocorreu um erro ao alterar o status do produto.");
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/produtos?id=${product.id}`, { method: "DELETE" });
      
      if (!res.ok) throw new Error("Falha ao excluir");
      
      toast.success("Produto excluído com sucesso!");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      toast.error("Erro ao excluir o produto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    toast("Confirmar exclusão", {
      description: `Tem certeza que deseja excluir o produto ${product.name}?`,
      action: {
        label: "Sim, excluir",
        onClick: () => executeDelete(),
      },
      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* Mudámos para variant="secondary" e adicionámos o Settings2 (Sliders) que é muito mais intuitivo para "Gerir" */}
          <Button variant="secondary" className="h-8 w-8 p-0 rounded-full shadow-sm hover:bg-gray-200" disabled={isLoading}>
            <span className="sr-only">Opções do produto</span>
            <Settings2 className="h-4 w-4 text-gray-700" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg">
          <DropdownMenuLabel>Ações do Produto</DropdownMenuLabel>
          
          <DropdownMenuItem asChild className="cursor-pointer py-2">
            <Link href={`/produtos/${product.id}/estoque`}>
              <PackagePlus className="mr-2 h-4 w-4 text-emerald-600" /> 
              <span className="font-medium">Ajustar Estoque</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)} className="cursor-pointer py-2">
            <Edit className="mr-2 h-4 w-4 text-blue-600" /> Editar Produto
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleToggleStatus} className="cursor-pointer py-2">
            <Power className="mr-2 h-4 w-4" /> 
            {product.is_active ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive focus:bg-destructive/10 py-2">
            <Trash className="mr-2 h-4 w-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateProductDialog 
        product={product} 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        trigger={<div className="hidden" />}
      />
    </>
  );
}
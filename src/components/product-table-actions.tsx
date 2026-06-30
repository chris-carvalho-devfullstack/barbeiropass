"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash, Power } from "lucide-react";
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

  // Função que realmente executa a exclusão no banco
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

  // Substituímos o window.confirm por um Toast de confirmação do Sonner
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
          <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
            <span className="sr-only">Abrir menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          
          <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)} className="cursor-pointer">
            <Edit className="mr-2 h-4 w-4" /> Editar
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem onClick={handleToggleStatus} className="cursor-pointer">
            <Power className="mr-2 h-4 w-4" /> 
            {product.is_active ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={handleDelete} className="cursor-pointer text-destructive focus:bg-destructive/10">
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
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Edit, Trash, Power } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner"; // Assumindo que você usa o sonner para toasts
import { useRouter } from "next/navigation";

interface ProductTableActionsProps {
  product: {
    id: string;
    is_active: boolean;
    name: string;
  };
}

export function ProductTableActions({ product }: ProductTableActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
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
      router.refresh(); // Atualiza a tabela na tela
    } catch (error) {
      toast.error("Ocorreu um erro ao alterar o status do produto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja excluir o produto ${product.name}?`)) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/produtos?id=${product.id}`, { method: "DELETE" });
      
      if (!res.ok) throw new Error("Falha ao excluir");
      
      toast.success("Produto excluído com sucesso!");
      router.refresh();
    } catch (error) {
      toast.error("Erro ao excluir o produto.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
          <span className="sr-only">Abrir menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        <DropdownMenuLabel>Ações</DropdownMenuLabel>
        <DropdownMenuItem className="cursor-pointer">
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
  );
}
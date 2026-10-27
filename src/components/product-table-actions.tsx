"use client";

import { useState } from "react";
import {
  Settings2,
  Edit,
  Archive,
  Power,
  PackagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreateProductDialog,
  ProductData,
} from "@/components/create-product-dialog";

interface ProductTableActionsProps {
  product: ProductData;
}

export function ProductTableActions({
  product,
}: ProductTableActionsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const router = useRouter();

  const handleToggleStatus = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/produtos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          currentStatus: product.is_active,
        }),
      });

      if (!res.ok) {
        const result = await res.json().catch(() => null);

        throw new Error(
          result?.error || "Falha ao atualizar o status."
        );
      }

      toast.success(
        `Produto ${product.is_active ? "inativado" : "ativado"} com sucesso!`
      );

      router.refresh();
    } catch (error: unknown) {
      console.error("[PRODUCT_TOGGLE_STATUS_ERROR]", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao alterar o status do produto."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const executeDelete = async () => {
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/produtos?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" }
      );

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          result?.error || "Falha ao arquivar o produto."
        );
      }

      toast.success(
        result?.message || "Produto arquivado com sucesso!"
      );

      router.refresh();
    } catch (error: unknown) {
      console.error("[PRODUCT_ARCHIVE_ERROR]", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Erro ao arquivar o produto."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    toast("Arquivar produto", {
      description:
        `Deseja arquivar "${product.name}"? ` +
        "Ele deixará de aparecer nas operações normais, " +
        "mas seu cadastro e histórico serão preservados.",

      action: {
        label: "Sim, arquivar",
        onClick: () => executeDelete(),
      },

      cancel: {
        label: "Cancelar",
        onClick: () => {},
      },

      duration: 10000,
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            className="h-8 w-8 p-0 rounded-full shadow-sm hover:bg-gray-200"
            disabled={isLoading}
          >
            <span className="sr-only">
              Opções do produto
            </span>

            <Settings2 className="h-4 w-4 text-gray-700" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-48 rounded-xl shadow-lg"
        >
          <DropdownMenuLabel>
            Ações do Produto
          </DropdownMenuLabel>

          <DropdownMenuItem
            asChild
            className="cursor-pointer py-2"
          >
            <Link href={`/produtos/${product.id}/estoque`}>
              <PackagePlus className="mr-2 h-4 w-4 text-emerald-600" />
              <span className="font-medium">
                Ajustar Estoque
              </span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setIsEditDialogOpen(true)}
            className="cursor-pointer py-2"
          >
            <Edit className="mr-2 h-4 w-4 text-blue-600" />
            Editar Produto
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={handleToggleStatus}
            disabled={isLoading}
            className="cursor-pointer py-2"
          >
            <Power className="mr-2 h-4 w-4" />
            {product.is_active ? "Desativar" : "Ativar"}
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={handleDelete}
            disabled={isLoading}
            className="cursor-pointer text-destructive focus:bg-destructive/10 py-2"
          >
            <Archive className="mr-2 h-4 w-4" />
            Arquivar
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
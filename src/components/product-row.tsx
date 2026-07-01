'use client';

import { useState } from "react";
import Image from "next/image";
import { Package, Image as ImageIcon, Barcode, Tag, DollarSign, ArchiveRestore } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProductTableActions } from "@/components/product-table-actions";
import { Separator } from "@/components/ui/separator";
import { ProductData } from "@/components/create-product-dialog";

export interface ProductRowExtended extends ProductData {
  category?: {
    name: string;
  } | null;
}

export function ProductRow({ product }: { product: ProductRowExtended }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleOpenChange = (open: boolean) => {
    setIsModalOpen(open);
    if (!open) {
      setTimeout(() => setActiveImageIndex(0), 300);
    }
  };

  const formattedPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price);
  const formattedCost = product.cost_price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.cost_price) : 'N/A';

  return (
    <>
      <TableRow 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsModalOpen(true)}
      >
        <TableCell>
          {product.images && product.images.length > 0 ? (
            <Image
              src={product.images[0]}
              alt={product.name}
              width={40}
              height={40}
              className="rounded-md object-cover w-10 h-10 border bg-white"
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
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">{formattedPrice}</TableCell>
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
        <TableCell className="text-right" onClick={handleActionClick}>
          <ProductTableActions product={product} />
        </TableCell>
      </TableRow>

      <Dialog open={isModalOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl overflow-hidden p-0 max-h-[90vh] flex flex-col">
          
          {/* Header Fixo (Para não desaparecer ao fazer scroll) */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  {product.name}
                </DialogTitle>
                <DialogDescription className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                  <Barcode className="w-4 h-4" /> EAN: {product.barcode || "N/A"}
                </DialogDescription>
              </div>
              <div className="flex items-center gap-3 pr-6">
                <Badge variant={product.is_active ? "default" : "secondary"} className="text-sm shadow-sm">
                  {product.is_active ? "Ativo" : "Inativo"}
                </Badge>
                {/* O botão de ações fica fixo aqui no topo */}
                <div onClick={handleActionClick}>
                  <ProductTableActions product={product} />
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Área de Conteúdo com Scroll Independente */}
          <div className="p-6 overflow-y-auto overflow-x-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Coluna da Esquerda: Galeria de Fotos */}
              <div className="space-y-4">
                {product.images && product.images.length > 0 ? (
                  <>
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-sm">
                      <Image
                        src={product.images[activeImageIndex] || product.images[0]}
                        alt={product.name}
                        fill
                        className="object-contain p-2" // object-contain exibe a embalagem inteira sem cortar
                      />
                    </div>
                    {product.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {product.images.map((img, index) => (
                          <button
                            key={index}
                            onClick={() => setActiveImageIndex(index)}
                            className={`relative w-16 h-16 flex-shrink-0 overflow-hidden rounded-lg border transition-all ${
                              activeImageIndex === index
                                ? "border-primary ring-2 ring-primary/20 opacity-100"
                                : "border-gray-200 opacity-60 hover:opacity-100 bg-gray-50"
                            }`}
                          >
                            <Image src={img} alt={`Miniatura ${index + 1}`} fill className="object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center aspect-square w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                    <span className="text-sm">Sem fotografias</span>
                  </div>
                )}
              </div>

              {/* Coluna da Direita: Informações do Produto */}
              <div className="space-y-6">
                
                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Categoria
                  </h4>
                  <p className="text-base font-medium text-gray-900">
                    {product.category?.name || "Geral"}
                  </p>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                    <Package className="w-4 h-4" /> SKU / Referência
                  </h4>
                  <p className="text-base font-medium text-gray-900 font-mono bg-gray-100 px-2 py-1 rounded-md inline-block">
                    {product.sku}
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Preço Venda
                    </h4>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formattedPrice}
                    </p>
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <ArchiveRestore className="w-4 h-4" /> Estoque Atual
                    </h4>
                    <p className={`text-2xl font-bold ${product.stock_quantity <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      {product.stock_quantity} un
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <h4 className="text-sm font-medium text-gray-500">
                    Preço de Custo (Interno)
                  </h4>
                  <p className="text-sm font-medium text-gray-700">
                    {formattedCost}
                  </p>
                </div>

                {product.description && (
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-100">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Descrição do Produto
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
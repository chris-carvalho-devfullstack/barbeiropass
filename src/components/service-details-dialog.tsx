"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Clock,
  Tag,
  DollarSign,
  Image as ImageIcon,
  QrCode,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Ajuste a interface de acordo com o seu tipo real de Serviço
interface Servico {
  id: string;
  nome: string;
  categoria: string;
  tempo: string | number;
  preco: string | number;
  status: string;
  codigo?: string;
  fotos?: string[];
}

interface ServiceDetailsDialogProps {
  servico: Servico | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ServiceDetailsDialog({
  servico,
  open,
  onOpenChange,
}: ServiceDetailsDialogProps) {
  // 1. Criado estado para controlar qual foto está aparecendo
  const [fotoAtiva, setFotoAtiva] = useState(0);

  // 2. Reseta para a primeira foto quando abrir o modal
  useEffect(() => {
    if (open) setFotoAtiva(0);
  }, [open, servico?.id]);

  if (!servico) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden p-0">
        {/* Cabeçalho do Modal - Adicionado pr-12 para afastar a tag Ativo do X */}
        <DialogHeader className="px-6 pt-6 pb-2 pr-12">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-zinc-900">
                {servico.nome}
              </DialogTitle>
              <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                <QrCode className="size-4" /> Código: {servico.codigo || "N/A"}
              </p>
            </div>
            <Badge
              variant={servico.status === "Ativo" ? "default" : "secondary"}
              className="text-sm"
            >
              {servico.status}
            </Badge>
          </div>
        </DialogHeader>

        <Separator />

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Coluna da Esquerda: Fotos */}
          <div className="space-y-3">
            {servico.fotos && servico.fotos.length > 0 ? (
              <>
                {/* Foto Principal - Agora usa a variável fotoAtiva */}
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                  <Image
                    src={servico.fotos[fotoAtiva]}
                    alt={servico.nome}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                {/* Miniaturas (se houver mais de 1 foto) */}
                {servico.fotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {/* Alterado para renderizar todas as fotos e torná-las clicáveis */}
                    {servico.fotos.map((foto, index) => (
                      <button
                        key={index}
                        onClick={() => setFotoAtiva(index)}
                        className={`relative size-16 flex-shrink-0 overflow-hidden rounded-lg border transition-all ${
                          fotoAtiva === index
                            ? "border-blue-600 ring-2 ring-blue-100 opacity-100"
                            : "border-zinc-200 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <Image
                          src={foto}
                          alt={`Foto ${index + 1}`}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Fallback sem foto
              <div className="flex flex-col items-center justify-center aspect-square w-full rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 text-zinc-400">
                <ImageIcon className="size-12 mb-2 opacity-50" />
                <span className="text-sm">Sem fotografias</span>
              </div>
            )}
          </div>

          {/* Coluna da Direita: Detalhes - MANTIDO EXATAMENTE IGUAL */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <Tag className="size-4" /> Categoria
              </h4>
              <p className="text-lg font-medium text-zinc-900">
                {servico.categoria}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <Clock className="size-4" /> Duração Estimada
              </h4>
              <p className="text-lg font-medium text-zinc-900">
                {servico.tempo} minutos
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <DollarSign className="size-4" /> Preço Base
              </h4>
              <p className="text-2xl font-bold text-emerald-600">
                R$ {servico.preco}
              </p>
            </div>

            <div className="rounded-lg bg-zinc-50 p-4 border border-zinc-100 mt-4">
              <p className="text-sm text-zinc-500">
                Este serviço é visível para os clientes no catálogo online e no
                PDV da barbearia.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

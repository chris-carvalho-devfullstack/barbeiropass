"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  Clock,
  Tag,
  DollarSign,
  Image as ImageIcon,
  QrCode,
  FileText
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Interface actualizada para el patrón en Inglés de la base de datos
interface Servico {
  id: string;
  name: string;
  description?: string;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  category?: string; 
  code?: string;
  photos?: string[]; 
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
  const [fotoAtiva, setFotoAtiva] = useState(0);

  useEffect(() => {
    if (open) setFotoAtiva(0);
  }, [open, servico?.id]);

  if (!servico) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl overflow-hidden p-0">
        <DialogHeader className="px-6 pt-6 pb-2 pr-12">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {servico.name}
              </DialogTitle>
              <p className="text-sm text-zinc-500 mt-1 flex items-center gap-2">
                <QrCode className="size-4" /> Código: {servico.code || "N/A"}
              </p>
            </div>
            <Badge
              variant={servico.is_active ? "default" : "secondary"}
              className="text-sm"
            >
              {servico.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </DialogHeader>

        <Separator />

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna de la Izquierda: Fotos */}
          <div className="space-y-3">
            {servico.photos && servico.photos.length > 0 ? (
              <>
                <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <Image
                    src={servico.photos[fotoAtiva]}
                    alt={servico.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                {servico.photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                    {servico.photos.map((foto, index) => (
                      <button
                        key={index}
                        onClick={() => setFotoAtiva(index)}
                        className={`relative size-16 flex-shrink-0 overflow-hidden rounded-lg border transition-all ${
                          fotoAtiva === index
                            ? "border-blue-600 ring-2 ring-blue-100 dark:ring-blue-900 opacity-100"
                            : "border-zinc-200 dark:border-zinc-800 opacity-60 hover:opacity-100"
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
              <div className="flex flex-col items-center justify-center aspect-square w-full rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-400">
                <ImageIcon className="size-12 mb-2 opacity-50" />
                <span className="text-sm">Sem fotografias</span>
              </div>
            )}
          </div>

          {/* Columna de la Derecha: Detalles */}
          <div className="space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <Tag className="size-4" /> Categoria
              </h4>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {servico.category || "Geral"}
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <Clock className="size-4" /> Duração Estimada
              </h4>
              <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {servico.duration_minutes} minutos
              </p>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                <DollarSign className="size-4" /> Preço Base
              </h4>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                R$ {servico.price}
              </p>
            </div>

            {servico.description && (
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-zinc-500 flex items-center gap-2">
                  <FileText className="size-4" /> Descrição
                </h4>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {servico.description}
                </p>
              </div>
            )}

            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-4 border border-zinc-100 dark:border-zinc-800 mt-4">
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
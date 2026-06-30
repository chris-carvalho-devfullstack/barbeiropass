"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  totalItems: number;
  currentPage: number;
  limit: number;
}

export function PaginationControls({ totalItems, currentPage, limit }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const createPageURL = (pageNumber: number, newLimit?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    if (newLimit) {
      params.set("limit", newLimit.toString());
    }
    return `${pathname}?${params.toString()}`;
  };

  const handleLimitChange = (value: string) => {
    // Ao mudar o limite (ex: 20 para 50), voltamos à página 1 para evitar bugs de offset
    router.push(createPageURL(1, parseInt(value)));
  };

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 border-t">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <p>Mostrar</p>
        <Select value={limit.toString()} onValueChange={handleLimitChange}>
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={limit.toString()} />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
            <SelectItem value="100">100</SelectItem>
          </SelectContent>
        </Select>
        <p>por página</p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          A mostrar {(currentPage - 1) * limit + 1} a {Math.min(currentPage * limit, totalItems)} de {totalItems}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isFirstPage}
            onClick={() => router.push(createPageURL(currentPage - 1))}
          >
            <span className="sr-only">Página anterior</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={isLastPage}
            onClick={() => router.push(createPageURL(currentPage + 1))}
          >
            <span className="sr-only">Próxima página</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
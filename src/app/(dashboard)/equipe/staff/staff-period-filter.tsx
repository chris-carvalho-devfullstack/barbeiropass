"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";

export function StaffPeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Pega o período atual da URL ou define 'hoje' como padrão
  const currentPeriod = searchParams.get("period") || "hoje";

  const handlePeriodChange = (val: string) => {
    // Atualiza a URL sem recarregar a página bruscamente, acionando o Server Component
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", val);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Select value={currentPeriod} onValueChange={handlePeriodChange}>
      <SelectTrigger className="w-[180px] h-9 bg-background shadow-sm">
        <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground" />
        <SelectValue placeholder="Selecione o período" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hoje">Diário (Hoje)</SelectItem>
        <SelectItem value="semana">Nesta Semana</SelectItem>
        <SelectItem value="mes">Neste Mês</SelectItem>
        <SelectItem value="todos">Todo o Período</SelectItem>
        {/* A opção "Personalizado" pode abrir um DatePicker em atualizações futuras */}
        <SelectItem value="personalizado" disabled>Personalizado (Em breve)</SelectItem>
      </SelectContent>
    </Select>
  );
}
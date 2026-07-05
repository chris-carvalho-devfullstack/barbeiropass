"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export function StaffPeriodFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const period = searchParams.get("period") || "hoje";
  const [date, setDate] = React.useState<DateRange | undefined>({
    from: searchParams.get("from") ? new Date(searchParams.get("from") as string) : undefined,
    to: searchParams.get("to") ? new Date(searchParams.get("to") as string) : undefined,
  });

  const handlePeriodChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", val);

    if (val !== "personalizado") {
      params.delete("from");
      params.delete("to");
      setDate(undefined);
    }
    
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", "personalizado");
      params.set("from", range.from.toISOString());
      params.set("to", range.to.toISOString());
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={period} onValueChange={handlePeriodChange}>
        <SelectTrigger className="h-10 w-32.5 sm:w-37.5 bg-background shadow-sm whitespace-nowrap">
          <CalendarIcon className="w-4 h-4 mr-2 text-muted-foreground shrink-0 hidden sm:block" />
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="hoje">Hoje</SelectItem>
          <SelectItem value="semana">Semana</SelectItem>
          <SelectItem value="mes">Mês</SelectItem>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="personalizado">Personalizado</SelectItem>
        </SelectContent>
      </Select>

      {period === "personalizado" && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={"outline"}
              className={cn(
                "h-10 w-fit justify-start text-left font-normal bg-background shadow-sm",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd/MM/yy")} - {format(date.to, "dd/MM/yy")}
                    </>
                  ) : (
                    format(date.from, "dd/MM/yy")
                  )
                ) : (
                  "Escolha as datas"
                )}
              </span>
              <span className="inline sm:hidden">
                {date?.from && date?.to ? "Datas Selecionadas" : "Datas"}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleDateSelect}
              numberOfMonths={1}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
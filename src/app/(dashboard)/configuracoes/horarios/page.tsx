// src/app/(dashboard)/configuracoes/horarios/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { BusinessHourItem } from "../../perfil/actions";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const DEFAULT_HOURS: BusinessHourItem[] = DIAS.map((_, index) => ({
  day_of_week: index,
  open_time: "09:00",
  close_time: "19:00",
  is_closed: index === 0, // Domingo fechado por padrão
}));

export default function HorariosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Estado inicial dos horários
  const [hours, setHours] = useState<BusinessHourItem[]>(DEFAULT_HOURS);

  // Carrega os horários reais salvos no banco ao abrir a página
  useEffect(() => {
    async function loadBusinessHours() {
      try {
        const response = await fetch("/api/configuracoes/horarios", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data?.hours) && data.hours.length > 0) {
            const mergedHours = DIAS.map((_, index) => {
              const found = data.hours.find((h: BusinessHourItem) => h.day_of_week === index);
              return found
                ? {
                    day_of_week: index,
                    open_time: String(found.open_time).slice(0, 5),
                    close_time: String(found.close_time).slice(0, 5),
                    is_closed: Boolean(found.is_closed),
                  }
                : DEFAULT_HOURS[index];
            });
            setHours(mergedHours);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar horários da barbearia:", error);
      } finally {
        setFetching(false);
      }
    }

    loadBusinessHours();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/configuracoes/horarios", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hours }),
      });

      const res = await response.json().catch(() => null);

      if (response.ok && res?.success) {
        toast.success("Horários atualizados com sucesso!");
        router.refresh();
        router.push("/dashboard");
      } else {
        toast.error(res?.error || "Falha ao salvar horários.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Ocorreu um erro inesperado de conexão.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 animate-in fade-in zoom-in duration-500">
      
      {/* Cabeçalho com Botão Voltar */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Horários de Atendimento</h1>
          <p className="text-muted-foreground mt-1">Configure os dias e horas que sua barbearia funciona.</p>
        </div>
      </div>

      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="space-y-4 pt-6">
          {fetching ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 gap-2">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm font-medium">Carregando horários salvos...</span>
            </div>
          ) : (
            hours.map((item, idx) => (
              <div
                key={item.day_of_week}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
              >
                <div className="w-24 font-bold text-zinc-900">{DIAS[idx]}</div>

                <div className="flex flex-1 items-center gap-4">
                  {!item.is_closed ? (
                    <div className="flex items-center gap-3">
                      <input
                        type="time"
                        value={item.open_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHours((prev) =>
                            prev.map((h, i) => (i === idx ? { ...h, open_time: val } : h))
                          );
                        }}
                        className="border border-zinc-300 rounded-md p-1.5 text-sm font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                      <span className="text-zinc-500 text-sm font-medium">até</span>
                      <input
                        type="time"
                        value={item.close_time}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHours((prev) =>
                            prev.map((h, i) => (i === idx ? { ...h, close_time: val } : h))
                          );
                        }}
                        className="border border-zinc-300 rounded-md p-1.5 text-sm font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm italic font-medium py-1.5 w-full sm:w-auto">
                      Fechado neste dia
                    </span>
                  )}
                </div>

                {/* Botão Switch Aberto/Fechado */}
                <div className="flex items-center gap-3 sm:border-l sm:pl-4">
                  <span
                    className={`text-xs uppercase font-bold ${
                      !item.is_closed ? "text-indigo-600" : "text-zinc-400"
                    }`}
                  >
                    {!item.is_closed ? "Aberto" : "Fechado"}
                  </span>
                  <Switch
                    checked={!item.is_closed}
                    onCheckedChange={(checked) => {
                      setHours((prev) =>
                        prev.map((h, i) => (i === idx ? { ...h, is_closed: !checked } : h))
                      );
                    }}
                  />
                </div>
              </div>
            ))
          )}

          <div className="pt-4">
            <Button
              onClick={handleSave}
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-6"
              disabled={loading || fetching}
            >
              {loading ? <Loader2 className="size-5 animate-spin mr-2" /> : null}
              {loading ? "Salvando informações..." : "Confirmar todos os horários"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
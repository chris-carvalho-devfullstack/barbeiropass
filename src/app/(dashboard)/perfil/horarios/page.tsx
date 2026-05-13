"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { updateBusinessHours } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function HorariosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Estado inicial dos horários
  const [hours, setHours] = useState(DIAS.map((dia, index) => ({
    day_of_week: index,
    open_time: "09:00",
    close_time: "19:00",
    is_closed: index === 0 // Domingo fechado por padrão
  })));

  const handleSave = async () => {
    try {
      setLoading(true);
      const res = await updateBusinessHours(hours);
      
      if (res?.success) {
        toast.success("Horários atualizados com sucesso!");
        router.push("/dashboard");
      } else {
        // AGORA SIM O ERRO VAI APARECER NA TELA!
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
          {hours.map((item, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 bg-zinc-50/50 hover:bg-zinc-50 transition-colors">
              <div className="w-24 font-bold text-zinc-900">{DIAS[idx]}</div>
              
              <div className="flex flex-1 items-center gap-4">
                {!item.is_closed ? (
                  <div className="flex items-center gap-3">
                    <input 
                      type="time" 
                      value={item.open_time} 
                      onChange={e => {
                        const newHours = [...hours];
                        newHours[idx].open_time = e.target.value;
                        setHours(newHours);
                      }}
                      className="border border-zinc-300 rounded-md p-1.5 text-sm font-medium focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                    <span className="text-zinc-500 text-sm font-medium">até</span>
                    <input 
                      type="time" 
                      value={item.close_time}
                      onChange={e => {
                        const newHours = [...hours];
                        newHours[idx].close_time = e.target.value;
                        setHours(newHours);
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
                <span className={`text-xs uppercase font-bold ${!item.is_closed ? 'text-indigo-600' : 'text-zinc-400'}`}>
                  {!item.is_closed ? 'Aberto' : 'Fechado'}
                </span>
                <Switch 
                  checked={!item.is_closed} 
                  onCheckedChange={(checked) => {
                    const newHours = [...hours];
                    newHours[idx].is_closed = !checked;
                    setHours(newHours);
                  }}
                />
              </div>
            </div>
          ))}
          
          <div className="pt-4">
            <Button 
              onClick={handleSave} 
              className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-medium py-6" 
              disabled={loading}
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
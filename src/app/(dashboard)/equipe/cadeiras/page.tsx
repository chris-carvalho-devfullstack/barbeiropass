"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { 
  Armchair, Plus, AlertCircle, Loader2, UserMinus, UserCheck, Settings2 
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ==========================================
// INTERFACES ESTritas
// ==========================================
interface WorkStation {
  id: string;
  name: string;
  status: string;
}

interface StaffMember {
  id: string;
  full_name: string;
  work_station_id: string | null;
  role: string;
}

export default function CadeirasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle do Modal de Nova Cadeira
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Busca Inicial
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user.id)
        .single();

      if (!memberData) return;

      // Busca cadeiras
      const { data: stations, error: stationsError } = await supabase
        .from("work_stations")
        .select("id, name, status")
        .eq("barbershop_id", memberData.barbershop_id)
        .order("created_at", { ascending: true });

      if (stationsError) throw stationsError;
      setWorkStations((stations as WorkStation[]) || []);

      // Busca profissionais operacionais
      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("id, full_name, work_station_id, role")
        .eq("barbershop_id", memberData.barbershop_id)
        .neq("role", "receptionist") // Recepcionista não tem cadeira
        .eq("is_active", true);

      if (staffError) throw staffError;
      setStaffMembers((staff as StaffMember[]) || []);

    } catch (error) {
      toast.error("Erro ao carregar dados das bancadas.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Função para Criar Cadeira
  async function handleCreateStation() {
    if (!newStationName.trim()) {
      toast.error("O nome da bancada é obrigatório.");
      return;
    }

    setIsCreating(true);
    const toastId = toast.loading("Criando nova bancada...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberData } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user?.id)
        .single();

      const { error } = await supabase.from("work_stations").insert({
        barbershop_id: memberData?.barbershop_id,
        name: newStationName,
        status: "active"
      });

      if (error) throw error;

      toast.success("Bancada criada com sucesso!", { id: toastId });
      setNewStationName("");
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Erro ao criar a bancada.", { id: toastId });
    } finally {
      setIsCreating(false);
    }
  }

  // Função para Atrelar/Remover Profissional da Cadeira
  async function handleAssignStaff(workStationId: string, staffId: string) {
    const toastId = toast.loading("Atualizando atribuição...");
    try {
      // 1. Se estiver a atribuir a "Ninguém" (valor "unassign")
      if (staffId === "unassign") {
        const currentStaff = staffMembers.find(s => s.work_station_id === workStationId);
        if (currentStaff) {
          await supabase.from("staff").update({ work_station_id: null }).eq("id", currentStaff.id);
        }
      } else {
        // 2. Se estiver a atribuir a um Barbeiro
        // Primeiro, limpa a cadeira anterior deste barbeiro (se houver)
        await supabase.from("staff").update({ work_station_id: null }).eq("id", staffId);
        
        // Segundo, vincula o barbeiro à nova cadeira
        await supabase.from("staff").update({ work_station_id: workStationId }).eq("id", staffId);
      }

      toast.success("Bancada atualizada!", { id: toastId });
      fetchData(); // Recarrega para sincronizar o estado visual
    } catch (error) {
      toast.error("Erro ao vincular profissional.", { id: toastId });
    }
  }

  // Helpers para a UI
  const getStaffInStation = (stationId: string) => {
    return staffMembers.find((staff) => staff.work_station_id === stationId);
  };

  const getUnassignedStaff = () => {
    return staffMembers.filter((staff) => !staff.work_station_id);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-400">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-medium">Carregando layout da barbearia...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 animate-in fade-in zoom-in duration-500 max-w-7xl mx-auto w-full">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <Armchair className="size-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-foreground">Bancadas e Cadeiras</h2>
            <p className="text-sm text-muted-foreground font-medium">
              Gestão física do salão e alocação de profissionais.
            </p>
          </div>
        </div>
        
        <Button onClick={() => setIsModalOpen(true)} className="font-bold shadow-sm">
          <Plus className="size-4 mr-2" />
          Nova Bancada
        </Button>
      </div>

      {/* GRID DE CADEIRAS */}
      {workStations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-2xl bg-muted/20">
          <Armchair className="size-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-bold">Nenhuma bancada cadastrada</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
            Crie os postos de trabalho físicos da sua barbearia para começar a atribuir sua equipe.
          </p>
          <Button onClick={() => setIsModalOpen(true)} variant="outline">
            Criar Primeira Bancada
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {workStations.map((station) => {
            const assignedStaff = getStaffInStation(station.id);
            const availableStaff = getUnassignedStaff();

            return (
              <Card key={station.id} className="flex flex-col justify-between shadow-sm hover:border-primary/50 transition-colors">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-primary/10 text-primary rounded-lg">
                        <Armchair className="size-4" />
                      </div>
                      <CardTitle className="text-base">{station.name}</CardTitle>
                    </div>
                    <Badge variant={station.status === "active" ? "outline" : "secondary"} className={station.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-200" : ""}>
                      {station.status === "active" ? "Ativa" : "Manutenção"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className="bg-muted/40 p-4 rounded-xl border border-border/50">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Profissional Alocado
                    </p>
                    
                    <Select
                      value={assignedStaff?.id || "unassign"}
                      onValueChange={(value) => handleAssignStaff(station.id, value)}
                    >
                      <SelectTrigger className="w-full bg-background border-slate-200 dark:border-zinc-800 focus:ring-primary shadow-sm h-11">
                        <SelectValue>
                          {assignedStaff ? (
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              <UserCheck className="size-4 text-emerald-500" />
                              {assignedStaff.full_name}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <UserMinus className="size-4" />
                              Livre / Sem Atribuição
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {/* Opção para desvincular */}
                        <SelectItem value="unassign" className="text-muted-foreground italic">
                          Deixar Livre
                        </SelectItem>
                        
                        {/* Profissional atualmente alocado */}
                        {assignedStaff && (
                          <SelectItem value={assignedStaff.id} className="font-semibold text-primary">
                            {assignedStaff.full_name} (Atual)
                          </SelectItem>
                        )}
                        
                        {/* Profissionais sem cadeira */}
                        {availableStaff.length > 0 && (
                          <optgroup label="Profissionais Disponíveis" className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-1">
                            {availableStaff.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id} className="cursor-pointer">
                                {staff.full_name}
                              </SelectItem>
                            ))}
                          </optgroup>
                        )}
                      </SelectContent>
                    </Select>

                  </div>
                </CardContent>

                <CardFooter className="pt-0 justify-between text-muted-foreground">
                  <Button variant="ghost" size="sm" className="px-2 h-8 text-xs hover:text-foreground">
                    <Settings2 className="size-3 mr-1.5" /> Opções
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL CRIAR CADEIRA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Nova Bancada</DialogTitle>
            <DialogDescription>
              Adicione um novo posto de trabalho físico na sua barbearia.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-semibold text-foreground">
                Nome ou Número da Cadeira
              </label>
              <Input
                id="name"
                placeholder="Ex: Cadeira 01, VIP Room, Bancada Principal..."
                value={newStationName}
                onChange={(e) => setNewStationName(e.target.value)}
                className="col-span-3"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isCreating}>
              Cancelar
            </Button>
            <Button onClick={handleCreateStation} disabled={isCreating || !newStationName.trim()}>
              {isCreating ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />}
              Salvar Bancada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
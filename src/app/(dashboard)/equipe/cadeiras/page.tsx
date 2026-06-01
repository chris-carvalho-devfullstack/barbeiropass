"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { 
  Armchair, Plus, Loader2, UserMinus, UserCheck, 
  Settings2, MoreHorizontal, Edit2, Wrench, Trash2, ShieldAlert
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle 
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

// ==========================================
// INTERFACES ESTRITAS
// ==========================================
interface WorkStation {
  id: string;
  name: string;
  status: "active" | "maintenance";
}

interface StaffMember {
  id: string;
  full_name: string;
  work_station_id: string | null;
  role: string;
}

// Tipos de Ordenação
type SortOrder = "num_asc" | "num_desc" | "az" | "za";

export default function CadeirasPage() {
  const supabase = useMemo(() => createClient(), []);

  const [workStations, setWorkStations] = useState<WorkStation[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Estados de Formulário e Seleção
  const [newStationName, setNewStationName] = useState("");
  const [selectedStation, setSelectedStation] = useState<WorkStation | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Estado de Ordenação
  const [sortOrder, setSortOrder] = useState<SortOrder>("num_asc");

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

      const { data: stations, error: stationsError } = await supabase
        .from("work_stations")
        .select("id, name, status")
        .eq("barbershop_id", memberData.barbershop_id)
        .order("created_at", { ascending: true });

      if (stationsError) throw stationsError;
      setWorkStations((stations as WorkStation[]) || []);

      const { data: staff, error: staffError } = await supabase
        .from("staff")
        .select("id, full_name, work_station_id, role")
        .eq("barbershop_id", memberData.barbershop_id)
        .neq("role", "receptionist")
        .eq("is_active", true);

      if (staffError) throw staffError;
      setStaffMembers((staff as StaffMember[]) || []);

    } catch (error) {
      console.error(error); // Corrigido o aviso do VSCode ('error' never used)
      toast.error("Erro ao carregar dados das bancadas.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ==========================================
  // ORDENAÇÃO DINÂMICA
  // ==========================================
  const sortedWorkStations = useMemo(() => {
    return [...workStations].sort((a, b) => {
      if (sortOrder === "az") {
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      }
      if (sortOrder === "za") {
        return b.name.localeCompare(a.name, undefined, { numeric: true });
      }
      if (sortOrder === "num_asc" || sortOrder === "num_desc") {
        // Extrai os dígitos do nome para ordenar numericamente (Cadeira 1 vs Cadeira 10)
        const numA = parseInt(a.name.replace(/\D/g, "") || "0", 10);
        const numB = parseInt(b.name.replace(/\D/g, "") || "0", 10);
        
        if (sortOrder === "num_asc") return numA - numB;
        return numB - numA;
      }
      return 0;
    });
  }, [workStations, sortOrder]);

  // ==========================================
  // LÓGICAS DE CRUD E AÇÕES DE BANCO DE DADOS
  // ==========================================

  async function handleCreateStation() {
    if (!newStationName.trim()) {
      toast.error("O nome da bancada é obrigatório.");
      return;
    }
    setIsProcessing(true);
    const toastId = toast.loading("Criando nova bancada...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberData } = await supabase.from("barbershop_members").select("barbershop_id").eq("profile_id", user?.id).single();

      const { error } = await supabase.from("work_stations").insert({
        barbershop_id: memberData?.barbershop_id,
        name: newStationName,
        status: "active"
      });

      if (error) throw error;
      toast.success("Bancada criada com sucesso!", { id: toastId });
      setNewStationName("");
      setIsCreateModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao criar a bancada.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleUpdateStationName() {
    if (!selectedStation || !newStationName.trim()) return;
    setIsProcessing(true);
    const toastId = toast.loading("Atualizando bancada...");

    try {
      const { error } = await supabase
        .from("work_stations")
        .update({ name: newStationName })
        .eq("id", selectedStation.id);

      if (error) throw error;
      toast.success("Bancada atualizada!", { id: toastId });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar a bancada.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleToggleStatus(station: WorkStation) {
    const newStatus = station.status === "active" ? "maintenance" : "active";
    const toastId = toast.loading("Alterando status...");

    try {
      if (newStatus === "maintenance") {
        await supabase.from("staff").update({ work_station_id: null }).eq("work_station_id", station.id);
      }

      const { error } = await supabase
        .from("work_stations")
        .update({ status: newStatus })
        .eq("id", station.id);

      if (error) throw error;
      toast.success(newStatus === "active" ? "Bancada ativada!" : "Bancada enviada para manutenção.", { id: toastId });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao alterar o status.", { id: toastId });
    }
  }

  async function handleDeleteStation() {
    if (!selectedStation) return;
    setIsProcessing(true);
    const toastId = toast.loading("Excluindo bancada...");

    try {
      await supabase.from("staff").update({ work_station_id: null }).eq("work_station_id", selectedStation.id);
      const { error } = await supabase.from("work_stations").delete().eq("id", selectedStation.id);
      
      if (error) throw error;
      toast.success("Bancada excluída com sucesso.", { id: toastId });
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir a bancada.", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleAssignStaff(workStationId: string, staffId: string) {
    const toastId = toast.loading("Atualizando atribuição...");
    try {
      if (staffId === "unassign") {
        await supabase.from("staff").update({ work_station_id: null }).eq("work_station_id", workStationId);
      } else {
        await supabase.from("staff").update({ work_station_id: null }).eq("id", staffId);
        await supabase.from("staff").update({ work_station_id: workStationId }).eq("id", staffId);
      }
      toast.success("Bancada atualizada!", { id: toastId });
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao vincular profissional.", { id: toastId });
    }
  }

  const getStaffInStation = (stationId: string) => staffMembers.find((staff) => staff.work_station_id === stationId);
  const getUnassignedStaff = () => staffMembers.filter((staff) => !staff.work_station_id);

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
      
      {/* CABEÇALHO COM BOTÃO DE NOVA BANCADA E FILTRO */}
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
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select value={sortOrder} onValueChange={(value: SortOrder) => setSortOrder(value)}>
            <SelectTrigger className="w-full sm:w-[170px] bg-background">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Numérico</SelectLabel>
                <SelectItem value="num_asc">1-9 (Crescente)</SelectItem>
                <SelectItem value="num_desc">9-1 (Decrescente)</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Alfabético</SelectLabel>
                <SelectItem value="az">A-Z (Crescente)</SelectItem>
                <SelectItem value="za">Z-A (Decrescente)</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button onClick={() => { setNewStationName(""); setIsCreateModalOpen(true); }} className="font-bold shadow-sm whitespace-nowrap">
            <Plus className="size-4 mr-2" />
            Nova Bancada
          </Button>
        </div>
      </div>

      {/* GRID DE CADEIRAS */}
      {sortedWorkStations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed rounded-2xl bg-muted/20">
          <Armchair className="size-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-bold">Nenhuma bancada cadastrada</h3>
          <p className="text-sm text-muted-foreground max-w-sm mt-1 mb-6">
            Crie os postos de trabalho físicos da sua barbearia para começar a atribuir sua equipe.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} variant="outline">
            Criar Primeira Bancada
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedWorkStations.map((station) => {
            const assignedStaff = getStaffInStation(station.id);
            const availableStaff = getUnassignedStaff();
            const isMaintenance = station.status === "maintenance";

            return (
              <Card 
                key={station.id} 
                className={`flex flex-col justify-between shadow-sm transition-all duration-300 ${isMaintenance ? 'border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/10 opacity-80' : 'hover:border-primary/50'}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-lg ${isMaintenance ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-500' : 'bg-primary/10 text-primary'}`}>
                        {isMaintenance ? <Wrench className="size-4" /> : <Armchair className="size-4" />}
                      </div>
                      <CardTitle className="text-base">{station.name}</CardTitle>
                    </div>
                    <Badge variant={isMaintenance ? "secondary" : "outline"} className={!isMaintenance ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                      {!isMaintenance ? "Ativa" : "Manutenção"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pb-4">
                  <div className={`p-4 rounded-xl border ${isMaintenance ? 'bg-amber-100/50 border-amber-200/50' : 'bg-muted/40 border-border/50'}`}>
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Profissional Alocado
                    </p>
                    
                    <Select
                      disabled={isMaintenance}
                      value={assignedStaff?.id || "unassign"}
                      onValueChange={(value) => handleAssignStaff(station.id, value)}
                    >
                      <SelectTrigger className="w-full bg-background border-slate-200 dark:border-zinc-800 focus:ring-primary shadow-sm h-11">
                        <SelectValue>
                          {isMaintenance ? (
                            <span className="text-amber-600/70 font-medium text-sm flex items-center gap-2"><ShieldAlert className="size-4" /> Cadeira Indisponível</span>
                          ) : assignedStaff ? (
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
                        <SelectItem value="unassign" className="text-muted-foreground italic">
                          Deixar Livre
                        </SelectItem>
                        
                        {assignedStaff && (
                          <SelectItem value={assignedStaff.id} className="font-semibold text-primary">
                            {assignedStaff.full_name} (Atual)
                          </SelectItem>
                        )}
                        
                        {availableStaff.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5 mt-1">
                              Profissionais Disponíveis
                            </SelectLabel>
                            {availableStaff.map((staff) => (
                              <SelectItem key={staff.id} value={staff.id} className="cursor-pointer">
                                {staff.full_name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>

                {/* MENU DE OPÇÕES (VISUAL MANTIDO, AGORA FUNCIONAL) */}
                <CardFooter className="pt-0 justify-end text-muted-foreground">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="px-2 h-8 text-xs hover:text-foreground">
                        <Settings2 className="size-3 mr-1.5" /> Opções
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => {
                        setSelectedStation(station);
                        setNewStationName(station.name);
                        setIsEditModalOpen(true);
                      }}>
                        <Edit2 className="mr-2 size-4" /> Editar Nome
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleStatus(station)}>
                        <Wrench className="mr-2 size-4" /> 
                        {isMaintenance ? "Marcar como Ativa" : "Colocar em Manutenção"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-950"
                        onClick={() => {
                          setSelectedStation(station);
                          setIsDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="mr-2 size-4" /> Excluir Bancada
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAIS (CRIAR, EDITAR, EXCLUIR) */}
      {/* ============================================================ */}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md"> {/* Corrigido o erro do Tailwind sm:max-w-[425px] */}
          <DialogHeader>
            <DialogTitle>Nova Bancada</DialogTitle>
            <DialogDescription>Adicione um novo posto de trabalho físico na sua barbearia.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name-create" className="text-sm font-semibold text-foreground">Nome ou Número da Cadeira</label>
              <Input id="name-create" placeholder="Ex: Cadeira 01, VIP Room..." value={newStationName} onChange={(e) => setNewStationName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={isProcessing}>Cancelar</Button>
            <Button onClick={handleCreateStation} disabled={isProcessing || !newStationName.trim()}>
              {isProcessing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Plus className="size-4 mr-2" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md"> {/* Corrigido o erro do Tailwind sm:max-w-[425px] */}
          <DialogHeader>
            <DialogTitle>Editar Bancada</DialogTitle>
            <DialogDescription>Altere a identificação desta cadeira no sistema.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name-edit" className="text-sm font-semibold text-foreground">Novo Nome</label>
              <Input id="name-edit" value={newStationName} onChange={(e) => setNewStationName(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={isProcessing}>Cancelar</Button>
            <Button onClick={handleUpdateStationName} disabled={isProcessing || !newStationName.trim() || newStationName === selectedStation?.name}>
              {isProcessing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />} Atualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="size-5" /> Tem certeza absoluta?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação excluirá a bancada <strong>{selectedStation?.name}</strong> permanentemente do sistema.
              {getStaffInStation(selectedStation?.id || "") && (
                <span className="block mt-2 font-semibold text-amber-600">
                  Aviso: O profissional alocado a esta cadeira perderá a sua vinculação física.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => { e.preventDefault(); handleDeleteStation(); }} 
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isProcessing}
            >
              {isProcessing ? <Loader2 className="size-4 animate-spin mr-2" /> : <Trash2 className="size-4 mr-2" />}
              Sim, Excluir Bancada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// Corrigido o erro do any (Tipagem estrita do React Component Props para SVG)
function Save(props: React.ComponentProps<"svg">) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
    </svg>
  )
}
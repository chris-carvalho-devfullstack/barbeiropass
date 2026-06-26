"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { 
  Loader2, ShieldCheck, MoreHorizontal, 
  Pencil, Trash2, Search, ArrowDownAZ, ArrowUpZA, UserX, UserCheck, ChevronRight,
  IdCard, UserPlus, LayoutDashboard
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface StaffMember {
  id: string;
  full_name: string;
  role: 'owner' | 'manager' | 'barber' | 'receptionist';
  unique_code: string;
  payment_model: 'commission' | 'fixed_fee';
  is_active: boolean;
  avatar_url?: string | null;
}

const roleMap: Record<StaffMember['role'], { label: string; color: string }> = {
  owner: { label: 'Proprietário', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  barber: { label: 'Barbeiro', color: 'bg-zinc-100 text-zinc-700 border-zinc-200' },
  receptionist: { label: 'Recepção', color: 'bg-orange-100 text-orange-700 border-orange-200' },
};

export default function EquipePage() {
  const router = useRouter();
  
  // Utilizando useMemo para garantir que o supabase client não seja recriado a cada renderização
  const supabase = useMemo(() => createClient(), []);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de controle do novo Dialog Unificado (Criar/Editar)
  const [isStaffFormOpen, setIsStaffFormOpen] = useState(false);
  const [staffToEditId, setStaffToEditId] = useState<string | null>(null);

  // Envolvendo no useCallback para evitar warnings do useEffect
  const fetchStaff = useCallback(async () => {
    try {
      setLoading(true);

      // 1. CORREÇÃO DE SEGURANÇA (IDOR/MULTI-TENANT): Pegar o usuário logado
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Usuário não autenticado");

      // 2. CORREÇÃO DE SEGURANÇA: Descobrir de qual barbearia este usuário é (Trava Multi-tenant)
      const { data: memberData, error: memberError } = await supabase
        .from("barbershop_members")
        .select("barbershop_id")
        .eq("profile_id", user.id)
        .single();

      if (memberError || !memberData) {
        throw new Error("Você não possui vínculo com nenhuma barbearia.");
      }

      // 3. CORREÇÃO DE SEGURANÇA: Buscar ESTRITAMENTE a equipe desta barbearia com o filtro .eq()
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, role, unique_code, payment_model, is_active, avatar_url")
        .eq("barbershop_id", memberData.barbershop_id); // <-- O FILTRO SALVADOR AQUI

      if (error) throw error;
      setStaff(data as StaffMember[] || []);
    } catch (error) {
      console.error("[FETCH_STAFF_ERROR]", error);
      toast.error("Erro ao carregar a lista da equipe.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const filteredAndSortedStaff = useMemo(() => {
    return staff
      .filter((member) => {
        const term = searchTerm.toLowerCase();
        return (
          member.full_name.toLowerCase().includes(term) ||
          (member.unique_code && member.unique_code.toLowerCase().includes(term))
        );
      })
      .sort((a, b) => {
        if (sortOrder === "asc") {
          return a.full_name.localeCompare(b.full_name);
        }
        return b.full_name.localeCompare(a.full_name);
      });
  }, [staff, searchTerm, sortOrder]);

  async function handleToggleStatus(member: StaffMember) {
    const toastId = toast.loading("Atualizando status...");
    try {
      const { error } = await supabase
        .from("staff")
        .update({ is_active: !member.is_active })
        .eq("id", member.id);

      if (error) throw error;
      toast.success(`Profissional ${member.is_active ? "desativado" : "ativado"} com sucesso!`, { id: toastId });
      fetchStaff();
    } catch (error) {
      console.error("[TOGGLE_STATUS_ERROR]", error);
      toast.error("Erro ao atualizar status.", { id: toastId });
    }
  }

  async function confirmDelete() {
    if (!staffToDelete) return;
    
    setIsDeleting(true);
    const toastId = toast.loading("Excluindo profissional...");
    
    try {
      const response = await fetch(`/api/staff?id=${staffToDelete}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao excluir o registro.");
      }

      toast.success("Profissional excluído com sucesso!", { id: toastId });
      fetchStaff();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao excluir profissional.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsDeleting(false);
      setStaffToDelete(null);
    }
  }

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : name.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex flex-col gap-6 p-2 md:p-6 animate-in fade-in zoom-in duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <IdCard className="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Equipe</h2>
            <p className="text-sm text-slate-500 font-medium">
              Gestão de equipe, comissões e acessos.
            </p>
          </div>
        </div>
        
        <Button onClick={() => {
          setStaffToEditId(null);
          setIsStaffFormOpen(true);
        }} className="font-bold shadow-sm">
          <UserPlus className="size-4 mr-2" />
          Novo Membro
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white dark:bg-zinc-950 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou código..." 
            className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto text-slate-600 font-medium"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            {sortOrder === "asc" ? <ArrowDownAZ className="size-4 mr-2" /> : <ArrowUpZA className="size-4 mr-2" />}
            {sortOrder === "asc" ? "A - Z" : "Z - A"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="size-8 animate-spin text-blue-500" />
            <p className="font-medium">Carregando equipe...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900 border-b border-slate-200">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Profissional</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Cargo</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Código</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-300">Contrato</TableHead>
                  <TableHead className="w-20 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-slate-500 font-medium">
                      Nenhum profissional cadastrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedStaff.map((member) => (
                    <TableRow key={member.id} className="hover:bg-blue-50/30 dark:hover:bg-zinc-900/50 transition-colors group">
                      
                      <TableCell 
                        className="font-bold text-slate-900 dark:text-white flex items-center gap-3 cursor-pointer group-hover:text-blue-600 transition-colors"
                        onClick={() => setSelectedStaff(member)}
                      >
                        <div className="relative size-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs border border-slate-200 overflow-hidden shrink-0">
                          {member.avatar_url ? (
                            <Image 
                              src={member.avatar_url} 
                              alt={member.full_name} 
                              fill 
                              sizes="36px"
                              className="object-cover" 
                            />
                          ) : (
                            getInitials(member.full_name)
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2">
                            {member.full_name}
                            {!member.is_active && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1 rounded-sm">Inativo</Badge>
                            )}
                          </span>
                          <span className="text-xs text-slate-400 font-normal group-hover:underline decoration-blue-200 underline-offset-2">
                            Ver detalhes
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <Badge variant="outline" className={`${roleMap[member.role].color} shadow-sm`}>
                          {member.role === 'owner' || member.role === 'manager' ? <ShieldCheck className="size-3 mr-1" /> : null}
                          {roleMap[member.role].label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                          {member.unique_code || '---'}
                        </span>
                      </TableCell>
                      
                      <TableCell className="text-slate-500 font-medium text-sm">
                        {member.payment_model === 'commission' ? 'Comissionado' : 'Taxa Fixa'}
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="focus-visible:ring-0 focus-visible:ring-offset-0">
                              <MoreHorizontal className="size-4 text-slate-400 hover:text-slate-900" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56 shadow-xl rounded-xl">
                            <DropdownMenuLabel className="text-xs text-slate-400">Ações do Perfil</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            {/* NOVA AÇÃO: VER PAINEL DO STAFF */}
                            <DropdownMenuItem 
                              onClick={() => router.push(`/equipe/staff?id=${member.id}`)}
                              className="cursor-pointer font-medium text-blue-600 dark:text-blue-400 focus:text-blue-700 dark:focus:text-blue-300 focus:bg-blue-50 dark:focus:bg-blue-900/30"
                            >
                              <LayoutDashboard className="mr-2 size-4" /> Ver Painel do Staff
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => {
                                setStaffToEditId(member.id);
                                setIsStaffFormOpen(true);
                              }} 
                              className="cursor-pointer"
                            >
                              <Pencil className="mr-2 size-4 text-slate-500" /> Editar Ficha
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem onClick={() => handleToggleStatus(member)} className="cursor-pointer">
                              {member.is_active ? (
                                <><UserX className="mr-2 size-4 text-amber-500" /> Suspender Acesso</>
                              ) : (
                                <><UserCheck className="mr-2 size-4 text-green-500" /> Reativar Acesso</>
                              )}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              onClick={() => setStaffToDelete(member.id)} 
                              className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/50 cursor-pointer"
                            >
                              <Trash2 className="mr-2 size-4" /> Excluir Registro
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* MODAL PREMIUM DE DETALHES RÁPIDOS */}
      <Dialog open={!!selectedStaff} onOpenChange={(open) => !open && setSelectedStaff(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl [&>button]:text-slate-300 [&>button:hover]:text-slate-900 [&>button:hover]:bg-slate-100 [&>button]:opacity-80 [&>button:hover]:opacity-100 [&>button]:p-1 [&>button]:rounded-full [&>button]:duration-15">
          {selectedStaff && (
            <>
              {/* CABEÇALHO REFINADO */}
              <div className="bg-slate-800 dark:bg-zinc-900 p-6 flex items-center gap-5 text-white relative border-b border-slate-700/50 dark:border-zinc-800">
                
                <div className="relative size-16 rounded-full bg-slate-700/50 dark:bg-zinc-800 border-2 border-slate-600/50 dark:border-zinc-700 flex items-center justify-center text-2xl font-black shadow-sm overflow-hidden shrink-0">
                  {selectedStaff.avatar_url ? (
                    <Image 
                      src={selectedStaff.avatar_url} 
                      alt={selectedStaff.full_name} 
                      fill 
                      sizes="64px"
                      className="object-cover" 
                    />
                  ) : (
                    getInitials(selectedStaff.full_name)
                  )}
                </div>

                <div>
                  <DialogTitle className="text-xl font-bold truncate text-white">
                    {selectedStaff.full_name}
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Detalhes do perfil, cargo e status do profissional {selectedStaff.full_name}.
                  </DialogDescription>
                  <span className="text-slate-300 font-medium text-sm flex items-center gap-2 opacity-90 mt-1.5">
                    ID do Sistema: <span className="font-mono bg-black/30 px-2 py-0.5 rounded text-xs border border-white/5">{selectedStaff.unique_code}</span>
                  </span>
                </div>
              </div>

              {/* CORPO DO MODAL */}
              <div className="p-6 space-y-6 bg-white dark:bg-zinc-950">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900">
                    <p className="text-[11px] text-slate-400/80 font-bold uppercase tracking-widest mb-1.5">Cargo</p>
                    <Badge variant="outline" className={`${roleMap[selectedStaff.role].color} shadow-none border-0`}>
                      {roleMap[selectedStaff.role].label}
                    </Badge>
                  </div>
                  
                  <div className="bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900">
                    <p className="text-[11px] text-slate-400/80 font-bold uppercase tracking-widest mb-1.5">Status</p>
                    {selectedStaff.is_active ? (
                      <span className="flex items-center text-sm font-bold text-green-600 dark:text-green-500">
                        <span className="size-2 rounded-full bg-green-500 mr-2 animate-pulse" /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center text-sm font-bold text-red-500">
                        <span className="size-2 rounded-full bg-red-500 mr-2" /> Inativo
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-50/50 dark:bg-zinc-900/50 p-4 rounded-xl border border-slate-200/60 dark:border-zinc-800/60 transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900 col-span-2">
                    <p className="text-[11px] text-slate-400/80 font-bold uppercase tracking-widest mb-1.5">Contrato Financeiro</p>
                    <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                      {selectedStaff.payment_model === 'commission' ? 'Modelo Comissionado' : 'Modelo de Taxa Fixa'}
                    </p>
                  </div>
                </div>

                {/* BOTÕES DE AÇÃO REFINADOS */}
                <div className="flex flex-col gap-2 pt-2">
                  <Button 
                    className="w-full font-bold h-12 text-md shadow-sm bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200 transition-all group cursor-pointer"
                    onClick={() => {
                      router.push(`/equipe/staff?id=${selectedStaff.id}`);
                      setSelectedStaff(null);
                    }}
                  >
                    <LayoutDashboard className="mr-2 size-4" />
                    Acessar Painel do Profissional
                    <ChevronRight className="size-5 ml-2 text-slate-400 group-hover:translate-x-1 group-hover:text-white dark:group-hover:text-zinc-900 transition-all" />
                  </Button>

                  <Button 
                    variant="outline"
                    className="w-full h-10 font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    onClick={() => {
                      setStaffToEditId(selectedStaff.id);
                      setIsStaffFormOpen(true);
                      setSelectedStaff(null);
                    }}
                  >
                    <Pencil className="mr-2 size-4" /> Editar Ficha Cadastral
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ALERT DIALOG DE EXCLUSÃO DE PROFISSIONAL */}
      <AlertDialog open={!!staffToDelete} onOpenChange={(open) => !open && setStaffToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Esta ação excluirá o registro deste profissional permanentemente. Isso não poderá ser desfeito.
              <br/><br/>
              <span className="font-semibold text-red-500/90 dark:text-red-400">Nota:</span> Verifique se não existem agendamentos atrelados a este profissional antes de prosseguir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }} 
              disabled={isDeleting} 
              className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2"/>
              )}
              Sim, Excluir Profissional
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG UNIFICADO PARA CRIAR/EDITAR PROFISSIONAL */}
      <StaffFormDialog 
        isOpen={isStaffFormOpen}
        onOpenChange={setIsStaffFormOpen}
        staffIdToEdit={staffToEditId}
        onSuccess={fetchStaff} 
      />

    </div>
  );
}
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, Loader2, ShieldCheck, MoreHorizontal, 
  Pencil, Trash2, Search, ArrowDownAZ, ArrowUpZA, UserX, UserCheck, ChevronRight,
  IdCard // <-- 1. Importamos o IdCard aqui
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";

import { CreateStaffDialog } from "@/components/create-staff-dialog";
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
  const supabase = createClient();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function fetchStaff() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("staff")
        .select("id, full_name, role, unique_code, payment_model, is_active, avatar_url");

      if (error) throw error;
      setStaff(data as StaffMember[] || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar a lista da equipe.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStaff();
  }, []);

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
      toast.error("Erro ao atualizar status.", { id: toastId });
    }
  }

  async function confirmDelete() {
    if (!staffToDelete) return;
    
    setIsDeleting(true);
    const toastId = toast.loading("Excluindo profissional...");
    
    try {
      const { error } = await supabase.from("staff").delete().eq("id", staffToDelete);
      if (error) throw error;
      toast.success("Profissional excluído com sucesso!", { id: toastId });
      fetchStaff();
    } catch (error) {
      toast.error("Erro ao excluir. Verifique se ele não possui agendamentos atrelados.", { id: toastId });
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
            {/* 2. Substituímos o Briefcase pelo IdCard aqui no cabeçalho */}
            <IdCard className="size-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Equipe</h2>
            <p className="text-sm text-slate-500 font-medium">
              Gestão de equipe, comissões e acessos.
            </p>
          </div>
        </div>
        
        <CreateStaffDialog onStaffCreated={fetchStaff} />
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
            <p className="font-medium">Carregando plantel...</p>
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
                  <TableHead className="w-[80px] text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedStaff.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-16 text-slate-500 font-medium">
                      Nenhum profissional encontrado na busca.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAndSortedStaff.map((member) => (
                    <TableRow key={member.id} className="hover:bg-blue-50/30 dark:hover:bg-zinc-900/50 transition-colors group">
                      
                      <TableCell 
                        className="font-bold text-slate-900 dark:text-white flex items-center gap-3 cursor-pointer group-hover:text-blue-600 transition-colors"
                        onClick={() => setSelectedStaff(member)}
                      >
                        <div className="size-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs border border-slate-200 overflow-hidden shrink-0">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
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
                          <DropdownMenuContent align="end" className="w-48 shadow-xl rounded-xl">
                            <DropdownMenuLabel className="text-xs text-slate-400">Ações do Perfil</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem onClick={() => router.push(`/equipe/${member.id}`)} className="cursor-pointer">
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
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 shadow-2xl rounded-2xl [&>button]:text-slate-300 hover:[&>button]:text-slate-900 hover:[&>button]:bg-slate-100 [&>button]:opacity-80 hover:[&>button]:opacity-100 [&>button]:p-1 [&>button]:rounded-full [&>button]:transition-colors">
          {selectedStaff && (
            <>
              {/* CABEÇALHO REFINADO: Slate Escuro Sóbrio e Corporativo */}
              <div className="bg-slate-800 dark:bg-zinc-900 p-6 flex items-center gap-5 text-white relative border-b border-slate-700/50 dark:border-zinc-800">
                
                <div className="size-16 rounded-full bg-slate-700/50 dark:bg-zinc-800 border-2 border-slate-600/50 dark:border-zinc-700 flex items-center justify-center text-2xl font-black shadow-sm overflow-hidden shrink-0">
                  {selectedStaff.avatar_url ? (
                    <img src={selectedStaff.avatar_url} alt={selectedStaff.full_name} className="w-full h-full object-cover" />
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

              {/* CORPO DO MODAL COM CARDS REFINADOS */}
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

                <Button 
                  className="w-full font-bold h-12 text-md shadow-sm bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-slate-200 transition-all group"
                  onClick={() => router.push(`/equipe/${selectedStaff.id}`)}
                >
                  Acessar Ficha Completa
                  <ChevronRight className="size-5 ml-2 text-slate-400 group-hover:translate-x-1 group-hover:text-white dark:group-hover:text-zinc-900 transition-all" />
                </Button>
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

    </div>
  );
}
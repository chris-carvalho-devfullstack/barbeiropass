"use client";

// 1. Blindagem da Cloudflare: Força a página a rodar no servidor Edge
export const runtime = "edge";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  MoreHorizontal,
  Scissors,
  Loader2,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

import { CreateServiceDialog } from "@/components/create-service-dialog";
import { UpdateServiceDialog } from "@/components/update-service-dialog";
import { ServiceDetailsDialog } from "@/components/service-details-dialog";

interface Servico {
  id: string;
  nome: string;
  categoria: string;
  preco: string;
  tempo: string;
  status: string;
  codigo?: string;
  fotos?: string[];
}

export default function ServicosPage() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceToEdit, setServiceToEdit] = useState<Servico | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Servico | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const [servicoSelecionado, setServicoSelecionado] = useState<Servico | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleOpenDetails = (servico: Servico) => {
    setServicoSelecionado(servico);
    setIsDetailsOpen(true);
  };

  async function fetchServicos() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("servicos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setServicos(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar serviços.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!serviceToDelete) return;
    const toastId = toast.loading("Excluindo...");

    const { error } = await supabase
      .from("servicos")
      .delete()
      .eq("id", serviceToDelete.id);

    if (error) {
      console.error(error);
      toast.error("Erro ao excluir.", { id: toastId });
    } else {
      toast.success("Serviço removido!", { id: toastId });
      fetchServicos();
    }
    setIsDeleteOpen(false);
  }

  useEffect(() => {
    fetchServicos();
  }, []);

  return (
    // 2. Adicionamos a animação suave de entrada do painel
    <div className="flex flex-col gap-6 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Suporte ao Dark Mode no ícone */}
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
            <Scissors className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Serviços</h2>
            <p className="text-sm text-zinc-500">
              Gerencie o cardápio da sua barbearia.
            </p>
          </div>
        </div>
        <CreateServiceDialog onServiceCreated={fetchServicos} />
      </div>

      {/* Suporte ao Dark Mode no fundo da Tabela */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-2">
            <Loader2 className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SERVIÇO</TableHead>
                <TableHead>CATEGORIA</TableHead>
                <TableHead className="hidden md:table-cell">TEMPO</TableHead>
                <TableHead>PREÇO</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {servicos.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <button
                      onClick={() => handleOpenDetails(s)}
                      className="text-left font-medium text-zinc-700 dark:text-zinc-200 hover:text-black dark:hover:text-white transition-all cursor-pointer"
                    >
                      {s.nome}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{s.categoria}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {s.tempo} min
                  </TableCell>
                  <TableCell>R$ {s.preco}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>

                        <DropdownMenuItem onClick={() => handleOpenDetails(s)}>
                          <Eye className="mr-2 size-4 text-zinc-500" /> Ver detalhes
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => {
                            setServiceToEdit(s);
                            setIsEditOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 size-4 text-zinc-500" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600 dark:text-red-400"
                          onClick={() => {
                            setServiceToDelete(s);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="mr-2 size-4" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <UpdateServiceDialog
        servico={serviceToEdit}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        onServiceUpdated={fetchServicos}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço{" "}
              <b>{serviceToDelete?.nome}</b> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ServiceDetailsDialog
        servico={servicoSelecionado}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </div>
  );
}
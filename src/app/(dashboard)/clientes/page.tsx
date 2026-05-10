"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, MessageCircle } from "lucide-react";
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
import { CreateClientDialog } from "@/components/create-client-dialog";

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  frequencia: string;
  created_at: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchClientes() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClientes();
  }, []);

  // Formata a data para o padrão brasileiro
  const formatarData = (dataIso: string) => {
    return new Date(dataIso).toLocaleDateString("pt-BR");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-100 rounded-lg">
            <Users className="size-5 text-zinc-700" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Clientes</h2>
            <p className="text-sm text-zinc-500">
              Gerencie sua base de clientes e histórico.
            </p>
          </div>
        </div>
        <CreateClientDialog onClientCreated={fetchClientes} />
      </div>

      {/* Tabela */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-2">
            <Loader2 className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">
                  Cliente desde
                </TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-10 text-zinc-500"
                  >
                    Nenhum cliente cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                clientes.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-zinc-600">
                      {c.telefone}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 hover:bg-blue-50"
                      >
                        {c.frequencia}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-zinc-500">
                      {formatarData(c.created_at)}
                    </TableCell>
                    <TableCell>
                      {/* Botão de ação rápida: Abrir WhatsApp */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        onClick={() =>
                          window.open(
                            `https://wa.me/55${c.telefone.replace(/\D/g, "")}`,
                            "_blank",
                          )
                        }
                      >
                        <MessageCircle className="size-4 mr-2" />
                        Chamar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

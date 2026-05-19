// src/app/(dashboard)/clientes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Users, Loader2, MessageCircle, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client"; // Mudamos para o client oficial do seu app
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

// 1. Atualizamos a Interface para espelhar EXATAMENTE o banco de dados
interface Cliente {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
  created_at: string;
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function fetchClientes() {
    try {
      setLoading(true);
      // RLS (Row Level Security) já protege para trazer apenas os clientes desta barbearia
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar a lista de clientes.");
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
    <div className="flex flex-col gap-6 p-2 md:p-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <Users className="size-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-900">Clientes</h2>
            <p className="text-sm text-slate-500 font-medium">
              Gerencie sua base de clientes locais e histórico.
            </p>
          </div>
        </div>
        <CreateClientDialog onClientCreated={fetchClientes} />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
            <Loader2 className="size-8 animate-spin text-blue-500" />
            <p className="font-medium">Carregando carteira de clientes...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">Nome</TableHead>
                  <TableHead className="font-bold text-slate-700">WhatsApp</TableHead>
                  <TableHead className="font-bold text-slate-700">Documento (CPF)</TableHead>
                  <TableHead className="hidden md:table-cell font-bold text-slate-700">
                    Cliente desde
                  </TableHead>
                  <TableHead className="w-[120px] text-right font-bold text-slate-700">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-16 text-slate-500 font-medium"
                    >
                      Nenhum cliente cadastrado no balcão ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  clientes.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50 transition-colors">
                      {/* Nome do Cliente */}
                      <TableCell className="font-bold text-slate-900">
                        {c.name}
                      </TableCell>
                      
                      {/* Telefone */}
                      <TableCell className="text-slate-600 font-medium">
                        {c.phone || <span className="text-slate-400 italic">Não informado</span>}
                      </TableCell>
                      
                      {/* CPF no lugar do Status antigo */}
                      <TableCell>
                        {c.document ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-mono">
                            <FileText className="size-3 mr-1" />
                            {c.document}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Sem registro</span>
                        )}
                      </TableCell>
                      
                      {/* Data de Registro */}
                      <TableCell className="hidden md:table-cell text-slate-500 text-sm font-medium">
                        {formatarData(c.created_at)}
                      </TableCell>
                      
                      {/* Botão do WhatsApp blindado contra ausência de telefone */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 font-bold"
                          disabled={!c.phone}
                          onClick={() => {
                            if (c.phone) {
                              window.open(
                                `https://wa.me/55${c.phone.replace(/\D/g, "")}`,
                                "_blank"
                              );
                            }
                          }}
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
          </div>
        )}
      </div>
    </div>
  );
}
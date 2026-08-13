// src/app/(dashboard)/clientes/client-manager.tsx
"use client";

import { useState } from "react";
import { Search, Phone, Mail, Calendar, Star } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface Cliente {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  total_visits?: number;
}

export default function ClientManager({ initialClients }: { initialClients: Cliente[] }) {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const filteredClients = initialClients.filter(c => {
    const search = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(search) ||
      (c.phone && c.phone.includes(search)) ||
      (c.email && c.email.toLowerCase().includes(search))
    );
  });

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER & CONTROLES */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-5" />
          <Input 
            placeholder="Buscar por nome, telefone ou e-mail..." 
            className="pl-10 h-12 bg-slate-50 border-transparent focus:bg-white transition-all rounded-xl text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button className="h-12 px-6 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg">
            + Novo Cliente
          </Button>
        </div>
      </div>

      {/* GRID RICA DE CLIENTES (AGORA SÃO BOTÕES DE NAVEGAÇÃO PARA A PÁGINA) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredClients.map((client) => {
          const isVip = (client.total_visits || 0) > 5;
          const isNew = new Date(client.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

          return (
            <div 
              key={client.id} 
              onClick={() => router.push(`/clientes/${client.id}`)}
              className="group bg-white border border-slate-100 hover:border-blue-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:shadow-blue-50/50 transition-all cursor-pointer relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14 border-2 border-slate-50 shadow-sm group-hover:ring-4 ring-blue-50 transition-all">
                    <AvatarFallback className="bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 font-bold text-lg">
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-black text-slate-900 text-lg group-hover:text-blue-600 transition-colors line-clamp-1">
                      {client.name}
                    </h3>
                    <p className="text-sm font-medium text-slate-400 flex items-center gap-1">
                      <Calendar className="size-3" />
                      Desde {format(new Date(client.created_at), "MMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                {isVip ? (
                  <Badge className="bg-amber-100 text-amber-700 border-none font-bold px-3 py-1">
                    <Star className="size-3 mr-1 fill-amber-500" /> VIP
                  </Badge>
                ) : isNew ? (
                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold px-3 py-1">
                    Novo
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-2 mt-6 bg-slate-50 rounded-2xl p-4 border border-slate-100/50">
                {client.phone && (
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm"><Phone className="size-3.5 text-blue-500" /></div>
                    {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm"><Mail className="size-3.5 text-slate-400" /></div>
                    <span className="truncate">{client.email}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
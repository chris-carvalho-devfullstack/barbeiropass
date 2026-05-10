"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link"; // <-- Importamos o Link do Next.js
import { type User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, LogOut, MonitorSmartphone, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function UserNav() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Busca os dados do usuário autenticado
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
      setLoading(false);
    });
  }, []);

  // Função de Logout com Redirecionamento
  async function handleLogout() {
    const toastId = toast.loading("Saindo...");
    await supabase.auth.signOut();
    toast.success("Sessão encerrada com sucesso!", { id: toastId });
    window.location.href = "/login";
  }

  // Fallbacks de exibição para evitar erros caso os dados não carreguem a tempo
  const email = user?.email || "carregando...";
  const nome =
    user?.user_metadata?.nome_barbearia ||
    user?.user_metadata?.name ||
    "Administrador";
  const iniciais = nome.substring(0, 2).toUpperCase();
  const userId = user?.id?.split("-")[0].toUpperCase() || "------";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Adicionado p-0 e overflow-hidden para a imagem preencher 100% sem bordas internas */}
        <Button
          variant="ghost"
          className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-zinc-200"
        >
          {loading ? (
            <div className="flex h-full w-full items-center justify-center bg-zinc-100">
              <Loader2 className="size-4 animate-spin text-zinc-400" />
            </div>
          ) : user?.user_metadata?.avatar_url ? (
            <Image
              src={user.user_metadata.avatar_url}
              alt="Avatar do Usuário"
              fill
              sizes="40px"
              priority
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-white font-bold text-sm hover:opacity-90 transition-all">
              {iniciais}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 p-0 overflow-hidden rounded-xl border-zinc-200"
        align="end"
        forceMount
      >
        <div className="flex items-center gap-3 bg-zinc-900 p-4 text-white">
          {/* Contêiner relative criado especialmente para a foto maior preencher perfeitamente */}
          {user?.user_metadata?.avatar_url ? (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-zinc-700">
              <Image
                src={user.user_metadata.avatar_url}
                alt="Avatar do Usuário"
                fill
                sizes="48px"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white font-bold text-lg border-2 border-zinc-700">
              {iniciais}
            </div>
          )}
          <div className="flex flex-col space-y-0.5 overflow-hidden">
            <p className="text-sm font-bold leading-none truncate">{nome}</p>
            <p className="text-xs text-zinc-400 font-medium leading-none truncate">
              {email}
            </p>
            <p className="text-[10px] text-zinc-500 font-mono mt-1">
              ID: {userId}
            </p>
          </div>
        </div>

        <DropdownMenuSeparator className="m-0" />

        <DropdownMenuGroup className="p-2">
          {/* Transformado em Link utilizando asChild */}
          <DropdownMenuItem
            asChild
            className="cursor-pointer py-2.5 rounded-lg focus:bg-zinc-100"
          >
            <Link href="/perfil">
              <User className="mr-2 h-4 w-4 text-zinc-600" />
              <span className="font-medium text-zinc-700">Meu perfil</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer py-2.5 rounded-lg focus:bg-zinc-100">
            <MonitorSmartphone className="mr-2 h-4 w-4 text-zinc-600" />
            <span className="font-medium text-zinc-700">
              Meus dispositivos conectados
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="m-0" />

        <div className="p-2">
          <DropdownMenuItem
            className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 py-2.5 rounded-lg font-medium"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>Desconectar</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

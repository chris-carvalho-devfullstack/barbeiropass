"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { User, LogOut, MonitorSmartphone, Loader2, Settings, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";

// Função utilitária para pegar apenas primeiro e último nome
function getFirstAndLastName(fullName: string): string {
  if (!fullName) return "";
  const names = fullName.trim().split(/\s+/);
  if (names.length > 1) {
    return `${names[0]} ${names[names.length - 1]}`;
  }
  return names[0];
}

export function UserNav() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // <-- NOVO: Controle de hidratação

  useEffect(() => {
    setIsMounted(true); // Indica que o componente já rodou no cliente
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
      setLoading(false);
    });
  }, [supabase.auth]);

  async function handleLogout() {
    setIsLoggingOut(true);
    const toastId = toast.loading("Encerrando sessão...");
    
    try {
      await supabase.auth.signOut();
      toast.success("Sessão encerrada com segurança!", { id: toastId });
      router.push("/login");
    } catch (error) {
      toast.error("Erro ao tentar sair.", { id: toastId });
      setIsLoggingOut(false);
    }
  }

  // Se não estiver montado, renderiza o botão neutro idêntico ao servidor para evitar Hydration Error
  if (!isMounted) {
    return (
      <Button
        variant="ghost"
        disabled // Servidor e estado inicial assumem disabled true/loading
        className="flex items-center gap-3 h-auto px-1.5 py-1.5 rounded-full hover:bg-zinc-100 transition-all focus-visible:ring-zinc-950"
      >
        <div className="relative h-9 w-9 shrink-0 rounded-full ring-1 ring-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center">
          <Loader2 className="size-4 animate-spin text-zinc-400" />
        </div>
      </Button>
    );
  }

  /// Extração de dados cobrindo todas as chaves possíveis do seu formulário e do Google
  const email = user?.email || "";
  const nomeCompleto =
    user?.user_metadata?.fullName ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.nome_barbearia ||
    "Administrador";
    
  const displayNameHeader = getFirstAndLastName(nomeCompleto);
  const userId = user?.id?.split("-")[0].toUpperCase() || "------";
  const userRole = user?.user_metadata?.role || "owner";

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case "owner": return { label: "Proprietário", color: "bg-zinc-950 text-white" };
      case "manager": return { label: "Gerente", color: "bg-zinc-700 text-white" };
      case "barber": return { label: "Barbeiro", color: "bg-zinc-100 text-zinc-800 border" };
      case "attendant": return { label: "Atendente", color: "bg-zinc-50 text-zinc-600 border" };
      default: return { label: role, color: "bg-zinc-100 text-zinc-600" };
    }
  };

  const roleDisplay = getRoleDisplay(userRole);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={loading}
          className="flex items-center gap-3 h-auto px-1.5 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer focus-visible:ring-zinc-950 dark:focus-visible:ring-zinc-300"
        >
          <div className="relative h-9 w-9 shrink-0 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-900 overflow-hidden flex items-center justify-center">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-zinc-400" />
            ) : user?.user_metadata?.avatar_url ? (
              <Image
                src={user.user_metadata.avatar_url}
                alt={displayNameHeader}
                fill
                sizes="36px"
                priority
                className="object-cover"
              />
            ) : (
              <User className="size-5 text-zinc-500 dark:text-zinc-400" />
            )}
          </div>

          {!loading && (
            <div className="hidden sm:flex flex-col items-start leading-tight pr-1">
              <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                {displayNameHeader}
              </span>
              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                {roleDisplay.label}
              </span>
            </div>
          )}
          
          <ChevronsUpDown className="size-4 text-zinc-400 dark:text-zinc-600 ml-1 hidden sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-1.5"
        align="end"
        forceMount
      >
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-bold leading-none text-zinc-950 dark:text-zinc-50 truncate">
              {nomeCompleto}
            </p>
            {email && (
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 truncate pt-1">
                {email}
              </p>
            )}
            
            <div className="mt-3 flex items-center gap-2 pt-1.5">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm ${roleDisplay.color}`}>
                {roleDisplay.label}
              </span>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono font-medium">
                ID: {userId}
              </span>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

        <DropdownMenuGroup className="p-1">
          <DropdownMenuItem asChild className="cursor-pointer gap-2.5 rounded-lg py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 focus:bg-zinc-50 dark:focus:bg-zinc-800">
            <Link href="/perfil">
              <User className="size-4" />
              Meu perfil
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuItem asChild className="cursor-pointer gap-2.5 rounded-lg py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 focus:bg-zinc-50 dark:focus:bg-zinc-800">
            <Link href="/perfil/configuracoes">
              <Settings className="size-4" />
              Configurações
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem className="cursor-pointer gap-2.5 rounded-lg py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-zinc-50 focus:bg-zinc-50 dark:focus:bg-zinc-800">
            <MonitorSmartphone className="size-4" />
            Acessos e Dispositivos
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-800" />

        <div className="p-1">
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isLoggingOut || loading}
            className="cursor-pointer gap-2.5 rounded-lg py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700 dark:hover:text-red-400 focus:bg-red-50 dark:focus:bg-red-950 focus:text-red-700 dark:focus:text-red-400 transition-colors"
          >
            {isLoggingOut ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogOut className="size-4" />
            )}
            {isLoggingOut ? "Saindo..." : "Desconectar"}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
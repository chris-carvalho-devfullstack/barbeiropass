"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scissors,
  Users,
  DollarSign,
  LayoutDashboard,
  Package,
  Calendar,
  ListOrdered, 
  Calculator,
  IdCard,
  User,
  Clock,
  Trophy,
  MapPin,
  Palette,
  CalendarClock,
  Building2
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// 1. Grupo de Gestão Principal (Operação Diária)
const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "PDV", url: "/pdv", icon: Calculator },
  { title: "Fila Virtual", url: "/fila", icon: ListOrdered },
  { title: "Agenda", url: "/agendamentos", icon: Calendar },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Produtos", url: "/produtos", icon: Package },
  { title: "Clientes (CRM)", url: "/clientes", icon: Users },
  { title: "Equipe", url: "/equipe", icon: IdCard },
  { title: "Fluxo de Caixa", url: "#", icon: DollarSign },
];

// 2. Grupo de Configurações da Barbearia (Global - RBAC)
const configItems = [
  { title: "Dados Gerais", url: "/configuracoes", icon: Building2 },
  { title: "Expediente da Loja", url: "/configuracoes/horarios", icon: Clock },
  { title: "Endereço", url: "/configuracoes/endereco", icon: MapPin },
  { title: "Aparência", url: "/configuracoes/aparencia", icon: Palette },
];

// 3. Grupo do Profissional (Individual)
const profileItems = [
  { title: "Meus Dados", url: "/perfil", icon: User },
  { title: "Meus Horários", url: "/perfil/horarios", icon: CalendarClock },
  { title: "Conquistas", url: "/perfil/conquistas", icon: Trophy },
];

export function AppSidebar() {
  const [mounted, setMounted] = React.useState(false);
  
  const { state, isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <Sidebar collapsible="icon" />;

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader 
        className={`flex h-16 items-center border-b transition-all ${
          state === "expanded" ? "px-4" : "justify-center px-0"
        }`}
      >
        {state === "expanded" ? (
          <span className="font-bold text-lg tracking-tight whitespace-nowrap">
            Barbeiro<span className="text-zinc-500">Pass</span>
          </span>
        ) : (
          <Scissors className="size-6 shrink-0" />
        )}
      </SidebarHeader>

      <TooltipProvider delayDuration={0}>
        <SidebarContent className="gap-0">
          
          {/* SEÇÃO 1: OPERACIONAL */}
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {mainItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url} onClick={handleLinkClick}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* SEÇÃO 2: PROFISSIONAL / USUÁRIO */}
          <SidebarGroup>
            <SidebarGroupLabel>Meu Perfil</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {profileItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url} onClick={handleLinkClick}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* SEÇÃO 3: ADMINISTRAÇÃO DA BARBEARIA */}
          <SidebarGroup>
            <SidebarGroupLabel>Barbearia</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {configItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link href={item.url} onClick={handleLinkClick}>
                        <item.icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

        </SidebarContent>
      </TooltipProvider>
      <SidebarRail />
    </Sidebar>
  );
}
"use client";

import * as React from "react";
import Link from "next/link";
import {
  Scissors,
  Users,
  DollarSign,
  LayoutDashboard,
  Settings,
  Package,
  Calendar,
  ListOrdered, 
  Calculator,
  IdCard,
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

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "PDV", url: "/pdv", icon: Calculator },
  { title: "Fila Virtual", url: "/fila", icon: ListOrdered },
  { title: "Agenda", url: "/agendamentos", icon: Calendar },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Produtos", url: "#", icon: Package },
  { title: "Clientes (CRM)", url: "/clientes", icon: Users },
  { title: "Equipe", url: "/equipe", icon: IdCard },
  { title: "Fluxo de Caixa", url: "#", icon: DollarSign },
  { title: "Configurações", url: "#", icon: Settings },
];

export function AppSidebar() {
  const [mounted, setMounted] = React.useState(false);
  
  // 1. Extraímos isMobile e setOpenMobile do hook useSidebar
  const { state, isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <Sidebar collapsible="icon" />;

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
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Gestão Principal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <Link 
                        href={item.url}
                        // 2. Adicionamos o evento onClick para fechar o menu apenas no mobile
                        onClick={() => {
                          if (isMobile) {
                            setOpenMobile(false);
                          }
                        }}
                      >
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
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
  useSidebar, // 1. Adicionamos a importação do hook useSidebar
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const items = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Agenda", url: "/agendamentos", icon: Calendar },
  { title: "Serviços", url: "/servicos", icon: Scissors },
  { title: "Produtos", url: "#", icon: Package },
  { title: "Clientes (CRM)", url: "/clientes", icon: Users },
  { title: "Fluxo de Caixa", url: "#", icon: DollarSign },
  { title: "Configurações", url: "#", icon: Settings },
];

export function AppSidebar() {
  const [mounted, setMounted] = React.useState(false);
  
  // 2. Extraímos o estado (state) atual do menu lateral
  const { state } = useSidebar();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <Sidebar collapsible="icon" />;

  return (
    <Sidebar collapsible="icon">
      {/* 3. Ajustamos as classes baseadas no estado e fazemos a renderização condicional */}
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
          <Scissors className="size-6 shrink-0" /> // O Ícone substituto (futura logo)
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
                      <Link href={item.url}>
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
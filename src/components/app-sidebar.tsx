"use client";

import * as React from "react";
import Link from "next/link"; // Adicionamos a importação do Link
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
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// Ajustei a rota do Dashboard para "/dashboard"
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

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <Sidebar collapsible="icon" />;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b h-14 flex items-center px-4">
        <span className="font-bold text-lg tracking-tight">
          Barber<span className="text-zinc-500">Flow</span>
        </span>
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
                      {/* Trocamos o <a> pelo <Link> do Next.js */}
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
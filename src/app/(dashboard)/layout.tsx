// src/app/(dashboard)/layout.tsx
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { UserNav } from "@/components/user-nav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      {/* Estrutura de "App Shell":
        1. Flex h-screen: A tela ocupa 100% da altura da janela.
        2. overflow-hidden: Impede que a página inteira tenha scroll. 
           O scroll acontecerá apenas dentro do container de conteúdo.
      */}
      <div className="flex h-screen w-full bg-slate-50 dark:bg-zinc-950 overflow-hidden">
        
        {/* A Barra Lateral é gerenciada pelo SidebarProvider */}
        <AppSidebar />
        
        {/* Container Principal */}
        <div className="flex flex-1 flex-col h-full overflow-hidden">
          
          {/* HEADER FIXO (Sticky) 
             z-40: Garante que ele fique acima dos cards ou menus da página.
             backdrop-blur-md: O efeito "premium" de vidro fosco.
          */}
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-4 border-b border-slate-200 dark:border-zinc-800 px-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md shadow-sm">
            <SidebarTrigger className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors" />
            
            <div className="flex-1" />
            
            <UserNav />
          </header>
          
          {/* CONTEÚDO (Scroll Interno)
             flex-1: Ocupa todo o resto da tela.
             overflow-y-auto: Cria o scroll apenas aqui dentro.
          */}
          <main className="flex-1 overflow-y-auto custom-scrollbar">
            {children}
          </main>
          
        </div>
      </div>
    </SidebarProvider>
  );
}
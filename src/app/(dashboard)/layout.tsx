import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
        {/* A Barra Lateral do Shadcn */}
        <AppSidebar />
        
        {/* O Conteúdo Principal */}
        <main className="flex-1 flex flex-col w-full overflow-hidden">
          {/* CORREÇÃO AQUI: 
            Trocamos 'px-6' por 'pr-6 pl-4' (ou 'pl-3') para encostar o botão 
            mais na borda e alinhar perfeitamente com a linha do menu.
          */}
          <header className="flex h-16 shrink-0 items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pr-6 pl-4 bg-white dark:bg-zinc-900 sticky top-0 z-10">
            <SidebarTrigger className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50" />
            <div className="flex-1" />
            {/* Aqui depois podemos colocar o UserNav (Foto do perfil) */}
          </header>
          
          {/* A Página em si vai renderizar aqui dentro */}
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
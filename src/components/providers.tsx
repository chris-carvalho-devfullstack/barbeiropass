"use client";

import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Impede que os provedores de cliente rodem no servidor (SSR)
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {/* Removemos o SidebarProvider daqui. Deixamos apenas o children livre */}
      {children}
      
      <Toaster position="top-right" richColors />
    </NextThemesProvider>
  );
}
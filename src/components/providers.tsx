// src/components/providers.tsx
"use client";

import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light" // <-- Alterado de system para light
      forcedTheme="light"  // <-- Força o tema light em toda a aplicação
      disableTransitionOnChange
    >
      {children}
      <Toaster position="top-right" richColors theme="light" /> {/* Força o toaster no light */}
    </NextThemesProvider>
  );
}
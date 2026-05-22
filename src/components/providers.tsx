"use client";

import * as React from "react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
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
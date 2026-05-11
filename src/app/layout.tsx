import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// 1. Importamos os Provedores que contém o Toaster e o Dark Mode
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BarberPass",
  description: "Painel de gestão de Barbearias",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // 2. Trocamos para pt-BR e adicionamos suppressHydrationWarning para o Dark Mode
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 3. Envolvemos toda a aplicação nos Provedores */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
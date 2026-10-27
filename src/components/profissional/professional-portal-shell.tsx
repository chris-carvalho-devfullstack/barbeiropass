"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Clock3, LayoutDashboard } from "lucide-react";
import type { ReactNode } from "react";

interface ProfessionalPortalShellProps {
  children: ReactNode;
  fullName: string;
  barbershopName: string;
  barbershopSlug: string | null;
  avatarUrl: string | null;
}

const navigationItems = [
  {
    href: "/profissional",
    label: "Visão geral",
    shortLabel: "Início",
    icon: LayoutDashboard,
  },
  {
    href: "/profissional/agendamentos",
    label: "Minha agenda",
    shortLabel: "Agenda",
    icon: CalendarDays,
  },
  {
    href: "/profissional/fila",
    label: "Fila de atendimento",
    shortLabel: "Fila",
    icon: ClipboardList,
  },
  {
    href: "/profissional/horarios",
    label: "Meus horários",
    shortLabel: "Horários",
    icon: Clock3,
  },
] as const;

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "P";
}

function isActivePath(pathname: string, href: string): boolean {
  return href === "/profissional"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function ProfessionalPortalShell({
  children,
  fullName,
  barbershopName,
  barbershopSlug,
  avatarUrl,
}: ProfessionalPortalShellProps) {
  const pathname = usePathname();
  const professionalInitials = initials(fullName);

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-[#fdfdfc]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/profissional" className="flex min-w-0 items-center gap-3" aria-label="BarbeiroPass, início profissional">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-xs font-semibold tracking-tight text-white">
              BP
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold tracking-[-0.03em]">BarbeiroPass</span>
              <span className="hidden truncate text-[11px] text-zinc-500 sm:block">Área profissional</span>
            </span>
          </Link>

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="max-w-64 truncate text-sm font-medium">{barbershopName}</p>
              <p className="text-[11px] text-zinc-500">Seu espaço de trabalho</p>
            </div>
            {barbershopSlug ? (
              <Link
                href={`/b/${barbershopSlug}`}
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-md border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-white md:inline-flex"
              >
                Ver página pública
              </Link>
            ) : null}
            <div className="flex items-center gap-2 border-l border-zinc-200 pl-3 sm:pl-4">
              {avatarUrl ? (
                // A URL vem do registro staff consultado no servidor.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-9 rounded-full border border-zinc-200 object-cover" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-xs font-semibold text-zinc-700">
                  {professionalInitials}
                </span>
              )}
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-40 truncate text-sm font-medium">{fullName}</p>
                <p className="text-[11px] text-zinc-500">Profissional</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-68px)] max-w-[1600px]">
        <aside className="sticky top-[68px] hidden h-[calc(100vh-68px)] w-60 shrink-0 flex-col border-r border-zinc-200/80 bg-[#fdfdfc] px-4 py-7 md:flex">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
            Espaço de trabalho
          </p>
          <nav aria-label="Navegação profissional" className="space-y-1">
            {navigationItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                    active
                      ? "bg-zinc-950 font-medium text-white"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
                  }`}
                >
                  <Icon size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto border-t border-zinc-200 pt-5">
            <p className="px-3 text-xs leading-5 text-zinc-500">
              Acesso individual aos seus atendimentos e horários.
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 md:pb-10 lg:px-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Navegação principal móvel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-[#fdfdfc]/96 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1">
          {navigationItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] transition-colors ${
                  active ? "font-semibold text-zinc-950" : "text-zinc-500"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.1 : 1.7} />
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

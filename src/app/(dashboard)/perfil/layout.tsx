// src/app/(dashboard)/perfil/layout.tsx
export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function PerfilLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
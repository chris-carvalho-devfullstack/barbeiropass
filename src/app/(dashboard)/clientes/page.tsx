// src/app/(dashboard)/clientes/page.tsx
import { getClientes } from "./actions";
import ClientManager from "./client-manager";

export const metadata = {
  title: "CRM | BarbeiroPass",
  description: "Gestão inteligente de clientes",
};

export default async function ClientesPage() {
  // Busca os clientes direto no servidor (Server Component = Performance Máxima)
  const clientes = await getClientes();

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 max-w-7xl mx-auto w-full">
      <div className="space-y-1">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Gestão de Clientes
        </h1>
        <p className="text-sm font-medium text-slate-500">
          Acompanhe o histórico, métricas e o relacionamento com o seu público.
        </p>
      </div>

      {/* Injeta os dados iniciais no Client Component rico */}
      <ClientManager initialClients={clientes} />
    </div>
  );
}
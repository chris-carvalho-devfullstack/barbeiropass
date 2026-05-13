"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Scissors, Loader2 } from "lucide-react";
import { maskCpfCnpj, isValidCPF, isValidCNPJ } from "@/utils/validations";
import { registerBarbershop } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const formSchema = z.object({
  name: z.string().min(3, "O nome precisa ter pelo menos 3 caracteres"),
  document: z.string().refine((val) => {
    const clean = val.replace(/\D/g, "");
    if (clean.length === 11) return isValidCPF(clean);
    if (clean.length === 14) return isValidCNPJ(clean);
    return false;
  }, "CPF ou CNPJ inválido"),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastroBarbeariaPage() {
  const router = useRouter();
  
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      const response = await registerBarbershop(data);
      
      if (response?.error) {
        toast.error(`Erro: ${response.error}`); 
        return;
      }

      toast.success("Barbearia registrada com sucesso!");
      router.push("/dashboard"); // Tudo pronto, vai para o app!
      
    } catch (error) {
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 text-center">
        <div className="flex justify-center text-zinc-900 mb-4">
          <div className="p-3 bg-zinc-900 text-white rounded-2xl shadow-lg">
            <Scissors size={32} strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-zinc-900">Detalhes do Negócio</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Etapa 2 de 2: Agora, registre as informações da sua barbearia.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700">Nome da Barbearia</label>
              <input {...register("name")} id="name" type="text" placeholder="Barbearia do Zé" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="document" className="block text-sm font-medium text-zinc-700">CNPJ ou CPF (Responsável)</label>
              <input {...register("document")} id="document" type="tel" placeholder="00.000.000/0001-00" onChange={(e) => setValue("document", maskCpfCnpj(e.target.value), { shouldValidate: true })} className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.document && <p className="mt-1 text-xs text-red-500">{errors.document.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-70">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Finalizar Cadastro"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Loader2 } from "lucide-react";
import { maskPhone } from "@/utils/validations";
import { registerProfile } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner"; // Usando o sonner que vi no seu page.tsx antigo

const formSchema = z.object({
  fullName: z.string().min(3, "O nome precisa ter pelo menos 3 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(14, "Telefone incompleto"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastroPage() {
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
      const response = await registerProfile(data);
      
      if (response?.error) {
        toast.error(`Erro: ${response.error}`); 
        return;
      }

      toast.success("Conta criada! Vamos registrar sua barbearia.");
      // Redireciona para a etapa 2
      router.push("/cadastro/barbearia");
      
    } catch (error) {
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 text-center">
        <div className="flex justify-center text-zinc-900 mb-4">
          <div className="p-3 bg-zinc-200 rounded-full">
            <User size={32} strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-zinc-900">Seus Dados Pessoais</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Etapa 1 de 2: Primeiro, crie seu perfil de gestor.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">Nome Completo</label>
              <input {...register("fullName")} id="fullName" type="text" placeholder="José da Silva" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">E-mail</label>
              <input {...register("email")} id="email" type="email" placeholder="seu@email.com" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">Celular / WhatsApp</label>
              <input {...register("phone")} id="phone" type="tel" placeholder="(00) 0 0000-0000" onChange={(e) => setValue("phone", maskPhone(e.target.value), { shouldValidate: true })} className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Senha</label>
              <input {...register("password")} id="password" type="password" placeholder="••••••••" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-70">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Continuar"}
            </button>
          </form>
          
          <p className="mt-6 text-center text-sm text-zinc-600">
            Já tem uma conta? <Link href="/login" className="font-bold text-zinc-900 hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
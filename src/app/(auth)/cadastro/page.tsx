"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { User, Loader2 } from "lucide-react";
import { maskPhone } from "@/utils/validations";
import { registerProfile } from "./actions";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

const formSchema = z.object({
  fullName: z.string().min(3, "O nome precisa ter pelo menos 3 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(14, "Telefone incompleto"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type FormData = z.infer<typeof formSchema>;

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Ícone Oficial do Google
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function CadastroPage() {
  const router = useRouter();
  const supabase = createClient();
  const [googleLoading, setGoogleLoading] = useState(false);
  
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

  // Login/Cadastro com Google
  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // Deixa o callback padrão decidir o destino com base no banco de dados
          redirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) throw error;
    } catch {
      toast.error("Erro ao conectar com Google");
      setGoogleLoading(false);
    }
  }

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

            <button type="submit" disabled={isSubmitting || googleLoading} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-70 transition-all">
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Continuar"}
            </button>
          </form>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-zinc-400 font-bold tracking-wider">
                Ou cadastre-se com
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || googleLoading}
            className="w-full h-11 gap-3 border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold transition-all cursor-pointer shadow-sm rounded-lg"
          >
            {googleLoading ? (
              <Loader2 className="animate-spin size-5" />
            ) : (
              <GoogleIcon />
            )}
            Criar conta com o Google
          </Button>

          <p className="mt-6 text-center text-sm text-zinc-600">
            Já tem uma conta? <Link href="/login" className="font-bold text-zinc-900 hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Scissors, Loader2 } from "lucide-react";
import Link from "next/link";
// import { loginBarbershopUser } from "./actions"; // Descomentaremos depois

const formSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    console.log("Dados de login:", data);
    // Aqui conectaremos com o Supabase para fazer o login real
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex justify-center text-indigo-600">
          <Scissors size={48} strokeWidth={1.5} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-900">
          Acesse sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          Ou{" "}
          <Link href="/cadastro" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            cadastre sua barbearia aqui
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            {/* E-mail */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
                E-mail
              </label>
              <div className="mt-1">
                <input
                  {...register("email")}
                  id="email"
                  type="email"
                  inputMode="email"
                  placeholder="contato@barbearia.com"
                  className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Senha
              </label>
              <div className="mt-1">
                <input
                  {...register("password")}
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
              </div>
            </div>

            {/* Botão de Submit */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  "Entrar no sistema"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
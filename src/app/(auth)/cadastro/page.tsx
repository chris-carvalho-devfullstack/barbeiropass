"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Scissors, Loader2 } from "lucide-react";
import { maskPhone, maskCpfCnpj, isValidCPF, isValidCNPJ } from "@/utils/validations";
import { registerBarbershopOwner } from "./actions";
import { useRouter } from "next/navigation";

// Schema de Validação
const formSchema = z.object({
  fullName: z.string().min(3, "O nome precisa ter pelo menos 3 caracteres"),
  email: z.string().email("Digite um e-mail válido"),
  phone: z.string().min(14, "Telefone incompleto"),
  document: z.string().refine((val) => {
    const clean = val.replace(/\D/g, "");
    if (clean.length === 11) return isValidCPF(clean);
    if (clean.length === 14) return isValidCNPJ(clean);
    return false;
  }, "CPF ou CNPJ inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

type FormData = z.infer<typeof formSchema>;

export default function CadastroPage() {
  const router = useRouter(); // <-- Inicializando o roteador aqui
  
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
      // Chamando a Server Action importada
      const response = await registerBarbershopOwner(data);
      
      if (response?.error) {
        alert(`Erro: ${response.error}`); 
        return;
      }

      // Redirecionando com o useRouter importado
      router.push("/dashboard");
      
    } catch (error) {
      console.error("Falha no cadastro:", error);
      alert("Ocorreu um erro inesperado. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="flex justify-center text-indigo-600">
          <Scissors size={48} strokeWidth={1.5} />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-zinc-900">
          Crie sua conta Barbeiropass
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600">
          O sistema definitivo para sua barbearia.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-zinc-100">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            
            {/* Nome Completo */}
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-zinc-700">
                Nome ou Razão Social
              </label>
              <div className="mt-1">
                <input
                  {...register("fullName")}
                  id="fullName"
                  type="text"
                  placeholder="Barbearia do Zé / José da Silva"
                  className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                {errors.fullName && <p className="mt-1 text-xs text-red-500">{errors.fullName.message}</p>}
              </div>
            </div>

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

            {/* Celular e Documento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
                  Celular / WhatsApp
                </label>
                <div className="mt-1">
                  <input
                    {...register("phone")}
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="(00) 0 0000-0000"
                    onChange={(e) => {
                      const masked = maskPhone(e.target.value);
                      setValue("phone", masked, { shouldValidate: true });
                    }}
                    className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="document" className="block text-sm font-medium text-zinc-700">
                  CPF ou CNPJ
                </label>
                <div className="mt-1">
                  <input
                    {...register("document")}
                    id="document"
                    type="tel" 
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    onChange={(e) => {
                      const masked = maskCpfCnpj(e.target.value);
                      setValue("document", masked, { shouldValidate: true });
                    }}
                    className="appearance-none block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  {errors.document && <p className="mt-1 text-xs text-red-500">{errors.document.message}</p>}
                </div>
              </div>
            </div>

            {/* Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700">
                Senha de acesso
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
                  "Finalizar Cadastro"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
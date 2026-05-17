"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Scissors, ArrowRight, Loader2 } from "lucide-react"; // Globe removido
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Validação blindada com Zod
const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Ícone Oficial do Google
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [googleLoading, setGoogleLoading] = useState(false);

  // Instância do React Hook Form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Login tradicional com E-mail e Senha
  async function onSubmit(data: LoginFormValues) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        // Tratamento de erros amigável em português
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("E-mail ou senha incorretos.");
        }
        throw error;
      }

      toast.success("Bem-vindo de volta!");
      router.push("/dashboard"); 
    } catch (err) {
      // Verificação correta de tipo sem usar 'any'
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Erro ao realizar login");
      }
    }
  }

  // Login com Google
  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // CORREÇÃO AQUI: removido o "/auth" da URL
          redirectTo: `${window.location.origin}/callback?next=/dashboard`,
        },
      });

      if (error) throw error;
    } catch {
      toast.error("Erro ao conectar com Google");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 sm:p-8">
      {/* Atualizado para max-w-105 seguindo a recomendação do Tailwind v4 */}
      <Card className="w-full max-w-105 shadow-xl border-zinc-200/60 bg-white">
        <CardHeader className="text-center space-y-2 pt-8">
          <div className="flex justify-center mb-4">
            <div className="p-3.5 bg-zinc-950 rounded-2xl text-white shadow-md ring-1 ring-zinc-950/10">
              <Scissors className="size-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-zinc-950">
            Acesse sua conta
          </CardTitle>
          <CardDescription className="text-zinc-500 font-medium">
            Gerencie sua barbearia de forma inteligente
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-zinc-700 font-semibold">
                E-mail profissional
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="contato@barbearia.com"
                disabled={isSubmitting || googleLoading}
                className={`h-11 bg-zinc-50 focus-visible:ring-zinc-950 transition-all ${
                  errors.email ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-zinc-700 font-semibold">
                  Senha
                </Label>
                <Link
                  href="/esqueci-minha-senha"
                  className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                disabled={isSubmitting || googleLoading}
                className={`h-11 bg-zinc-50 focus-visible:ring-zinc-950 transition-all ${
                  errors.password ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || googleLoading}
              className="w-full h-11 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold transition-all shadow-sm cursor-pointer"
            >
              {isSubmitting ? (
                <Loader2 className="animate-spin size-5 mr-2" />
              ) : null}
              {isSubmitting ? "Autenticando..." : "Entrar no sistema"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-zinc-400 font-bold tracking-wider">
                Ou continue com
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || googleLoading}
            className="w-full h-11 gap-3 border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-semibold transition-all cursor-pointer shadow-sm"
          >
            {googleLoading ? (
              <Loader2 className="animate-spin size-5" />
            ) : (
              <GoogleIcon />
            )}
            Continuar com o Google
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-6 pb-8">
          <p className="text-sm text-center text-zinc-500 font-medium">
            Não tem uma conta?{" "}
            <Link
              href="/cadastro"
              className="text-zinc-950 font-bold hover:underline transition-all"
            >
              Cadastre sua barbearia
            </Link>
          </p>

          {/* Escape para Cliente Final (Mobile First Focus) */}
          <div className="w-full p-4 bg-zinc-50 rounded-xl border border-zinc-100 space-y-2 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-widest">
                Área do Cliente
              </p>
            </div>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Deseja apenas agendar um corte? Procure o link da sua barbearia.
            </p>
            <Button
              variant="link"
              className="p-0 h-auto text-xs text-zinc-900 font-bold gap-1 group w-fit"
              asChild
            >
              <Link href="/agendar">
                Acessar Portal de Busca{" "}
                <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
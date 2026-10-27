"use client";

import { useMemo, useState } from "react";
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
import { Scissors, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

type DestinationResponse = {
  destination?: string;
  error?: string;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.743.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  async function resolveDestinationAfterLogin() {
    const response = await fetch("/api/auth/destination", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });

    const result = (await response.json().catch(() => ({}))) as DestinationResponse;

    if (!response.ok || !result.destination) {
      throw new Error(
        result.error || "Não foi possível verificar as permissões desta conta. Tente novamente."
      );
    }

    const allowedDestinations = new Set([
      "/dashboard",
      "/profissional",
      "/agendar",
      "/acesso-negado",
    ]);

    if (!allowedDestinations.has(result.destination)) {
      throw new Error("O destino de acesso retornado pelo servidor é inválido.");
    }

    return result.destination;
  }

  async function onSubmit(data: LoginFormValues) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email.trim(),
        password: data.password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("E-mail ou senha incorretos.");
        }
        throw error;
      }

      const destination = await resolveDestinationAfterLogin();
      toast.success("Autenticação concluída.");
      router.replace(destination);
      router.refresh();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erro ao realizar login.");
      }
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // O callback decide o destino com base nos papéis do banco.
          // Não usamos next=/dashboard como se fosse uma autorização.
          redirectTo: `${window.location.origin}/callback`,
        },
      });

      if (error) throw error;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Erro ao conectar com Google.");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4 sm:p-8">
      <Card className="w-full max-w-105 border-zinc-200/60 bg-white shadow-xl">
        <CardHeader className="space-y-2 pt-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-2xl bg-zinc-950 p-3.5 text-white shadow-md ring-1 ring-zinc-950/10">
              <Scissors className="size-7" />
            </div>
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight text-zinc-950">
            Acesse sua conta
          </CardTitle>
          <CardDescription className="font-medium text-zinc-500">
            Acesse a área correspondente às permissões da sua conta no BarbeiroPass.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pb-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold text-zinc-700">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
                disabled={isSubmitting || googleLoading}
                className={`h-11 bg-zinc-50 transition-all focus-visible:ring-zinc-950 ${
                  errors.email ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs font-medium text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="font-semibold text-zinc-700">
                  Senha
                </Label>
                <Link
                  href="/esqueci-minha-senha"
                  className="text-xs font-semibold text-zinc-500 transition-colors hover:text-zinc-950"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={isSubmitting || googleLoading}
                className={`h-11 bg-zinc-50 transition-all focus-visible:ring-zinc-950 ${
                  errors.password ? "border-red-500 focus-visible:ring-red-500" : ""
                }`}
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs font-medium text-red-500">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || googleLoading}
              className="h-11 w-full cursor-pointer bg-zinc-950 font-semibold text-white shadow-sm transition-all hover:bg-zinc-800"
            >
              {isSubmitting ? <Loader2 className="mr-2 size-5 animate-spin" /> : null}
              {isSubmitting ? "Autenticando..." : "Entrar no sistema"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-bold tracking-wider text-zinc-400">
                Ou continue com
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isSubmitting || googleLoading}
            className="h-11 w-full cursor-pointer gap-3 border-zinc-200 bg-white font-semibold text-zinc-700 shadow-sm transition-all hover:bg-zinc-50"
          >
            {googleLoading ? <Loader2 className="size-5 animate-spin" /> : <GoogleIcon />}
            Continuar com o Google
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col gap-6 pb-8">
          <p className="text-center text-sm font-medium text-zinc-500">
            Não tem uma conta?{" "}
            <Link
              href="/cadastro"
              className="font-bold text-zinc-950 transition-all hover:underline"
            >
              Cadastre sua barbearia
            </Link>
          </p>

          <div className="w-full space-y-2 rounded-xl border border-zinc-100 bg-zinc-50 p-4 shadow-inner">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-800">
                Área do Cliente
              </p>
            </div>
            <p className="text-xs font-medium leading-relaxed text-zinc-500">
              Deseja apenas agendar um corte? Procure o link da sua barbearia.
            </p>
            <Button
              variant="link"
              className="group w-fit gap-1 p-0 text-xs font-bold text-zinc-900"
              asChild
            >
              <Link href="/agendar">
                Acessar Portal de Busca <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

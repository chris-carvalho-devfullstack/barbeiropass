"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { type User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Removido o import não utilizado do 'Scissors'
import {
  User,
  Camera,
  Shield,
  Save,
  Loader2,
  Mail,
  Phone,
  Briefcase,
  Lock,
} from "lucide-react";
import { toast } from "sonner";

export default function PerfilPage() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("barbeiro");
  const [novaSenha, setNovaSenha] = useState("");

  useEffect(() => {
    async function carregarPerfil() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        setNome(
          user.user_metadata?.name || user.user_metadata?.nome_barbearia || "",
        );
        setTelefone(user.user_metadata?.telefone || "");
        setCargo(user.user_metadata?.cargo || "dono");
      }
      setLoading(false);
    }
    carregarPerfil();
  }, []);

  async function handleSalvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("A guardar alterações...");

    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          name: nome,
          telefone: telefone,
          cargo: cargo,
        },
      });

      if (novaSenha.trim() !== "") {
        const { error: senhaError } = await supabase.auth.updateUser({
          password: novaSenha,
        });
        if (senhaError) throw senhaError;
        setNovaSenha("");
      }

      if (error) throw error;

      toast.success("Perfil atualizado com sucesso!", { id: toastId });
    } catch (error) {
      // Correção do 'any': Verificamos se o erro é uma instância de Error antes de ler a mensagem
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao atualizar perfil";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  function handleAvatarUpload() {
    toast.info(
      "Upload de fotos será implementado em breve com o Supabase Storage.",
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const avatarUrl = user?.user_metadata?.avatar_url;
  const iniciais = nome ? nome.substring(0, 2).toUpperCase() : "US";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      <div className="flex flex-col gap-1 px-2 md:px-0">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900">
          Meu Perfil
        </h1>
        <p className="text-sm text-zinc-500">
          Gerencie as suas informações pessoais e credenciais de acesso.
        </p>
      </div>

      <form onSubmit={handleSalvarPerfil} className="space-y-6">
        <Card className="border-zinc-200 shadow-sm overflow-hidden">
          <div className="h-24 bg-zinc-900 w-full relative">
            {/* Correção Tailwind: Removido o '_' antes de var() */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white to-transparent"></div>
          </div>
          <CardContent className="px-6 pb-6 pt-0 sm:px-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-12 mb-6">
              <div className="relative group">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-zinc-100 shadow-md">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Avatar"
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-2xl font-bold text-white">
                      {iniciais}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleAvatarUpload}
                  className="absolute bottom-0 right-0 rounded-full bg-zinc-900 p-2 text-white shadow-sm ring-2 ring-white transition-transform hover:scale-105 active:scale-95"
                >
                  <Camera className="size-4" />
                </button>
              </div>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-zinc-900">
                  {nome || "Utilizador"}
                </h2>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-sm text-zinc-500 mt-1">
                  <Mail className="size-3.5" />
                  <span>{user?.email}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome" className="flex items-center gap-2">
                  <User className="size-4 text-zinc-500" /> Nome Completo
                </Label>
                <Input
                  id="nome"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="focus-visible:ring-zinc-900"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone" className="flex items-center gap-2">
                  <Phone className="size-4 text-zinc-500" /> Telefone / WhatsApp
                </Label>
                <Input
                  id="telefone"
                  placeholder="(00) 00000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="focus-visible:ring-zinc-900"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="size-5 text-zinc-900" /> Papel na Barbearia
            </CardTitle>
            <CardDescription>
              Defina o seu cargo para personalizar as permissões de acesso ao
              sistema futuramente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Select value={cargo} onValueChange={setCargo}>
                <SelectTrigger className="focus:ring-zinc-900">
                  <SelectValue placeholder="Selecione o seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dono">Proprietário / Dono</SelectItem>
                  <SelectItem value="gerente">Gerente</SelectItem>
                  <SelectItem value="barbeiro">
                    Barbeiro Profissional
                  </SelectItem>
                  <SelectItem value="recepcionista">Recepcionista</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-zinc-900">
              <Shield className="size-5 text-zinc-900" /> Segurança
            </CardTitle>
            <CardDescription>
              Atualize a sua palavra-passe de acesso. Deixe em branco caso não
              queira alterar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-md space-y-2">
              <Label htmlFor="nova_senha" className="flex items-center gap-2">
                <Lock className="size-4 text-zinc-500" /> Nova Palavra-passe
              </Label>
              <Input
                id="nova_senha"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                className="focus-visible:ring-zinc-900"
              />
              <p className="text-[11px] text-zinc-500">
                Se entrar através do Google, definir uma palavra-passe aqui
                permitirá que faça login também com o seu e-mail.
              </p>
            </div>
          </CardContent>
          <CardFooter className="bg-zinc-50 px-6 py-4 mt-4 border-t border-zinc-100 flex justify-end">
            <Button
              type="submit"
              className="bg-zinc-900 hover:bg-zinc-800 text-white w-full sm:w-auto gap-2 transition-all"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "A guardar..." : "Guardar Alterações"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

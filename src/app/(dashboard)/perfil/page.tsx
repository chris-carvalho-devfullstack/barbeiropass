"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/utils/supabase/client";
import { type User as SupabaseUser } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { maskPhone } from "@/utils/validations"; // <-- ADICIONE ESTA LINHA
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
  Scissors,
} from "lucide-react";
import { toast } from "sonner";
import { updateUserProfileSettings } from "./actions";

export default function PerfilPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Estados do Formulário
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("owner");
  const [isBarber, setIsBarber] = useState(false);
  const [novaSenha, setNovaSenha] = useState("");

  useEffect(() => {
    async function carregarPerfil() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUser(user);
        
        // Vamos buscar as informações REAIS no banco de dados (Fonte da Verdade)
        
        // 1. Tabela profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user.id)
          .single();
          
        if (profile) {
            setNome(profile.full_name || "");
            setTelefone(profile.phone || "");
        } else {
            // Fallback para metadados caso o profile ainda não esteja sincronizado
            const meta = user.user_metadata;
            setNome(meta?.full_name || meta?.fullName || meta?.name || meta?.nome_barbearia || "");
            setTelefone(meta?.telefone || meta?.phone || "");
        }

        // 2. Tabela barbershop_members (Cargo administrativo)
        const { data: member } = await supabase
          .from("barbershop_members")
          .select("role")
          .eq("profile_id", user.id)
          .maybeSingle();
          
        if (member) setCargo(member.role);

        // 3. Tabela staff (Atua como barbeiro?)
        const { data: staffData } = await supabase
          .from("staff")
          .select("is_active")
          .eq("profile_id", user.id)
          .eq("role", "barber")
          .maybeSingle();
          
        setIsBarber(!!staffData?.is_active);
      }
      setLoading(false);
    }
    carregarPerfil();
  }, [supabase]);

  async function handleSalvarPerfil(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Salvando alterações...");

    try {
      if (!user) throw new Error("Usuário não encontrado.");

      // 1. Chama a Server Action (Com segurança Zero Trust)
      const result = await updateUserProfileSettings({
        nome,
        telefone,
        cargo: cargo as "owner" | "manager" | "receptionist",
        isBarber
      });

      if (result.error) throw new Error(result.error);

      // 2. Atualiza a metadata localmente apenas para refletir rápido na UI (Header, etc)
      await supabase.auth.updateUser({
        data: { 
          full_name: nome, 
          phone: telefone, 
          role: cargo 
        },
      });

      // 3. Troca de senha (se o campo não estiver vazio)
      if (novaSenha.trim() !== "") {
        const { error: senhaError } = await supabase.auth.updateUser({
          password: novaSenha,
        });
        if (senhaError) throw senhaError;
        setNovaSenha("");
      }

      toast.success("Perfil atualizado com sucesso!", { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao atualizar perfil";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  // --- LÓGICA DE UPLOAD DA FOTO DE PERFIL ---
  async function handleUploadFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    const toastId = toast.loading("Enviando foto...");

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;

      setUser({
        ...user,
        user_metadata: { ...user.user_metadata, avatar_url: publicUrl },
      });

      toast.success("Foto de perfil atualizada!", { id: toastId });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro no upload";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white to-transparent"></div>
          </div>
          <CardContent className="px-6 pb-6 pt-0 sm:px-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-12 mb-6">
              
              {/* Seção da Foto do Perfil */}
              <div className="relative group">
                <div className="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-zinc-100 shadow-md">
                  {uploadingAvatar ? (
                    <div className="flex h-full w-full items-center justify-center bg-zinc-100">
                      <Loader2 className="size-6 animate-spin text-zinc-400" />
                    </div>
                  ) : avatarUrl ? (
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

                {/* Input Invisível para selecionar a foto */}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  ref={fileInputRef}
                  onChange={handleUploadFoto}
                  disabled={uploadingAvatar}
                />

                {/* Botão que aciona o input invisível */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 rounded-full bg-zinc-900 p-2 text-white shadow-sm ring-2 ring-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                >
                  <Camera className="size-4" />
                </button>
              </div>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-zinc-900">
                  {nome || "Administrador"}
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
                  className="focus-visible:ring-zinc-900 bg-zinc-50"
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
                  onChange={(e) => setTelefone(maskPhone(e.target.value))} 
                  className="focus-visible:ring-zinc-900 bg-zinc-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NOVA SEÇÃO: PERMISSÕES E ACESSOS */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="size-5 text-zinc-900" /> Permissões e Acessos
            </CardTitle>
            <CardDescription>
              Defina o seu cargo administrativo e indique se atende clientes na barbearia.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* Bloco 1: Nível de Acesso */}
            <div className="max-w-md space-y-2">
              <Label htmlFor="cargo">Nível de Acesso ao Sistema</Label>
              <Select value={cargo} onValueChange={setCargo}>
                <SelectTrigger className="focus:ring-zinc-900 bg-zinc-50">
                  <SelectValue placeholder="Selecione o seu cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietário (Acesso Total)</SelectItem>
                  <SelectItem value="manager">Gerente (Gestão e Agendamentos)</SelectItem>
                  <SelectItem value="receptionist">Recepcionista (Fila e PDV)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bloco 2: Toggle Atendimento Operacional */}
            <div className="flex flex-row items-center justify-between rounded-lg border border-zinc-200 p-4 bg-zinc-50 max-w-md">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2 cursor-pointer" onClick={() => setIsBarber(!isBarber)}>
                  <Scissors className="size-4 text-zinc-700" /> Realiza atendimentos?
                </Label>
                <p className="text-[13px] text-zinc-500 leading-snug">
                  Ative para que os clientes possam escolher você na fila virtual e na agenda.
                </p>
              </div>
              <Switch
                checked={isBarber}
                onCheckedChange={setIsBarber}
              />
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
                className="focus-visible:ring-zinc-900 bg-zinc-50"
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
              className="bg-zinc-950 hover:bg-zinc-800 text-white w-full sm:w-auto gap-2 transition-all cursor-pointer"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
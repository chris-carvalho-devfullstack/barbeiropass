"use client";

import { useState, useEffect, ComponentPropsWithoutRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateAppearance, updateBarbershopSettings, BarbershopSettingsData } from "../actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { maskPhone } from "@/utils/validations"; 
import { Loader2, Upload, Camera, Check, Phone } from "lucide-react";
import Image from "next/image";

// ============================================================================
// ÍCONE CUSTOMIZADO (Tipado corretamente sem 'any')
// ============================================================================
interface InstagramIconProps extends ComponentPropsWithoutRef<"svg"> {
  size?: number;
}

const InstagramIcon = ({ size = 24, ...props }: InstagramIconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

// --- TIPAGENS ---
interface AmenitiesTypes {
  parking: boolean;
  wifi: boolean;
  airConditioning: boolean;
  accessibility: boolean;
  beer: boolean;
  videogame: boolean;
  coffee: boolean;
  kidsArea: boolean;
}

interface BarbershopData {
  id: string;
  name: string;
  description?: string;
  phone?: string;
  instagram?: string;
  logo_url?: string;
  banner_url?: string;
}

interface BarbershopSettingsResponse {
  amenities: AmenitiesTypes | null;
}

interface BarbershopWithSettings extends BarbershopData {
  barbershop_settings: BarbershopSettingsResponse | BarbershopSettingsResponse[] | null;
}

// Tipagem para o retorno do join no Supabase
interface MemberWithBarbershop {
  barbershops: BarbershopWithSettings | null;
}

export default function AparenciaPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [barbershop, setBarbershop] = useState<BarbershopData | null>(null);
  
  const [amenities, setAmenities] = useState<AmenitiesTypes>({
    parking: false, wifi: false, airConditioning: false,
    accessibility: false, beer: false, videogame: false,
    coffee: false, kidsArea: false
  });

  useEffect(() => {
    async function loadData() {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data: member } = await supabase
        .from("barbershop_members")
        .select("barbershops(*, barbershop_settings(*))")
        .eq("profile_id", userData.user.id)
        .returns<MemberWithBarbershop[]>() // Força a tipagem do retorno
        .single();

      if (member?.barbershops) {
        const bs = member.barbershops;

        setBarbershop({
          id: bs.id,
          name: bs.name,
          description: bs.description,
          phone: bs.phone,
          instagram: bs.instagram,
          logo_url: bs.logo_url,
          banner_url: bs.banner_url,
        });

        const settingsData = bs.barbershop_settings;
        const settings = Array.isArray(settingsData) ? settingsData[0] : settingsData;
        
        if (settings?.amenities) {
          setAmenities(settings.amenities);
        }
      }
    }
    loadData();
  }, [supabase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !barbershop) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Máximo de 10MB");
      return;
    }
    
    const toastId = toast.loading("Sincronizando imagem...");

    try {
      // Listagem de arquivos para limpeza
      const { data: existingFiles } = await supabase.storage
        .from('barbershop-media')
        .list(barbershop.id);

      if (existingFiles) {
        const filesToDelete = existingFiles
          .filter(f => f.name.startsWith(type === 'logo' ? 'logo.' : 'capa.'))
          .map(f => `${barbershop.id}/${f.name}`);

        if (filesToDelete.length > 0) {
          await supabase.storage.from('barbershop-media').remove(filesToDelete);
        }
      }

      const fileExt = file.name.split('.').pop();
      const fileName = type === 'logo' ? `logo.${fileExt}` : `capa.${fileExt}`;
      const filePath = `${barbershop.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('barbershop-media')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('barbershop-media').getPublicUrl(filePath);
      const finalUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const updateData = type === 'logo' ? { logo_url: finalUrl } : { banner_url: finalUrl };
      await supabase.from('barbershops').update(updateData).eq('id', barbershop.id);
      
      setBarbershop(prev => prev ? { ...prev, ...updateData } : null);
      toast.success("Imagem atualizada!", { id: toastId });

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro no processo: " + errorMessage, { id: toastId });
    }
  };

  const onSaveAll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const appearance = {
      description: (formData.get("description") as string) || "",
      phone: (formData.get("phone") as string) || "",
      instagram: (formData.get("instagram") as string) || "",
    };

    const settings: BarbershopSettingsData = {
      styles: ["Moderna", "Urbana"], 
      target_audience: ["Masculino"],
      amenities: amenities,
    };

    const [res1, res2] = await Promise.all([
      updateAppearance(appearance),
      updateBarbershopSettings(settings)
    ]);

    if (res1.error || res2.error) {
      toast.error("Erro ao salvar as configurações.");
    } else {
      toast.success("Perfil atualizado com sucesso!");
    }
    setLoading(false);
  };

  if (!barbershop) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-zinc-500" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12 animate-in fade-in zoom-in duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Personalização Pública</h1>
        <p className="mt-2 text-muted-foreground">Configure a vitrine que seus clientes verão ao agendar.</p>
      </header>

      <form onSubmit={onSaveAll} className="space-y-8">
        <section className="relative">
          <div className="group relative h-48 w-full overflow-hidden rounded-xl bg-zinc-100 border border-zinc-200 sm:h-64 shadow-sm">
            {barbershop.banner_url ? (
              <Image 
                src={barbershop.banner_url} 
                alt="Banner da barbearia" 
                fill 
                className="object-cover transition-transform duration-500 group-hover:scale-105" 
                unoptimized 
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-zinc-400">
                <Upload size={32} />
                <span className="mt-2 text-xs font-medium uppercase">Capa da Barbearia</span>
              </div>
            )}
            
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className="flex flex-col items-center text-white text-sm font-semibold">
                <Camera size={24} />
                <span className="mt-2">Alterar Banner</span>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'banner')} />
            </label>
          </div>

          <div className="absolute -bottom-16 left-8 sm:left-12">
            <div className="group relative h-32 w-32 overflow-hidden rounded-full border-4 border-white bg-white shadow-xl ring-1 ring-zinc-200 sm:h-40 sm:w-40">
              {barbershop.logo_url ? (
                <Image 
                  src={barbershop.logo_url} 
                  alt="Logo" 
                  fill 
                  className="object-cover" 
                  unoptimized 
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-zinc-50 text-zinc-400">
                  <Camera size={32} />
                </div>
              )}

              <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <div className="flex flex-col items-center text-white text-[10px] font-bold uppercase tracking-wider">
                  <Upload size={20} />
                  <span className="mt-2">Mudar Foto</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'logo')} />
              </label>
            </div>
          </div>
        </section>

        <div className="pt-12" />

        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-zinc-200/60 shadow-sm">
              <CardHeader>
                <CardTitle>Identidade do Negócio</CardTitle>
                <CardDescription>Informações que aparecem abaixo da sua foto.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  <Label htmlFor="description">Biografia / Descrição Pública</Label>
                  <Textarea 
                    id="description"
                    name="description" 
                    defaultValue={barbershop.description || ""} 
                    placeholder="Conte quem você é e seu diferencial..." 
                    className="min-h-[140px] resize-none focus:ring-zinc-900 border-zinc-200" 
                  />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="flex items-center gap-2 text-zinc-600">
                      <Phone size={14} /> WhatsApp de Contato
                    </Label>
                    <Input 
                      id="phone" 
                      name="phone" 
                      defaultValue={barbershop.phone || ""} 
                      placeholder="(00) 00000-0000" 
                      // 👇 ADICIONE O EVENTO ONCHANGE AQUI
                      onChange={(e) => { e.target.value = maskPhone(e.target.value); }}
                      className="focus:ring-zinc-900" 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="instagram" className="flex items-center gap-2 text-zinc-600">
                      <InstagramIcon size={14} /> Instagram Profissional
                    </Label>
                    <Input id="instagram" name="instagram" defaultValue={barbershop.instagram || ""} placeholder="@seuusuario" className="focus:ring-zinc-900" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-zinc-200/60 shadow-sm">
              <CardHeader>
                <CardTitle>Comodidades Disponíveis</CardTitle>
                <CardDescription>Ícones que ajudam o cliente a escolher seu espaço.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(Object.keys(amenities) as Array<keyof AmenitiesTypes>).map((key) => (
                    <div key={key} className="flex items-center justify-between rounded-xl border border-zinc-100 p-4 transition-all hover:bg-zinc-50/50">
                      <Label htmlFor={key} className="cursor-pointer text-sm font-semibold text-zinc-700 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').replace('wifi', 'Wi-Fi')}
                      </Label>
                      <Switch 
                        id={key}
                        checked={amenities[key]} 
                        onCheckedChange={(checked) => setAmenities(prev => ({ ...prev, [key]: checked }))} 
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="bg-zinc-900 text-white border-none shadow-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Camera size={80} />
              </div>
              <CardHeader>
                <CardTitle className="text-lg">Dica Visual</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-zinc-300 leading-relaxed relative z-10">
                <p>Use fotos com boa iluminação. O banner deve ter pelo menos 1200px de largura para manter a nitidez em telas grandes.</p>
              </CardContent>
            </Card>

            <Button type="submit" disabled={loading} className="w-full h-14 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-lg shadow-xl hover:shadow-zinc-900/20 transition-all active:scale-95">
              {loading ? <Loader2 className="animate-spin mr-3" /> : <Check className="mr-3" size={20} strokeWidth={3} />}
              SALVAR PERFIL
            </Button>
          </aside>
        </div>
      </form>
    </div>
  );
}
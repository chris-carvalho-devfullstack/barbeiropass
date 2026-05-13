"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { updateAppearance, updateBarbershopSettings, BarbershopSettingsData } from "../actions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload, Camera, Check } from "lucide-react";
import Image from "next/image";

// --- TIPAGENS PARA REMOVER O "ANY" ---
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
  description?: string;
  phone?: string;
  instagram?: string;
  logo_url?: string;
  banner_url?: string;
}

interface SupabaseResponse extends BarbershopData {
  barbershop_settings?: {
    amenities?: AmenitiesTypes;
  }[];
}

export default function AparenciaPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [barbershop, setBarbershop] = useState<BarbershopData | null>(null);
  
  // Estados para as Comodidades
  const [amenities, setAmenities] = useState<AmenitiesTypes>({
    parking: false, wifi: false, airConditioning: false,
    accessibility: false, beer: false, videogame: false,
    coffee: false, kidsArea: false
  });

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: member } = await supabase
        .from("barbershop_members")
        .select("barbershops(*, barbershop_settings(*))")
        .eq("profile_id", user.id)
        .single();

      if (member?.barbershops) {
        // Extração segura para lidar com retorno em Array ou Objeto do Supabase
        const bData = member.barbershops as unknown as SupabaseResponse | SupabaseResponse[];
        const bs = Array.isArray(bData) ? bData[0] : bData;

        if (bs) {
          setBarbershop({
            id: bs.id,
            description: bs.description,
            phone: bs.phone,
            instagram: bs.instagram,
            logo_url: bs.logo_url,
            banner_url: bs.banner_url,
          });

          // Extração segura das configurações (se existirem)
          const settingsArray = bs.barbershop_settings;
          const settings = Array.isArray(settingsArray) ? settingsArray[0] : settingsArray;
          
          if (settings?.amenities) {
            setAmenities(settings.amenities);
          }
        }
      }
    }
    loadData();
  }, [supabase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file || !barbershop) return;

    const toastId = toast.loading("Enviando imagem...");
    const fileExt = file.name.split('.').pop();
    const fileName = `${type}-${Date.now()}.${fileExt}`;
    const filePath = `${barbershop.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('barbershop-media')
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro no upload: " + uploadError.message, { id: toastId });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('barbershop-media')
      .getPublicUrl(filePath);

    const updateData = type === 'logo' ? { logo_url: publicUrl } : { banner_url: publicUrl };
    await supabase.from('barbershops').update(updateData).eq('id', barbershop.id);
    
    setBarbershop({ ...barbershop, ...updateData });
    toast.success("Imagem atualizada!", { id: toastId });
  };

  const onSaveAll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const appearance = {
      description: formData.get("description") as string,
      phone: formData.get("phone") as string,
      instagram: formData.get("instagram") as string,
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
      console.error("Erro na Aparência (res1):", res1.error);
      console.error("Erro nas Configurações (res2):", res2.error);
      toast.error("Erro ao salvar. Verifique o console.");
    } else {
      toast.success("Perfil da barbearia atualizado!");
    }
    setLoading(false);
  };

  if (!barbershop) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in zoom-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Aparência e Perfil</h1>
        <p className="text-muted-foreground mt-2">Configure como a sua barbearia aparece para os clientes no marketplace.</p>
      </div>

      <form onSubmit={onSaveAll} className="space-y-8">
        {/* IDENTIDADE VISUAL */}
        <Card>
          <CardHeader>
            <CardTitle>Identidade Visual</CardTitle>
            <CardDescription>O logotipo e o banner são a primeira coisa que o cliente vê.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="relative group">
                <div className="w-32 h-32 rounded-2xl bg-zinc-100 border-2 border-dashed border-zinc-300 flex items-center justify-center overflow-hidden relative">
                  {barbershop.logo_url ? (
                    <Image src={barbershop.logo_url} alt="Logotipo da barbearia" fill unoptimized className="object-cover" />
                  ) : <Camera className="text-zinc-400" />}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity rounded-2xl">
                  <Upload className="text-white" size={20} />
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'logo')} />
                </label>
                <p className="text-[10px] text-center mt-2 text-zinc-500 font-medium">LOGOTIPO</p>
              </div>

              <div className="flex-1 w-full group relative">
                <div className="w-full h-32 rounded-2xl bg-zinc-100 border-2 border-dashed border-zinc-300 flex items-center justify-center overflow-hidden relative">
                   {barbershop.banner_url ? (
                    <Image src={barbershop.banner_url} alt="Banner da barbearia" fill unoptimized className="object-cover" />
                  ) : <Upload className="text-zinc-400" />}
                </div>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity rounded-2xl">
                  <Upload className="text-white" size={20} />
                  <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, 'banner')} />
                </label>
                <p className="text-[10px] text-center mt-2 text-zinc-500 font-medium">BANNER DE CAPA</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* INFORMAÇÕES GERAIS */}
        <Card>
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Descrição da Barbearia</Label>
              <Textarea name="description" defaultValue={barbershop.description || ""} placeholder="Conte a história do seu negócio..." className="min-h-[100px]" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>WhatsApp / Telefone</Label>
                <Input name="phone" defaultValue={barbershop.phone || ""} placeholder="(00) 00000-0000" />
              </div>
              <div className="grid gap-2">
                <Label>Instagram (Link ou @)</Label>
                <Input name="instagram" defaultValue={barbershop.instagram || ""} placeholder="@suabarbearia" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COMODIDADES (AMENITIES) */}
        <Card>
          <CardHeader>
            <CardTitle>Comodidades e Estrutura</CardTitle>
            <CardDescription>Marque o que a sua barbearia oferece para os clientes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {(Object.keys(amenities) as Array<keyof AmenitiesTypes>).map((key) => (
                <div key={key} className="flex items-center space-x-3">
                  <Switch 
                    checked={amenities[key]} 
                    onCheckedChange={(checked) => setAmenities({ ...amenities, [key]: checked })} 
                  />
                  <Label className="capitalize text-xs cursor-pointer">
                    {key.replace(/([A-Z])/g, ' $1').replace('wifi', 'Wi-Fi')}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading} className="px-8 bg-zinc-900 hover:bg-zinc-800 text-white">
            {loading ? <Loader2 className="animate-spin mr-2" /> : <Check className="mr-2" />}
            Salvar Perfil Público
          </Button>
        </div>
      </form>
    </div>
  );
}
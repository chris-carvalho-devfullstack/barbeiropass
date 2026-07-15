"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { MapPin, Loader2, Search } from "lucide-react";
import { updateLocation } from "../../perfil/actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Schema de validação do lado do cliente
const formSchema = z.object({
  zip_code: z.string().min(9, "CEP incompleto"),
  street: z.string().min(2, "A rua é obrigatória"),
  number: z.string().min(1, "O número é obrigatório"),
  district: z.string().min(2, "O bairro é obrigatório"),
  city: z.string().min(2, "A cidade é obrigatória"),
  state: z.string().length(2, "UF inválida (Ex: SP)"),
  complement: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function EnderecoPage() {
  const router = useRouter();
  const [loadingCep, setLoadingCep] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      zip_code: "",
      street: "",
      number: "",
      district: "",
      city: "",
      state: "",
      complement: "",
    },
  });

  const zipCodeValue = watch("zip_code");

  // Carrega dados existentes do banco de dados ao entrar na página
  useEffect(() => {
    async function loadCurrentLocation() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: member } = await supabase
          .from("barbershop_members")
          .select("barbershop_id")
          .eq("profile_id", user.id)
          .maybeSingle();

        if (member?.barbershop_id) {
          const { data: loc } = await supabase
            .from("barbershop_locations")
            .select("*")
            .eq("barbershop_id", member.barbershop_id)
            .maybeSingle();

          if (loc) {
            // Reaplica a máscara de CEP ao carregar os dados
            const rawCep = loc.zip_code.replace(/\D/g, "");
            const maskedCep = rawCep.replace(/^(\d{5})(\d{3})$/, "$1-$2");
            
            setValue("zip_code", maskedCep);
            setValue("street", loc.street || "");
            setValue("number", loc.number || "");
            setValue("district", loc.district || "");
            setValue("city", loc.city || "");
            setValue("state", String(loc.state || "").toUpperCase());
            setValue("complement", loc.complement || "");
          }
        }
      } catch (err) {
        // Aqui usamos o 'err' para debugar se falhar o carregamento inicial
        console.error("Erro ao carregar endereço atual:", err);
      } finally {
        setPageLoading(false);
      }
    }
    loadCurrentLocation();
  }, [setValue]);

  // Efeito para monitorar a digitação do CEP e fazer o autofill dinâmico
  useEffect(() => {
    if (!zipCodeValue) return;

    const cleanCep = zipCodeValue.replace(/\D/g, "");

    // Formata visualmente o CEP enquanto digita (00000-000)
    if (cleanCep.length <= 8) {
      const masked = cleanCep.replace(/^(\d{5})(\d)/, "$1-$2");
      if (masked !== zipCodeValue) {
        setValue("zip_code", masked);
      }
    }

    if (cleanCep.length === 8) {
      const fetchCep = async () => {
        setLoadingCep(true);
        try {
          const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
          const data = await res.json();

          if (data.erro) {
            toast.error("CEP não encontrado na base de dados nacional.");
            return;
          }

          // Injeta os dados da API de forma atômica no formulário
          setValue("street", data.logradouro, { shouldValidate: true });
          setValue("district", data.bairro, { shouldValidate: true });
          setValue("city", data.localidade, { shouldValidate: true });
          setValue("state", String(data.uf).toUpperCase(), { shouldValidate: true });
          
          toast.success("Endereço autocompletado com sucesso!");
          
          // Foco inteligente: joga o cursor direto para o número do estabelecimento
          document.getElementById("number")?.focus();
        } catch {
          // Erro TS corrigido: removido o (err) pois não estava sendo usado
          toast.error("Falha ao conectar com o serviço de busca de CEP.");
        } finally {
          setLoadingCep(false);
        }
      };

      fetchCep();
    }
  }, [zipCodeValue, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      // Erro TS corrigido: Garantimos que complement seja uma string ("") caso seja undefined
      const response = await updateLocation({
        ...data,
        complement: data.complement || "",
      });
      
      if (response?.error) {
        toast.error(`Erro: ${response.error}`); 
        return;
      }

      toast.success("Endereço salvo e sincronizado com sucesso!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Erro TS corrigido: removido o (error) pois não estava sendo usado
      toast.error("Ocorreu um erro inesperado ao salvar o endereço.");
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="animate-spin text-zinc-900" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-zinc-900 text-white rounded-xl shadow-sm">
          <MapPin size={24} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Endereço do Estabelecimento</h1>
          <p className="text-sm text-zinc-500">Mantenha a localização atualizada para o marketplace.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-zinc-100 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          
          {/* CEP com indicador de carregamento integrado */}
          <div className="relative max-w-xs">
            <label htmlFor="zip_code" className="block text-sm font-medium text-zinc-700">CEP</label>
            <div className="relative mt-1">
              <input 
                {...register("zip_code")} 
                id="zip_code" 
                type="tel" 
                maxLength={9}
                placeholder="00000-000" 
                className="block w-full pr-10 px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" 
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-zinc-400">
                {loadingCep ? <Loader2 className="animate-spin size-4 text-zinc-900" /> : <Search size={16} />}
              </div>
            </div>
            {errors.zip_code && <p className="mt-1 text-xs text-red-500">{errors.zip_code.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Rua (Ocupa 2 colunas) */}
            <div className="sm:col-span-2">
              <label htmlFor="street" className="block text-sm font-medium text-zinc-700">Rua / Logradouro</label>
              <input {...register("street")} id="street" type="text" placeholder="Av. Paulista" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-zinc-50/50" />
              {errors.street && <p className="mt-1 text-xs text-red-500">{errors.street.message}</p>}
            </div>

            {/* Número */}
            <div>
              <label htmlFor="number" className="block text-sm font-medium text-zinc-700">Número</label>
              <input {...register("number")} id="number" type="text" placeholder="123" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
              {errors.number && <p className="mt-1 text-xs text-red-500">{errors.number.message}</p>}
            </div>
          </div>

          {/* Campo Novo: Complemento */}
          <div>
            <label htmlFor="complement" className="block text-sm font-medium text-zinc-700">Complemento <span className="text-xs text-zinc-400">(Opcional)</span></label>
            <input {...register("complement")} id="complement" type="text" placeholder="Sala 42, Bloco B" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm" />
            {errors.complement && <p className="mt-1 text-xs text-red-500">{errors.complement.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {/* Bairro */}
            <div>
              <label htmlFor="district" className="block text-sm font-medium text-zinc-700">Bairro</label>
              <input {...register("district")} id="district" type="text" placeholder="Centro" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-zinc-50/50" />
              {errors.district && <p className="mt-1 text-xs text-red-500">{errors.district.message}</p>}
            </div>

            {/* Cidade */}
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-zinc-700">Cidade</label>
              <input {...register("city")} id="city" type="text" placeholder="São Paulo" className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-zinc-50/50" />
              {errors.city && <p className="mt-1 text-xs text-red-500">{errors.city.message}</p>}
            </div>

            {/* Campo Novo: Estado (UF) */}
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-zinc-700">Estado (UF)</label>
              <input 
                {...register("state")} 
                id="state" 
                type="text" 
                maxLength={2}
                placeholder="SP" 
                className="mt-1 block w-full px-3 py-2 border border-zinc-300 rounded-lg shadow-sm focus:ring-zinc-900 focus:border-zinc-900 sm:text-sm bg-zinc-50/50 uppercase" 
              />
              {errors.state && <p className="mt-1 text-xs text-red-500">{errors.state.message}</p>}
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            {/* Tailwind Warning corrigido: min-w-[120px] virou min-w-30 */}
            <button 
              type="submit" 
              disabled={isSubmitting || loadingCep} 
              className="w-full sm:w-auto flex justify-center items-center px-6 py-2.5 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-70 transition-all min-w-30"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : "Salvar Endereço"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
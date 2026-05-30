"use client";

import { useEffect, useState, useRef } from "react";
import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Scissors, CheckCircle2, XCircle, Camera, Trash, Save } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

import { createClient } from "@/utils/supabase/client";
import { staffFormSchema, StaffFormValues, maskCpfCnpj, isValidCPF, isValidCNPJ } from "@/utils/validations";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

interface StaffFormDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  staffIdToEdit?: string | null;
  onSuccess: () => void;
}

interface Servico {
  id: string;
  name: string;
}

const defaultFormValues: StaffFormValues = {
  barbershop_id: "",
  full_name: "",
  cpf: "",
  cnpj: "",
  birth_date: "",
  role: "barber",
  address: { cep: "", rua: "", numero: "", bairro: "", cidade: "" },
  education_level: "",
  barber_courses: "",
  previous_experience: "",
  payment_model: "commission",
  commission_type: "global",
  global_commission: 0,
  fixed_fee_amount: 0,
  services_commissions: [],
};

export function StaffFormDialog({ isOpen, onOpenChange, staffIdToEdit, onSuccess }: StaffFormDialogProps) {
  const [loading, setLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [barbershopId, setBarbershopId] = useState<string | null>(null);
  const [services, setServices] = useState<Servico[]>([]);

  // Estados da Foto de Perfil
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const isEditing = !!staffIdToEdit;

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema) as unknown as Resolver<StaffFormValues>,
    mode: "onChange",
    defaultValues: defaultFormValues,
  });

  const paymentModel = form.watch("payment_model");
  const commissionType = form.watch("commission_type");
  
  const currentCpf = form.watch("cpf") || "";
  const currentCnpj = form.watch("cnpj") || "";

  const cleanCpf = currentCpf.replace(/\D/g, "");
  const isCpfFull = cleanCpf.length === 11;
  const isCpfValid = isCpfFull ? isValidCPF(cleanCpf) : false;

  const cleanCnpj = currentCnpj.replace(/\D/g, "");
  const isCnpjFull = cleanCnpj.length === 14;
  const isCnpjValid = isCnpjFull ? isValidCNPJ(cleanCnpj) : false;

  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultFormValues);
      setAvatarFile(null);
      setAvatarPreview(null);
      return;
    }

    async function loadData() {
      setIsFetchingProfile(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Busca Barbearia
        const { data: memberData } = await supabase
          .from("barbershop_members")
          .select("barbershop_id")
          .eq("profile_id", user.id)
          .single();

        let currentBarbershopId = "";
        if (memberData) {
          currentBarbershopId = memberData.barbershop_id;
          setBarbershopId(currentBarbershopId);
        }

        // 2. Busca Serviços
        const { data: servicesData } = await supabase.from("services").select("id, name").order("name");
        if (servicesData) {
          setServices(servicesData);
        }

        // 3. Se for edição, busca os dados do Staff
        if (isEditing && staffIdToEdit) {
          const { data: staffData, error } = await supabase.from("staff").select("*").eq("id", staffIdToEdit).single();
          if (error) throw error;

          const { data: commissions } = await supabase.from("staff_service_commissions").select("*").eq("staff_id", staffIdToEdit);

          if (staffData.avatar_url) setAvatarPreview(staffData.avatar_url);

          // Verifica se a comissão é global (todas iguais) ou específica
          const isGlobal = commissions && commissions.length > 0 && commissions.every(c => c.commission_percentage === commissions[0].commission_percentage);
          const globalValue = isGlobal ? commissions[0].commission_percentage : 0;

          // Preenche o formulário
          form.reset({
            barbershop_id: currentBarbershopId,
            full_name: staffData.full_name,
            role: staffData.role,
            cpf: staffData.cpf || "",
            cnpj: staffData.cnpj || "",
            birth_date: staffData.birth_date || "",
            payment_model: staffData.payment_model,
            education_level: staffData.education_level || "",
            barber_courses: staffData.barber_courses || "",
            previous_experience: staffData.previous_experience || "",
            fixed_fee_amount: staffData.fixed_fee_amount || 0,
            address: staffData.address || { cep: "", rua: "", numero: "", bairro: "", cidade: "" },
            commission_type: isGlobal ? "global" : "specific",
            global_commission: globalValue,
            services_commissions: servicesData?.map(s => {
              const comm = commissions?.find(c => c.service_id === s.id);
              return { service_id: s.id, commission_percentage: comm ? comm.commission_percentage : 0 };
            }) || []
          });
        } else {
          // Se for cadastro novo, inicializa barbearia e serviços vazios
          form.setValue("barbershop_id", currentBarbershopId);
          form.setValue("services_commissions", servicesData?.map((s) => ({ service_id: s.id, commission_percentage: 0 })) || []);
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados da ficha.");
      } finally {
        setIsFetchingProfile(false);
      }
    }

    loadData();
  }, [isOpen, isEditing, staffIdToEdit, supabase, form]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error("Formato inválido. Use apenas PNG ou JPG/JPEG.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A foto é muito pesada. O limite é 5MB.");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const removeAvatar = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAvatarFile(null);
    setAvatarPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const buscarCep = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, "");
    if (cepLimpo.length !== 8) return;

    setFetchingCep(true);
    try {
      const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const viaCepData = await viaCepResponse.json();

      if (!viaCepData.erro) {
        form.setValue("address.rua", viaCepData.logradouro);
        form.setValue("address.bairro", viaCepData.bairro);
        form.setValue("address.cidade", `${viaCepData.localidade} - ${viaCepData.uf}`);
        setFetchingCep(false);
        return;
      }

      const brasilApiResponse = await fetch(`https://brasilapi.com.br/api/cep/v1/${cepLimpo}`);
      if (brasilApiResponse.ok) {
        const brasilApiData = await brasilApiResponse.json();
        form.setValue("address.rua", brasilApiData.street);
        form.setValue("address.bairro", brasilApiData.neighborhood);
        form.setValue("address.cidade", `${brasilApiData.city} - ${brasilApiData.state}`);
        setFetchingCep(false);
        return;
      }

      throw new Error("CEP não encontrado.");
    } catch (error) {
      toast.error("CEP não localizado. Preencha o endereço manualmente.");
    } finally {
      setFetchingCep(false);
    }
  };

  const onSubmit: SubmitHandler<StaffFormValues> = async (data) => {
    if (!barbershopId) {
      toast.error("Erro: Barbearia não identificada.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading(isEditing ? "Atualizando profissional..." : "A registrar profissional...");

    try {
      const payload: StaffFormValues = { ...data, barbershop_id: barbershopId };

      if (payload.payment_model === "commission" && payload.commission_type === "global") {
        payload.services_commissions = services.map(s => ({
          service_id: s.id,
          commission_percentage: payload.global_commission || 0
        }));
      }

      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      }

      const url = isEditing ? `/api/staff?id=${staffIdToEdit}` : "/api/staff";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Ocorreu um erro ao salvar os dados.");

      toast.success(isEditing ? "Ficha atualizada com sucesso!" : "Profissional registrado com sucesso!", { id: toastId });
      onOpenChange(false);
      onSuccess(); 
    } catch (error: unknown) {
      if (error instanceof Error) toast.error(error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto w-full p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-black">
            {isEditing ? "Editar Profissional" : "Registrar Profissional"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Atualize as configurações e dados do integrante da equipe." 
              : "Preencha a ficha completa do novo barbeiro, gerente ou recepcionista da equipe."}
          </DialogDescription>
        </DialogHeader>

        {isFetchingProfile ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="size-8 animate-spin text-blue-500 mb-2" />
            <p className="font-medium">Carregando dados da ficha...</p>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              
              {/* AVATAR UPLOAD PREMIUM */}
              <div className="flex flex-col items-center justify-center pt-2 pb-4">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                  accept="image/png, image/jpeg" 
                  className="hidden" 
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative size-28 rounded-full border-4 border-slate-100 bg-slate-50 flex flex-col items-center justify-center overflow-hidden cursor-pointer group hover:border-blue-200 transition-colors shadow-sm"
                >
                  {avatarPreview ? (
                    <>
                      <Image src={avatarPreview} alt="Preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="size-6 text-white mb-1" />
                        <span className="text-[10px] text-white font-bold uppercase tracking-wider">Alterar</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Camera className="size-8 text-slate-300 group-hover:text-blue-500 transition-colors mb-1" />
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-blue-500">Adicionar</span>
                    </>
                  )}
                </div>
                {avatarFile && (
                  <Button type="button" variant="ghost" size="sm" onClick={removeAvatar} className="mt-2 text-red-500 hover:text-red-600 h-8 text-xs">
                    <Trash className="size-3 mr-1" /> Remover foto
                  </Button>
                )}
                <span className="text-[11px] text-slate-400 mt-1 text-center max-w-[200px]">Apenas PNG ou JPG. Máximo de 5MB. A imagem será recortada em formato circular.</span>
              </div>

              {/* SESSÃO 1: DADOS PESSOAIS */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2">1. Dados Pessoais</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="full_name"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="000.000.000-00" 
                              {...field} 
                              value={field.value || ""}
                              onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                              className={`pr-10 transition-colors ${isCpfFull ? (isCpfValid ? 'border-green-500 focus-visible:ring-green-500 bg-green-50/50' : 'border-red-500 focus-visible:ring-red-500 bg-red-50/50') : ''}`}
                            />
                            {isCpfFull && (
                              isCpfValid ? 
                                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-green-500 animate-in zoom-in" /> : 
                                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-red-500 animate-in zoom-in" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cnpj"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CNPJ (Opcional)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="00.000.000/0000-00" 
                              {...field} 
                              value={field.value || ""}
                              onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))}
                              className={`pr-10 transition-colors ${isCnpjFull ? (isCnpjValid ? 'border-green-500 focus-visible:ring-green-500 bg-green-50/50' : 'border-red-500 focus-visible:ring-red-500 bg-red-50/50') : ''}`}
                            />
                            {isCnpjFull && (
                              isCnpjValid ? 
                                <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-green-500 animate-in zoom-in" /> : 
                                <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 size-5 text-red-500 animate-in zoom-in" />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="birth_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo na Barbearia *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o cargo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="barber">Barbeiro</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                            <SelectItem value="receptionist">Recepcionista</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* SESSÃO 2: ENDEREÇO */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2 pt-2">2. Endereço Residencial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="address.cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              placeholder="00000-000" 
                              {...field} 
                              maxLength={9}
                              onChange={(e) => {
                                let val = e.target.value.replace(/\D/g, "");
                                if (val.length > 5) val = val.replace(/^(\d{5})(\d)/, "$1-$2");
                                field.onChange(val);
                                if (val.replace(/\D/g, "").length === 8) buscarCep(val);
                              }}
                            />
                            {fetchingCep && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-blue-500" />}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address.rua"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Rua / Logradouro</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Av. Brasil" {...field} disabled={fetchingCep} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField control={form.control} name="address.numero" render={({ field }) => (
                    <FormItem><FormLabel>Número</FormLabel><FormControl><Input placeholder="Ex: 123" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="address.bairro" render={({ field }) => (
                    <FormItem><FormLabel>Bairro</FormLabel><FormControl><Input placeholder="Ex: Centro" {...field} disabled={fetchingCep} /></FormControl><FormMessage /></FormItem>
                  )} />

                  <FormField control={form.control} name="address.cidade" render={({ field }) => (
                    <FormItem><FormLabel>Cidade/UF</FormLabel><FormControl><Input placeholder="Ex: São Paulo - SP" {...field} disabled={fetchingCep} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              {/* SESSÃO 3: HISTÓRICO PROFISSIONAL */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2 pt-2">3. Perfil Profissional</h3>
                <FormField control={form.control} name="education_level" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grau de Escolaridade</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ""} value={field.value || ""}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione a escolaridade" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="fundamental">Ensino Fundamental</SelectItem>
                        <SelectItem value="medio">Ensino Médio</SelectItem>
                        <SelectItem value="tecnico">Ensino Técnico</SelectItem>
                        <SelectItem value="superior">Ensino Superior</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="barber_courses" render={({ field }) => (
                  <FormItem><FormLabel>Cursos de Formação</FormLabel><FormControl><Textarea placeholder="Ex: Especialização em Colorimetria..." className="resize-none h-20" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="previous_experience" render={({ field }) => (
                  <FormItem><FormLabel>Experiência Anterior</FormLabel><FormControl><Textarea placeholder="Barbearias onde já trabalhou." className="resize-none h-20" {...field} value={field.value || ""} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              {/* SESSÃO 4: CONTRATO FINANCEIRO */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b pb-2 pt-2">4. Contrato Financeiro</h3>
                <FormField control={form.control} name="payment_model" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo de Remuneração</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione o modelo" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="commission">Comissionado (Porcentagem)</SelectItem>
                        <SelectItem value="fixed_fee">Taxa Fixa (Aluguel de Cadeira)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {paymentModel === "fixed_fee" ? (
                  <FormField control={form.control} name="fixed_fee_amount" render={({ field }) => (
                    <FormItem className="animate-in fade-in slide-in-from-top-2">
                      <FormLabel>Valor Fixo Mensal (R$)</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-4 border rounded-xl p-4 bg-slate-50/50">
                    <FormField control={form.control} name="commission_type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Comissão</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl><SelectTrigger className="bg-white"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="global">Geral (Mesma % para todos os serviços)</SelectItem>
                            <SelectItem value="specific">Individual (Definir % por serviço)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {commissionType === "global" ? (
                      <FormField control={form.control} name="global_commission" render={({ field }) => (
                        <FormItem className="animate-in fade-in slide-in-from-top-2">
                          <FormLabel>Porcentagem (%)</FormLabel>
                          <FormControl>
                            <div className="relative w-full sm:w-1/2">
                              <Input type="number" className="pr-8 bg-white" {...field} />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">%</span>
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    ) : (
                      <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                        <FormLabel>Comissões Específicas</FormLabel>
                        {services.length === 0 ? (
                          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md">Nenhum serviço registrado.</div>
                        ) : (
                          <div className="max-h-56 overflow-y-auto space-y-2 pr-2">
                            {form.watch("services_commissions")?.map((sc, index) => {
                              const serviceName = services.find(s => s.id === sc.service_id)?.name;
                              return (
                                <div key={sc.service_id} className="flex items-center justify-between gap-4 bg-white p-2 rounded-lg border shadow-sm">
                                  <span className="text-sm font-medium flex items-center gap-2"><Scissors className="size-3 text-slate-400"/>{serviceName}</span>
                                  <FormField control={form.control} name={`services_commissions.${index}.commission_percentage`} render={({ field }) => (
                                    <FormItem className="w-24">
                                      <FormControl>
                                        <div className="relative">
                                          <Input type="number" className="pr-6 text-right" {...field} />
                                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                                        </div>
                                      </FormControl>
                                    </FormItem>
                                  )} />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : (isEditing ? <Save className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />)}
                  {isEditing ? "Salvar Alterações" : "Concluir Registro"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
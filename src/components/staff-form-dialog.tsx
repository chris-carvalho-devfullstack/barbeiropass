"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useForm, SubmitHandler, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Scissors, CheckCircle2, XCircle, Camera, Trash, Save, Copy, Mail, RefreshCw, Clock3 } from "lucide-react";
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

interface StaffInvitationSummary {
  id: string;
  invited_email: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at?: string | null;
  revoked_at?: string | null;
  created_at?: string;
  updated_at?: string;
  link_type?: "invite" | "magiclink";
}

interface StaffInvitationListResponse {
  invitations?: StaffInvitationSummary[];
  error?: string;
}

interface StaffInvitationCreateResponse {
  success?: boolean;
  invitationUrl?: string;
  invitation?: {
    id: string;
    staffId: string;
    invitedEmail: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    linkType: "invite" | "magiclink";
    expiresAt: string;
    renewed: boolean;
  };
  message?: string;
  error?: string;
}

const defaultFormValues: StaffFormValues = {
  barbershop_id: "",
  full_name: "",
  cpf: "",
  cnpj: "",
  birth_date: "",
  role: "barber",
  access_email: "",
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
  const [newlyCreatedStaffId, setNewlyCreatedStaffId] = useState<string | null>(null);
  const [registrationSaved, setRegistrationSaved] = useState(false);
  const [invitations, setInvitations] = useState<StaffInvitationSummary[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isGeneratingInvitation, setIsGeneratingInvitation] = useState(false);
  const [generatedInvitationUrl, setGeneratedInvitationUrl] = useState<string | null>(null);
  const [originalInvitationEmail, setOriginalInvitationEmail] = useState("");
  const [staffProfileLinked, setStaffProfileLinked] = useState(false);

  // Estados da Foto de Perfil
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();
  const isEditing = !!staffIdToEdit;
  const activeStaffId = staffIdToEdit || newlyCreatedStaffId;
  const latestInvitation = invitations[0] ?? null;

  const form = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema) as unknown as Resolver<StaffFormValues>,
    mode: "onChange",
    defaultValues: defaultFormValues,
  });

  const invitationEmail = (form.watch("access_email") || "").trim().toLowerCase();
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

  const loadInvitations = useCallback(async (staffId: string, showLoading = true) => {
    if (showLoading) setIsLoadingInvitations(true);
    try {
      const response = await fetch(
        `/api/staff/invitations?staffId=${encodeURIComponent(staffId)}`,
        { method: "GET", credentials: "same-origin", cache: "no-store" }
      );
      const result = (await response.json().catch(() => ({}))) as StaffInvitationListResponse;
      if (!response.ok) {
        throw new Error(result.error || "Não foi possível consultar o histórico de convites.");
      }
      const invitationList = result.invitations ?? [];
      setInvitations(invitationList);
      return invitationList;
    } finally {
      if (showLoading) setIsLoadingInvitations(false);
    }
  }, []);

  const generateInvitation = useCallback(async (staffId: string, email: string) => {
    setIsGeneratingInvitation(true);
    setGeneratedInvitationUrl(null);
    try {
      const response = await fetch("/api/staff/invitations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, email: email.trim().toLowerCase() }),
      });
      const result = (await response.json().catch(() => ({}))) as StaffInvitationCreateResponse;
      if (!response.ok || !result.success || !result.invitationUrl) {
        throw new Error(result.error || "Não foi possível gerar o link de acesso.");
      }

      setGeneratedInvitationUrl(result.invitationUrl);
      setOriginalInvitationEmail(email.trim().toLowerCase());
      try {
        await loadInvitations(staffId, false);
      } catch (refreshError) {
        console.error("Erro ao atualizar a lista de convites após geração:", refreshError);
      }
      return result;
    } finally {
      setIsGeneratingInvitation(false);
    }
  }, [loadInvitations]);

  const copyInvitationLink = async () => {
    if (!generatedInvitationUrl) return;
    try {
      await navigator.clipboard.writeText(generatedInvitationUrl);
      toast.success("Link copiado. Envie-o manualmente ao profissional.");
    } catch (error) {
      console.error("Erro ao copiar o link do convite:", error);
      toast.error("Não foi possível copiar automaticamente. Selecione e copie o link exibido.");
    }
  };

  useEffect(() => {
    if (!isOpen) {
      form.reset(defaultFormValues);
      setAvatarFile(null);
      setAvatarPreview(null);
      setNewlyCreatedStaffId(null);
      setRegistrationSaved(false);
      setInvitations([]);
      setIsLoadingInvitations(false);
      setIsGeneratingInvitation(false);
      setGeneratedInvitationUrl(null);
      setOriginalInvitationEmail("");
      setStaffProfileLinked(false);
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

          let invitationList: StaffInvitationSummary[] = [];
          try {
            invitationList = await loadInvitations(staffIdToEdit, false);
          } catch (invitationLoadError) {
            console.error("Erro ao carregar histórico de convites:", invitationLoadError);
            toast.error("Não foi possível carregar o histórico de convites deste profissional.");
          }
          const latestInvitationData = invitationList[0] ?? null;
          setOriginalInvitationEmail(latestInvitationData?.invited_email?.trim().toLowerCase() ?? "");
          setStaffProfileLinked(Boolean(staffData.profile_id));
          setGeneratedInvitationUrl(null);
          setNewlyCreatedStaffId(null);
          setRegistrationSaved(false);

          if (staffData.avatar_url) setAvatarPreview(staffData.avatar_url);

          // Verifica se a comissão é global (todas iguais) ou específica
          const isGlobal = commissions && commissions.length > 0 && commissions.every(c => c.commission_percentage === commissions[0].commission_percentage);
          const globalValue = isGlobal ? commissions[0].commission_percentage : 0;

          // Preenche o formulário
          form.reset({
            barbershop_id: currentBarbershopId,
            full_name: staffData.full_name,
            role: staffData.role,
            access_email: latestInvitationData?.invited_email || "",
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
          setNewlyCreatedStaffId(null);
          setRegistrationSaved(false);
          setInvitations([]);
          setGeneratedInvitationUrl(null);
          setOriginalInvitationEmail("");
          setStaffProfileLinked(false);
          form.reset({
            ...defaultFormValues,
            barbershop_id: currentBarbershopId,
            services_commissions: servicesData?.map((s) => ({ service_id: s.id, commission_percentage: 0 })) || [],
          });
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        toast.error("Erro ao carregar dados da ficha.");
      } finally {
        setIsFetchingProfile(false);
      }
    }

    loadData();
  }, [isOpen, isEditing, staffIdToEdit, supabase, form, loadInvitations]);

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
    } catch {
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
    const hasSavedStaff = Boolean(staffIdToEdit || newlyCreatedStaffId);
    const toastId = toast.loading(hasSavedStaff ? "Salvando alterações do profissional..." : "Registrando profissional...");

    try {
      const payload: StaffFormValues = { ...data, barbershop_id: barbershopId };
      const accessEmail = (payload.access_email || "").trim().toLowerCase();

      if (payload.payment_model === "commission" && payload.commission_type === "global") {
        payload.services_commissions = services.map((service) => ({
          service_id: service.id,
          commission_percentage: payload.global_commission || 0,
        }));
      }

      // O e-mail de acesso pertence ao fluxo de convite, não à tabela staff.
      // O profile_id enviado pelo navegador também não deve ser usado para vincular contas.
      const staffPayload = { ...payload };
      delete staffPayload.access_email;
      delete staffPayload.profile_id;
      const formData = new FormData();
      formData.append("data", JSON.stringify(staffPayload));
      if (avatarFile) formData.append("avatar", avatarFile);

      const currentStaffId = staffIdToEdit || newlyCreatedStaffId;
      const url = currentStaffId ? `/api/staff?id=${currentStaffId}` : "/api/staff";
      const method = currentStaffId ? "PUT" : "POST";
      const response = await fetch(url, { method, body: formData });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Ocorreu um erro ao salvar os dados.");
      }

      const savedStaffId = currentStaffId || result.data?.id;
      if (!savedStaffId) {
        throw new Error("O cadastro foi processado, mas a API não retornou o identificador do profissional.");
      }

      if (!currentStaffId) {
        setNewlyCreatedStaffId(savedStaffId);
        setRegistrationSaved(true);
        onSuccess();
      }

      const previousEmail = originalInvitationEmail.trim().toLowerCase();
      const emailNeedsInvitation = accessEmail.length > 0 && accessEmail !== previousEmail;

      if (emailNeedsInvitation) {
        try {
          const invitationResult = await generateInvitation(savedStaffId, accessEmail);
          toast.success(
            invitationResult.invitation?.renewed
              ? "Cadastro salvo e link de convite renovado. Copie e envie o link manualmente."
              : "Cadastro salvo e convite gerado. Copie e envie o link manualmente.",
            { id: toastId }
          );
          onSuccess();
          return;
        } catch (invitationError: unknown) {
          const invitationMessage = invitationError instanceof Error
            ? invitationError.message
            : "Erro desconhecido ao gerar o convite.";
          toast.error(
            `O cadastro foi salvo, mas o convite não foi gerado: ${invitationMessage}. Corrija o e-mail ou tente gerar o convite novamente abaixo.`,
            { id: toastId, duration: 8000 }
          );
          onSuccess();
          return;
        }
      }

      if (!accessEmail && !currentStaffId) {
        toast.success(
          "Profissional cadastrado. Informe o e-mail de acesso e gere o convite na seção abaixo.",
          { id: toastId, duration: 7000 }
        );
        onSuccess();
        return;
      }

      toast.success("Ficha atualizada com sucesso!", { id: toastId });
      onOpenChange(false);
      onSuccess();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message, { id: toastId });
      } else {
        toast.error("Ocorreu um erro ao salvar os dados.", { id: toastId });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvitation = async () => {
    const staffId = staffIdToEdit || newlyCreatedStaffId;
    const email = invitationEmail;

    if (!staffId) {
      toast.error("Salve o cadastro do profissional antes de gerar o convite.");
      return;
    }
    if (!email) {
      form.setError("access_email", { type: "manual", message: "Informe o e-mail de acesso antes de gerar o convite." });
      return;
    }
    if (staffProfileLinked || latestInvitation?.status === "accepted") {
      toast.error("Este profissional já está vinculado a uma conta. Para alterar o e-mail de uma conta ativa, é necessário um fluxo específico de alteração de conta.");
      return;
    }

    try {
      const result = await generateInvitation(staffId, email);
      form.clearErrors("access_email");
      toast.success(
        result.invitation?.renewed
          ? "Link renovado. Copie e envie manualmente ao profissional."
          : "Link de convite gerado. Copie e envie manualmente ao profissional."
      );
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o convite.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto w-full p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-black">
            {isEditing || registrationSaved ? "Editar Profissional" : "Registrar Profissional"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os dados do integrante da equipe e gerencie seu convite de acesso."
              : registrationSaved
                ? "O cadastro foi salvo. Confira o e-mail e o estado do convite antes de fechar esta janela."
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

              {/* SESSÃO 5: ACESSO À ÁREA PROFISSIONAL */}
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Mail className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">5. Acesso à Área Profissional</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-600">
                      Informe o e-mail que o profissional usará para ativar a conta. O link será gerado pelo sistema e enviado manualmente por você; nenhum e-mail automático será enviado nesta versão.
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="access_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-mail de acesso</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          placeholder="profissional@exemplo.com"
                          {...field}
                          value={field.value || ""}
                          disabled={staffProfileLinked || latestInvitation?.status === "accepted"}
                          onChange={(event) => {
                            field.onChange(event.target.value.toLowerCase());
                            setGeneratedInvitationUrl(null);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      {(staffProfileLinked || latestInvitation?.status === "accepted") && (
                        <p className="text-xs leading-5 text-amber-700">
                          Este profissional já está vinculado a uma conta. A alteração do e-mail de uma conta ativa exige um fluxo separado.
                        </p>
                      )}
                    </FormItem>
                  )}
                />

                {activeStaffId ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">Estado do convite</p>
                      {isLoadingInvitations ? (
                        <span className="inline-flex items-center gap-2 text-xs text-slate-500">
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Consultando...
                        </span>
                      ) : staffProfileLinked ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Conta vinculada</span>
                      ) : latestInvitation ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          latestInvitation.status === "accepted"
                            ? "bg-emerald-100 text-emerald-800"
                            : latestInvitation.status === "pending"
                              ? "bg-blue-100 text-blue-800"
                              : latestInvitation.status === "expired"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-slate-100 text-slate-700"
                        }`}>
                          {latestInvitation.status === "accepted"
                            ? "Aceito"
                            : latestInvitation.status === "pending"
                              ? "Pendente"
                              : latestInvitation.status === "expired"
                                ? "Expirado"
                                : "Revogado"}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Sem convite</span>
                      )}
                    </div>

                    {latestInvitation && (
                      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                        <p className="break-words">E-mail convidado: <span className="font-medium text-slate-800">{latestInvitation.invited_email}</span></p>
                        <p className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 shrink-0" aria-hidden="true" />Validade: <span className="font-medium text-slate-800">{new Date(latestInvitation.expires_at).toLocaleString("pt-BR")}</span></p>
                        {latestInvitation.accepted_at && (
                          <p className="sm:col-span-2">Aceito em: <span className="font-medium text-slate-800">{new Date(latestInvitation.accepted_at).toLocaleString("pt-BR")}</span></p>
                        )}
                      </div>
                    )}

                    {!staffProfileLinked && latestInvitation?.status !== "accepted" ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full sm:w-auto"
                        disabled={loading || isGeneratingInvitation || isLoadingInvitations || !invitationEmail}
                        onClick={() => void handleGenerateInvitation()}
                      >
                        {isGeneratingInvitation ? (
                          <><Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> Gerando link...</>
                        ) : (
                          <><RefreshCw className="mr-2 size-4" aria-hidden="true" /> {latestInvitation?.status === "pending" ? "Gerar / renovar link" : "Gerar link de convite"}</>
                        )}
                      </Button>
                    ) : null}

                    {generatedInvitationUrl && (
                      <div className="space-y-2 border-t border-slate-100 pt-3">
                        <p className="text-sm font-semibold text-emerald-800">Link pronto para envio manual</p>
                        <p className="text-xs leading-5 text-slate-600">Copie o link agora e envie ao profissional. Por segurança, ele não será armazenado para ser exibido novamente depois que esta janela for fechada.</p>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={generatedInvitationUrl}
                            readOnly
                            aria-label="Link do convite de acesso profissional"
                            onFocus={(event) => event.currentTarget.select()}
                            className="min-w-0 bg-slate-50 text-xs"
                          />
                          <Button type="button" onClick={() => void copyInvitationLink()} className="shrink-0">
                            <Copy className="mr-2 size-4" aria-hidden="true" /> Copiar link
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white p-3 text-xs leading-5 text-slate-600">
                    Salve o cadastro primeiro. Depois disso, você poderá gerar ou renovar o convite e copiar o link para enviar manualmente.
                  </p>
                )}
              </div>

              <Separator />

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || isGeneratingInvitation}>Fechar</Button>
                <Button type="submit" disabled={loading || isGeneratingInvitation} className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                  {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : (isEditing || registrationSaved ? <Save className="size-4 mr-2" /> : <Plus className="size-4 mr-2" />)}
                  {isEditing || registrationSaved ? "Salvar Alterações" : "Concluir Registro"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
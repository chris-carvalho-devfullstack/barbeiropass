"use client";

import { useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Plus,
  UploadCloud,
  GripVertical,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; // <-- Importação do Textarea adicionada
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Esquema atualizado com a descrição opcional
const formSchema = z.object({
  nome: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  descricao: z.string().optional(), // <-- Novo campo
  categoria: z.string().min(1, "Selecione uma categoria"),
  tempo: z.string().min(1, "Informe o tempo estimado"),
  preco: z.string().min(1, "Informe o preço (ex: 50,00)"),
});

interface CreateServiceDialogProps {
  onServiceCreated: () => void | Promise<void>;
}

type FotoState = {
  id: string;
  file: File;
  url: string;
  status: "pendente" | "uploading" | "concluido" | "erro";
};

export function CreateServiceDialog({
  onServiceCreated,
}: CreateServiceDialogProps) {
  const [open, setOpen] = useState(false);
  const [fotos, setFotos] = useState<FotoState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      descricao: "", // <-- Valor inicial adicionado
      categoria: "",
      tempo: "",
      preco: "",
    },
  });

  const gerarCodigo = () => Math.floor(1000 + Math.random() * 9000).toString();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const novasFotos = Array.from(e.target.files);

    if (fotos.length + novasFotos.length > 5) {
      toast.error("O limite máximo é de 5 fotos por serviço.");
      return;
    }

    const validFotos: FotoState[] = [];
    novasFotos.forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`A imagem ${file.name} excede o limite de 10MB.`);
      } else {
        validFotos.push({
          id: Math.random().toString(36).substring(7),
          file,
          url: URL.createObjectURL(file),
          status: "pendente",
        });
      }
    });

    setFotos((prev) => [...prev, ...validFotos]);
    e.target.value = "";
  };

  const removerFoto = (indexToRemove: number) => {
    setFotos(fotos.filter((_, index) => index !== indexToRemove));
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (index: number) => {
    if (draggedIndex === null) return;
    const novaOrdem = [...fotos];
    const itemArrastado = novaOrdem.splice(draggedIndex, 1)[0];
    novaOrdem.splice(index, 0, itemArrastado);
    setFotos(novaOrdem);
    setDraggedIndex(null);
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    const toastId = toast.loading("A iniciar a criação do serviço...");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || !authData.user) throw new Error("Erro de autenticação.");
      const barbeariaId = authData.user.id;

      const codigoServico = gerarCodigo();
      const urlsFinais: string[] = [];

      toast.loading("A enviar fotos...", { id: toastId });

      for (let i = 0; i < fotos.length; i++) {
        const foto = fotos[i];

        setFotos((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "uploading" } : f)),
        );

        const extensao = foto.file.name.split(".").pop();
        const nomeArquivoSeguro = `${Date.now()}-${i}.${extensao}`;
        const filePath = `${barbeariaId}/${codigoServico}/${nomeArquivoSeguro}`;

        const { error: uploadError } = await supabase.storage
          .from("servicos-imagens")
          .upload(filePath, foto.file);

        if (uploadError) {
          setFotos((prev) =>
            prev.map((f, idx) => (idx === i ? { ...f, status: "erro" } : f)),
          );
          throw new Error(`Falha ao enviar a imagem ${foto.file.name}`);
        }

        const { data: urlData } = supabase.storage
          .from("servicos-imagens")
          .getPublicUrl(filePath);

        urlsFinais.push(urlData.publicUrl);

        setFotos((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: "concluido" } : f)),
        );
      }

      toast.loading("A guardar detalhes do serviço...", { id: toastId });

      const { error: dbError } = await supabase.from("servicos").insert([
        {
          barbearia_id: barbeariaId,
          nome: values.nome,
          descricao: values.descricao, // <-- Descrição salva no banco
          categoria: values.categoria,
          tempo: values.tempo,
          preco: values.preco,
          status: "Ativo",
          codigo: codigoServico,
          fotos: urlsFinais,
        },
      ]);

      if (dbError) throw dbError;

      toast.success("Serviço e fotos salvos com sucesso!", { id: toastId });
      form.reset();
      setFotos([]);
      setOpen(false);
      onServiceCreated();
    } catch (error) {
      console.error(error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao salvar o serviço.";
      toast.error(errorMessage, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && !isSubmitting) {
      form.reset();
      setFotos([]);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" /> Novo Serviço
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Serviço</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do novo serviço e adicione até 5 fotografias.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 pt-4"
          >
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Serviço</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Corte Degradê"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Novo Campo de Descrição Adicionado Aqui */}
            <FormField
              control={form.control}
              name="descricao"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição (Opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Corte com tesoura, fade na máquina e finalização com pomada."
                      className="resize-none min-h-[20]"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="categoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cabelo">Cabelo</SelectItem>
                        <SelectItem value="Barba">Barba</SelectItem>
                        <SelectItem value="Combo">Combo</SelectItem>
                        <SelectItem value="Química">Química</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tempo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo (min)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Ex: 45"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="preco"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preço (R$)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: 45,00"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 pt-2 border-t">
              <div className="flex justify-between items-center">
                <FormLabel>Fotografias (Até 5 fotos, max 10MB)</FormLabel>
                <span className="text-xs text-zinc-500">{fotos.length}/5</span>
              </div>

              <div className="flex items-center justify-center w-full">
                <label
                  className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg transition-colors ${fotos.length >= 5 || isSubmitting ? "bg-zinc-100 border-zinc-200 cursor-not-allowed opacity-60" : "bg-zinc-50 border-zinc-300 hover:bg-zinc-100 cursor-pointer"}`}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="size-6 text-zinc-400 mb-2" />
                    <p className="text-sm text-zinc-500 text-center px-4">
                      Clique ou arraste as fotos aqui
                      <br />
                      <span className="text-xs">PNG, JPG ou WEBP</span>
                    </p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    disabled={fotos.length >= 5 || isSubmitting}
                  />
                </label>
              </div>

              {fotos.length > 0 && (
                <div className="space-y-2 mt-4">
                  {fotos.map((foto, index) => (
                    <div
                      key={foto.id}
                      draggable={!isSubmitting}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(index)}
                      className={`flex items-center justify-between p-2 bg-white border rounded-md shadow-sm transition-all ${isSubmitting ? "opacity-80" : "cursor-move hover:border-zinc-400"}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <GripVertical className="size-10 text-zinc-400 shrink-0" />
                        <Image
                          src={foto.url}
                          alt="Preview"
                          width={40}
                          height={40}
                          className="size-10 object-cover rounded-md shrink-0"
                          unoptimized
                        />
                        <span className="text-sm truncate w-24 sm:w-48">
                          {foto.file.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {foto.status === "uploading" && (
                          <span className="text-xs text-blue-500 flex items-center gap-1">
                            <Loader2 className="size-3 animate-spin" /> A enviar
                          </span>
                        )}
                        {foto.status === "concluido" && (
                          <span className="text-xs text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> OK
                          </span>
                        )}
                        {foto.status === "erro" && (
                          <span className="text-xs text-red-500 flex items-center gap-1">
                            <X className="size-3" /> Erro
                          </span>
                        )}
                        {foto.status === "pendente" && (
                          <span className="text-xs text-zinc-400">
                            Pendente
                          </span>
                        )}

                        {!isSubmitting && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removerFoto(index)}
                          >
                            <X className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 mt-4 border-t">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    {" "}
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando
                    Serviço...{" "}
                  </>
                ) : (
                  "Salvar Serviço"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateLocation } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function EnderecoPage() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm();
  const router = useRouter();

  const onSubmit = async (data: any) => {
    const res = await updateLocation(data);
    if (res.success) {
      toast.success("Endereço salvo!");
      router.push("/dashboard");
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Localização da Barbearia</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input {...register("zip_code")} placeholder="00000-000" />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input {...register("city")} placeholder="São Paulo" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rua / Logradouro</Label>
              <Input {...register("street")} placeholder="Av. Paulista" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Número</Label>
                <Input {...register("number")} placeholder="123" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Bairro</Label>
                <Input {...register("district")} placeholder="Centro" />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar Endereço"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
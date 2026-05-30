"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffFormDialog } from "@/components/staff-form-dialog";

interface EditStaffButtonProps {
  staffId: string;
}

export function EditStaffButton({ staffId }: EditStaffButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      {/* Mantém exatamente o tamanho e classes originais do botão */}
      <Button className="h-auto" onClick={() => setIsOpen(true)}>
        <Settings2 className="mr-2 h-4 w-4" /> Configurar Contrato
      </Button>

      {/* Acopla o modal de edição que revalida a Edge ao salvar com sucesso */}
      <StaffFormDialog
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        staffIdToEdit={staffId}
        onSuccess={() => {
          router.refresh(); // Atualiza os dados do Server Component dinamicamente
        }}
      />
    </>
  );
}
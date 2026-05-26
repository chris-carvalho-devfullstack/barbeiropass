import { z } from "zod";

// ==========================================
// MÁSCARAS
// ==========================================
export const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d)(\d{4})$/, "$1-$2")
    .substring(0, 15);
};

export const maskCpfCnpj = (value: string) => {
  const v = value.replace(/\D/g, "");
  if (v.length <= 11) {
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
      .substring(0, 14);
  } else {
    return v
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 18);
  }
};

// ==========================================
// VALIDADORES MATEMÁTICOS
// ==========================================
export const isValidCPF = (cpf: string) => {
  const cleanCPF = cpf.replace(/\D/g, "");
  if (cleanCPF.length !== 11 || /^(\d)\1{10}$/.test(cleanCPF)) return false;
  let sum = 0, rest;
  for (let i = 1; i <= 9; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleanCPF.substring(9, 10))) return false;
  sum = 0;
  for (let i = 1; i <= 10; i++) sum += parseInt(cleanCPF.substring(i - 1, i)) * (12 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(cleanCPF.substring(10, 11))) return false;
  return true;
};

export const isValidCNPJ = (cnpj: string) => {
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  if (cleanCNPJ.length !== 14 || /^(\d)\1{13}$/.test(cleanCNPJ)) return false;
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) return false;
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) return false;
  return true;
};

// ==========================================
// ZOD SCHEMAS (VALIDAÇÃO DE FORMULÁRIOS E API)
// ==========================================

export const staffFormSchema = z.object({
  barbershop_id: z.string().uuid("ID da barbearia inválido"),
  profile_id: z.string().uuid().optional().nullable(),
  role: z.enum(['owner', 'manager', 'barber', 'receptionist'], {
    message: "O cargo é obrigatório e deve ser válido",
  }),
  full_name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  
  cpf: z.string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true; 
      return isValidCPF(val);
    }, { message: "CPF inválido" }),

    cnpj: z.string()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      return isValidCNPJ(val);
    }, { message: "CNPJ inválido" }),

  birth_date: z.string().optional().nullable(),
  address: z.object({
    cep: z.string().optional(),
    rua: z.string().optional(),
    numero: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
  }).optional(),
  education_level: z.string().optional().nullable(),
  barber_courses: z.string().optional().nullable(),
  previous_experience: z.string().optional().nullable(),
  
  payment_model: z.enum(['commission', 'fixed_fee']),
  
  // NOVOS CAMPOS PARA CONTROLE DE COMISSÃO
  commission_type: z.enum(['global', 'specific']).optional(),
  global_commission: z.coerce.number().min(0, "Mínimo 0%").max(100, "Máximo 100%").optional(),
  
  fixed_fee_amount: z.coerce.number().min(0).optional(),
  
  services_commissions: z.array(z.object({
    service_id: z.string().uuid("ID do serviço inválido"),
    commission_percentage: z.coerce.number().min(0, "A comissão não pode ser negativa").max(100, "A comissão não pode passar de 100%")
  })).optional()
});

export type StaffFormValues = z.infer<typeof staffFormSchema>;
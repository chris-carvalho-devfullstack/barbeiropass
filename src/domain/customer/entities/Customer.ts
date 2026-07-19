// src/domain/customer/entities/Customer.ts

export type CustomerOrigin = 'MANUAL' | 'QUEUE' | 'BOOKING' | 'PDV' | 'GOOGLE' | 'IMPORT';
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface Customer {
  id: string;
  tenantId: string;
  authUserId?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  photoUrl?: string | null;
  preferredBarberId?: string | null;
  marketingConsent: boolean;
  status: CustomerStatus;
  createdFrom: CustomerOrigin;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
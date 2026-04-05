export type PropertyType = 'casa' | 'apartamento' | 'terreno' | 'comercial';
export type PropertyStatus = 'disponivel' | 'alugado' | 'manutencao';
export type ClientType = 'inquilino' | 'proprietario';
export type ContractStatus = 'ativo' | 'encerrado' | 'cancelado';
export type PaymentStatus = 'pago' | 'pendente' | 'atrasado';
export type UserRole = 'admin' | 'user';

export interface Property {
  id: string;
  type: PropertyType;
  address: string; // Keep for backward compatibility or display
  zipCode?: string;
  city?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  rentValue: number;
  description: string;
  photos: string[];
  status: PropertyStatus;
  ownerId: string;
}

export interface Client {
  id: string;
  name: string;
  cpfCnpj: string;
  rg?: string;
  phone: string;
  email?: string;
  address?: string; // Keep for backward compatibility or display
  zipCode?: string;
  city?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  type: ClientType;
}

export interface Contract {
  id: string;
  propertyId: string;
  tenantId: string;
  ownerId: string;
  startDate: string;
  endDate: string;
  monthlyValue: number;
  adjustmentIndex?: string;
  lateFee?: number;
  status: ContractStatus;
  clauses?: string[];
}

export type PaymentType = 'aluguel' | 'extra';

export interface Payment {
  id: string;
  contractId?: string; // Optional for extra payments not tied to a specific contract
  propertyId: string;
  dueDate: string;
  paymentDate?: string;
  amount: number;
  status: PaymentStatus;
  type: PaymentType;
  description?: string;
  photoUrl?: string;
  // Energy fields
  previousReading?: number;
  currentReading?: number;
  valuePerKwh?: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
}

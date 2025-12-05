export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  avatar?: string;
}

export interface Contract {
  id: string;
  number: string;
  object: string;
  contractor: string;
  value: number;
  startDate: string;
  endDate: string;
  status: 'ativo' | 'suspenso' | 'encerrado';
  category: string;
  responsibleUser: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commitment {
  id: string;
  contractId: string;
  number: string;
  description: string;
  value: number;
  liquidatedValue: number;
  date: string;
  status: 'empenhado' | 'liquidado' | 'pago';
}

export interface Addendum {
  id: string;
  contractId: string;
  number: string;
  type: 'valor' | 'prazo' | 'vigencia' | 'apostilamento';
  description: string;
  value?: number;
  newEndDate?: string;
  date: string;
}

export interface Document {
  id: string;
  contractId?: string;
  name: string;
  type: string;
  category: string;
  uploadDate: string;
  size: number;
  url: string;
}

export interface DashboardMetrics {
  totalContracts: number;
  activeContracts: number;
  totalValue: number;
  expiringContracts: number;
  pendingCommitments: number;
  documentsCount: number;
}

export interface ContractItem {
  id: string;
  contractId: string;
  name: string;
  description?: string;
  unit: string; // unidade de medida (kg, un, m², etc)
  initialQuantity: number;
  currentQuantity: number;
  minimumStock: number; // estoque mínimo para alerta
  unitValue?: number; // valor unitário opcional
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  contractId: string;
  itemId: string;
  orderNumber: string;
  quantity: number;
  date: string;
  requester: string;
  observation?: string;
  createdBy: string;
  createdAt: string;
}
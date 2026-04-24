export type UserRole = 'owner' | 'hrd' | 'admin staff';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  role: UserRole;
  ownerId: string;
}

export interface AppSettings {
  id?: string;
  ownerId: string;
  appName: string;
  tagline: string;
  footer: string;
  themeColor: string;
  themePreset?: 'dark' | 'midnight' | 'slate' | 'modern';
  logoUrl?: string;
}

export interface TeamMember {
  id?: string;
  ownerId: string;
  email: string;
  role: UserRole;
  username: string;
  createdAt: string;
}

export interface Distributor {
  id?: string;
  name: string;
  contact: string;
  address: string;
  ownerId: string;
}

export type PaymentType = 'tempo' | 'tunai';

export interface ItemReceipt {
  id?: string;
  date: string;
  distributorId: string;
  itemName: string;
  cashAmount: number;
  tempoAmount: number;
  shippingCost: number;
  amount: number; // total
  notes: string;
  ownerId: string;
}

export interface Bill {
  id?: string;
  date: string;
  distributorId: string;
  itemName: string;
  category: 'sales' | 'non-sales'; // Added this
  cashAmount: number;
  tempoAmount: number;
  shippingCost: number;
  amount: number;
  dueDate?: string;
  status: 'lunas' | 'pending';
  ownerId: string;
}


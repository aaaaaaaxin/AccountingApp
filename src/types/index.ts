export interface Ledger {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  icon?: string;
  order?: number;
  parentId: string | null;
  ledgerId: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  date: string;
  note: string;
  ledgerId: string;
  paymentMethod?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Template {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amount: number;
  categoryId: string;
  paymentMethod?: string;
  tags?: string[];
  note?: string;
  ledgerId: string;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  ledgerId: string;
  createdAt: string;
}

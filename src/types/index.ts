export type Language = "he" | "en";

export interface Business {
  id: string;
  name: string;
  logo?: string;
  industry: string;
  revenueModel: string;
  employees: number;
  fixedMonthlyCosts: number;
  targetMonthlyProfit: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  businessId: string;
  date: string;
  description: string;
  amount: number; // negative = expense, positive = income
  category?: string;
  isRecurring?: boolean;
}

export interface MonthlyStats {
  month: string;
  income: number;
  expenses: number;
  netProfit: number;
}

export interface ParsedColumn {
  dateCol: number;
  descCol: number;
  amountCol: number;
  headers: string[];
  preview: Transaction[];
}

export interface SupplierSummary {
  name: string;
  totalPaid: number;
  transactionCount: number;
  avgAmount: number;
  lastSeen: string; // YYYY-MM-DD
  isRecurring: boolean;
  months: string[]; // YYYY-MM list
}

export interface CashFlowPoint {
  month: string;
  balance: number;
  isProjected: boolean;
}

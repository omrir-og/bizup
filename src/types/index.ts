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
  customCategories?: string[];
  ownerNames?: string[];
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
  isExcluded?: boolean;
  excludeReason?: string; // "owner_loan" | "dividend" | "dividend_tax" | "manual"
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
  /** Present when separate credit / debit columns were found */
  splitCols?: { creditCol: number; debitCol: number };
  /** True when auto-detection was uncertain and user confirmation is needed */
  isAmbiguous: boolean;
  /** "all_positive" | "fallback_columns" | "split_columns" */
  ambiguityReason?: string;
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

export interface RecurringItem {
  key: string;           // normalized description used as stable ID
  description: string;  // cleaned display name
  type: "income" | "expense";
  avgAmount: number;    // positive number
  monthlyOccurrences: number;
  lastSeen: string;     // YYYY-MM-DD
  months: string[];     // YYYY-MM list
  nextExpected: string; // YYYY-MM (estimated)
}

export interface PartnerSummary {
  key: string;           // normalized name (stable ID)
  displayName: string;  // cleaned display name
  type: "client" | "supplier";
  totalAmount: number;
  transactionCount: number;
  avgAmount: number;
  lastSeen: string;
  isRecurring: boolean;
  months: string[];
}

export interface MergeRule {
  id: string;
  canonicalName: string;   // the name to keep
  aliases: string[];       // other keys that map to this canonical name
  createdAt: string;
}

export interface RecurringOverride {
  amount?: number;   // override the predicted amount
  skip?: boolean;    // skip next month's prediction
}

export interface CategoryClassification {
  category: string;
  type: "mandatory" | "discretionary";
  reason: string;
}

export interface ProfitabilityShift {
  month: string; // YYYY-MM
  changeType: "income_drop" | "expense_spike" | "new_supplier" | "salary_increase" | "client_loss";
  description: string;
  amount: number;
}

export interface FirstLookAnalysis {
  isProfitable: boolean;
  currentProfitSummary: string;
  bestMonth: string; // YYYY-MM
  bestMonthProfit: number;
  bestMonthReason: string;
  profitabilityShifts: ProfitabilityShift[];
  supplierChanges: string[];
  topExpenseCategory: string;
  topExpenseCategoryAmount: number;
  topExpenseCategoryPercent: number;
  categoryClassifications: CategoryClassification[];
  operatingProfit: number;
  operatingProfitExplanation: string;
  nextMonthPredictedIncome: number;
  nextMonthPredictedExpenses: number;
  nextMonthPredictedProfit: number;
  nextMonthConfidence: "high" | "medium" | "low";
  nextMonthNote: string;
  healthScore: number;
  healthReason: string;
  dataQualityNote: string | null;
}

export type TimeRange = "month" | "3months" | "6months" | "year" | "all";

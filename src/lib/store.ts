import { Business, MergeRule, RecurringOverride, Transaction } from "@/types";
import { generateId } from "./utils";

const BUSINESSES_KEY = "bizup_businesses";
const TRANSACTIONS_KEY = "bizup_transactions";

export function getBusinesses(): Business[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BUSINESSES_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveBusiness(b: Omit<Business, "id" | "createdAt">): Business {
  const businesses = getBusinesses();
  const newBusiness: Business = {
    ...b,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  businesses.push(newBusiness);
  localStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses));
  return newBusiness;
}

export function deleteBusiness(id: string): void {
  const businesses = getBusinesses().filter((b) => b.id !== id);
  localStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses));
  // Also delete transactions
  const transactions = getTransactions().filter((t) => t.businessId !== id);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function getTransactions(businessId?: string): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const all: Transaction[] = JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || "[]");
    return businessId ? all.filter((t) => t.businessId === businessId) : all;
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  const existing = getTransactions().filter(
    (t) => !transactions.some((nt) => nt.businessId === t.businessId)
  );
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([...existing, ...transactions]));
}

export function updateTransactions(updated: Transaction[]): void {
  if (typeof window === "undefined") return;
  const all = getTransactions();
  const updatedIds = new Set(updated.map((t) => t.id));
  const merged = all.map((t) => (updatedIds.has(t.id) ? updated.find((u) => u.id === t.id)! : t));
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(merged));
}

export function clearBusinessTransactions(businessId: string): void {
  const transactions = getTransactions().filter((t) => t.businessId !== businessId);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function getBalance(businessId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = localStorage.getItem(`bizup_balance_${businessId}`);
  return raw ? parseFloat(raw) : 0;
}

export function setBalance(businessId: string, amount: number): void {
  localStorage.setItem(`bizup_balance_${businessId}`, String(amount));
  localStorage.setItem(`bizup_balance_updated_${businessId}`, new Date().toISOString());
}

export function getBalanceUpdatedAt(businessId: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`bizup_balance_updated_${businessId}`);
}

// Update an existing business (for edit modal)
export function updateBusiness(updated: Business): void {
  const businesses = getBusinesses().map((b) =>
    b.id === updated.id ? updated : b
  );
  localStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses));
}

// Delete a single transaction by ID
export function deleteTransaction(id: string): void {
  if (typeof window === "undefined") return;
  const all = getTransactions().filter((t) => t.id !== id);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(all));
}

// Hash a transaction to detect duplicates: date|description|amount
export function hashTransaction(t: Transaction): string {
  return `${t.date}|${t.description.trim().toLowerCase()}|${t.amount}`;
}

// Find which incoming transactions already exist for this business
export function findDuplicates(
  businessId: string,
  incoming: Transaction[]
): { duplicates: Transaction[]; unique: Transaction[] } {
  const existing = getTransactions(businessId);
  const existingHashes = new Set(existing.map(hashTransaction));
  const duplicates: Transaction[] = [];
  const unique: Transaction[] = [];
  for (const t of incoming) {
    if (existingHashes.has(hashTransaction(t))) duplicates.push(t);
    else unique.push(t);
  }
  return { duplicates, unique };
}

// Category budgets
const BUDGETS_KEY = (bizId: string) => `bizup_budgets_${bizId}`;

export function getCategoryBudgets(businessId: string): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(BUDGETS_KEY(businessId)) || "{}");
  } catch {
    return {};
  }
}

export function saveCategoryBudget(businessId: string, category: string, amount: number): void {
  const budgets = getCategoryBudgets(businessId);
  budgets[category] = amount;
  localStorage.setItem(BUDGETS_KEY(businessId), JSON.stringify(budgets));
}

// Merge rules for supplier/client name deduplication
const MERGES_KEY = (bizId: string) => `bizup_merges_${bizId}`;

export function getMergeRules(businessId: string): MergeRule[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MERGES_KEY(businessId)) || "[]");
  } catch {
    return [];
  }
}

export function saveMergeRule(businessId: string, rule: MergeRule): void {
  const rules = getMergeRules(businessId).filter((r) => r.id !== rule.id);
  rules.push(rule);
  localStorage.setItem(MERGES_KEY(businessId), JSON.stringify(rules));
}

export function deleteMergeRule(businessId: string, id: string): void {
  const rules = getMergeRules(businessId).filter((r) => r.id !== id);
  localStorage.setItem(MERGES_KEY(businessId), JSON.stringify(rules));
}

// Recurring overrides (manual edits to predicted amounts)
const RECURRING_OVERRIDES_KEY = (bizId: string) => `bizup_recurring_overrides_${bizId}`;

export function getRecurringOverrides(businessId: string): Record<string, RecurringOverride> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(RECURRING_OVERRIDES_KEY(businessId)) || "{}");
  } catch {
    return {};
  }
}

export function saveRecurringOverride(businessId: string, key: string, override: RecurringOverride): void {
  const overrides = getRecurringOverrides(businessId);
  overrides[key] = override;
  localStorage.setItem(RECURRING_OVERRIDES_KEY(businessId), JSON.stringify(overrides));
}

// ── First Look Analysis Cache ──────────────────────────────────────────────
const FIRST_LOOK_TTL = 7 * 24 * 60 * 60 * 1000;

export function getFirstLookAnalysis(businessId: string): import("@/types").FirstLookAnalysis | null {
  try {
    const raw = localStorage.getItem(`bizup_first_look_${businessId}`);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp > FIRST_LOOK_TTL) return null;
    return data as import("@/types").FirstLookAnalysis;
  } catch {
    return null;
  }
}

export function saveFirstLookAnalysis(businessId: string, analysis: import("@/types").FirstLookAnalysis): void {
  try {
    localStorage.setItem(
      `bizup_first_look_${businessId}`,
      JSON.stringify({ data: analysis, timestamp: Date.now() })
    );
  } catch { /* quota exceeded */ }
}

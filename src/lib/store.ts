import { Business, Transaction } from "@/types";
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

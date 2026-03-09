import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { CashFlowPoint, MonthlyStats, SupplierSummary, Transaction } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function groupByMonth(transactions: Transaction[]): MonthlyStats[] {
  const map: Record<string, { income: number; expenses: number }> = {};

  for (const t of transactions) {
    const key = t.date.substring(0, 7); // YYYY-MM
    if (!map[key]) map[key] = { income: 0, expenses: 0 };
    if (t.amount > 0) {
      map[key].income += t.amount;
    } else {
      map[key].expenses += Math.abs(t.amount);
    }
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expenses }]) => ({
      month,
      income,
      expenses,
      netProfit: income - expenses,
    }));
}

export function calcAverage(stats: MonthlyStats[], months: number): number {
  const slice = stats.slice(-months);
  if (slice.length === 0) return 0;
  return slice.reduce((s, m) => s + m.netProfit, 0) / slice.length;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function parseDate(raw: string): string {
  // Handle DD/MM/YYYY or DD.MM.YYYY
  const parts = raw.split(/[./\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (y.length === 4) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    if (d.length === 4) return `${d}-${m.padStart(2, "0")}-${y.padStart(2, "0")}`;
  }
  return raw;
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[₪,\s]/g, "");
  return parseFloat(cleaned) || 0;
}

/** Group expense transactions by category, returning total absolute amount per category */
export function groupByCategory(transactions: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of transactions) {
    if (t.amount < 0 && t.category) {
      map[t.category] = (map[t.category] || 0) + Math.abs(t.amount);
    }
  }
  return map;
}

/** Normalize a transaction description for supplier matching.
 *  Strips dates, reference numbers, and trailing digits. */
function normalizeSupplierName(description: string): string {
  return description
    .replace(/\d{2}[./\-]\d{2}[./\-]\d{2,4}/g, "") // dates
    .replace(/\b\d{4,}\b/g, "") // long number sequences (ref codes)
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 40);
}

/** Extract supplier summaries from expense transactions */
export function extractSuppliers(transactions: Transaction[]): SupplierSummary[] {
  const map: Record<string, { total: number; count: number; months: Set<string>; lastSeen: string }> = {};

  for (const t of transactions) {
    if (t.amount >= 0) continue; // income, skip
    const key = normalizeSupplierName(t.description);
    if (!key) continue;
    if (!map[key]) map[key] = { total: 0, count: 0, months: new Set(), lastSeen: t.date };
    map[key].total += Math.abs(t.amount);
    map[key].count += 1;
    map[key].months.add(t.date.substring(0, 7));
    if (t.date > map[key].lastSeen) map[key].lastSeen = t.date;
  }

  return Object.entries(map)
    .map(([name, { total, count, months, lastSeen }]) => ({
      name,
      totalPaid: total,
      transactionCount: count,
      avgAmount: total / count,
      lastSeen,
      isRecurring: months.size >= 3,
      months: Array.from(months).sort(),
    }))
    .sort((a, b) => b.totalPaid - a.totalPaid);
}

/** Detect recurring transactions: mark isRecurring=true if same normalized
 *  description appears in 3+ distinct months */
export function detectRecurring(transactions: Transaction[]): Transaction[] {
  const monthsByDesc: Record<string, Set<string>> = {};
  for (const t of transactions) {
    const key = normalizeSupplierName(t.description);
    if (!monthsByDesc[key]) monthsByDesc[key] = new Set();
    monthsByDesc[key].add(t.date.substring(0, 7));
  }
  return transactions.map((t) => {
    const key = normalizeSupplierName(t.description);
    return { ...t, isRecurring: (monthsByDesc[key]?.size ?? 0) >= 3 };
  });
}

/** Project monthly cash flow balance for the next N months.
 *  Uses: recurring expenses (fixed), avg variable expenses, avg income. */
export function projectCashFlow(
  transactions: Transaction[],
  currentBalance: number,
  months = 3
): CashFlowPoint[] {
  const stats = groupByMonth(transactions);
  if (stats.length === 0) return [];

  // Build actual history points (cumulative balance from first transaction)
  // We treat currentBalance as the balance at end of last known month
  const points: CashFlowPoint[] = stats.map((s, i) => {
    // Approximate cumulative: use currentBalance as anchor at last month
    const monthsFromEnd = stats.length - 1 - i;
    const approxBalance = currentBalance + monthsFromEnd * (s.income - s.expenses);
    return { month: s.month, balance: approxBalance, isProjected: false };
  });
  // Correct last point to be currentBalance
  if (points.length > 0) {
    points[points.length - 1].balance = currentBalance;
  }

  // Calculate averages for projection
  const recentStats = stats.slice(-6);
  const avgIncome = recentStats.reduce((s, m) => s + m.income, 0) / recentStats.length;
  const avgExpenses = recentStats.reduce((s, m) => s + m.expenses, 0) / recentStats.length;
  const avgNet = avgIncome - avgExpenses;

  // Generate future months
  const lastMonth = stats[stats.length - 1]?.month ?? new Date().toISOString().substring(0, 7);
  let balance = currentBalance;

  for (let i = 1; i <= months; i++) {
    const [year, month] = lastMonth.split("-").map(Number);
    const futureDate = new Date(year, month - 1 + i, 1);
    const futureMonth = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;
    balance += avgNet;
    points.push({ month: futureMonth, balance, isProjected: true });
  }

  return points;
}

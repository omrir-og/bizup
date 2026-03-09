import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { MonthlyStats, Transaction } from "@/types";

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

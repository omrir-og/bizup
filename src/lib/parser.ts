import { ParsedColumn, Transaction } from "@/types";
import { generateId, parseAmount, parseDate } from "./utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const DATE_KEYWORDS = ["תאריך", "date", "Date"];
const DESC_KEYWORDS = ["תיאור", "description", "פרטים", "אסמכתא", "Description"];
// Generic single-amount column keywords (excludes split credit/debit)
const AMOUNT_KEYWORDS = ["סכום", "amount", "Amount", "₪"];
// Split column keywords — credit = income (+), debit = expense (-)
const CREDIT_KEYWORDS = ["זכות", "זיכוי", "credit", "Credit", "income", "הכנסה", "deposit", "Deposit"];
const DEBIT_KEYWORDS = ["חובה", "חיוב", "debit", "Debit", "expense", "הוצאה", "withdrawal", "Withdrawal"];

function findHeader(rows: string[][]): { headerIdx: number; headers: string[] } {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const hasDate = row.some((c) => DATE_KEYWORDS.some((k) => c?.includes(k)));
    const hasDesc = row.some((c) => DESC_KEYWORDS.some((k) => c?.includes(k)));
    if (hasDate && hasDesc) return { headerIdx: i, headers: row };
  }
  return { headerIdx: 0, headers: rows[0] || [] };
}

function detectColumns(headers: string[]): {
  dateCol: number;
  descCol: number;
  amountCol: number;
  splitCols: { creditCol: number; debitCol: number } | null;
  usedFallback: boolean;
} {
  let dateCol = -1, descCol = -1, amountCol = -1;
  let creditCol = -1, debitCol = -1;
  let usedFallback = false;

  headers.forEach((h, i) => {
    const hNorm = (h ?? "").trim();
    if (dateCol === -1 && DATE_KEYWORDS.some((k) => hNorm.includes(k))) dateCol = i;
    if (descCol === -1 && DESC_KEYWORDS.some((k) => hNorm.includes(k))) descCol = i;
    if (amountCol === -1 && AMOUNT_KEYWORDS.some((k) => hNorm.includes(k))) amountCol = i;
    if (creditCol === -1 && CREDIT_KEYWORDS.some((k) => hNorm.includes(k))) creditCol = i;
    if (debitCol === -1 && DEBIT_KEYWORDS.some((k) => hNorm.includes(k))) debitCol = i;
  });

  // Only treat as split columns when the two indices are distinct —
  // a header like "זכות/חובה" matches both keywords on the same column,
  // which is a combined +/- column, not two separate columns.
  const splitCols =
    creditCol !== -1 && debitCol !== -1 && creditCol !== debitCol
      ? { creditCol, debitCol }
      : null;

  // If only split cols exist (no generic amount col), use creditCol as placeholder
  if (splitCols && amountCol === -1) amountCol = splitCols.creditCol;

  // Fallbacks when keywords don't match
  if (dateCol === -1) { dateCol = 0; usedFallback = true; }
  if (descCol === -1) { descCol = 1; usedFallback = true; }
  if (amountCol === -1) { amountCol = 2; usedFallback = true; }

  return { dateCol, descCol, amountCol, splitCols, usedFallback };
}

/** Sample up to 30 data rows and return parsed non-zero amounts */
function sampleAmounts(
  rows: string[][],
  startIdx: number,
  amountCol: number,
  splitCols: { creditCol: number; debitCol: number } | null
): number[] {
  const dataRows = rows.slice(startIdx, startIdx + 30).filter((r) => r?.some((c) => c?.trim()));
  if (splitCols) {
    return dataRows.flatMap((r) => {
      const c = parseAmount(r[splitCols.creditCol]?.trim() ?? "");
      const d = parseAmount(r[splitCols.debitCol]?.trim() ?? "");
      return [c, d].filter((v) => v !== 0);
    });
  }
  return dataRows.map((r) => parseAmount(r[amountCol]?.trim() ?? "")).filter((v) => v !== 0);
}

function rowsToTransactions(
  rows: string[][],
  startIdx: number,
  dateCol: number,
  descCol: number,
  amountCol: number,
  businessId: string,
  splitCols?: { creditCol: number; debitCol: number } | null
): Transaction[] {
  const transactions: Transaction[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const rawDate = row[dateCol]?.trim() ?? "";
    const desc = row[descCol]?.trim() ?? "";
    if (!rawDate || !desc) continue;

    let amount: number;
    if (splitCols) {
      // Credit (זכות) = income → positive; Debit (חובה) = expense → negative
      const credit = parseAmount(row[splitCols.creditCol]?.trim() ?? "");
      const debit = parseAmount(row[splitCols.debitCol]?.trim() ?? "");
      if (credit !== 0) amount = Math.abs(credit);        // income
      else if (debit !== 0) amount = -Math.abs(debit);    // expense
      else amount = 0;
    } else {
      amount = parseAmount(row[amountCol]?.trim() ?? "0");
    }

    transactions.push({
      id: generateId(),
      businessId,
      date: parseDate(rawDate),
      description: desc,
      amount,
    });
  }

  return transactions;
}

export interface ParseOverrides {
  dateCol?: number;
  descCol?: number;
  amountCol?: number;
  splitCols?: { creditCol: number; debitCol: number };
  /** When the file has all-positive amounts and user designates one column as expenses */
  expenseCol?: number;
}

export async function parseFile(
  file: File,
  businessId: string,
  overrides?: ParseOverrides
): Promise<{ columns: ParsedColumn; transactions: Transaction[] }> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  let rows: string[][] = [];

  if (ext === "csv") {
    const text = await file.text();
    const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
    rows = result.data as string[][];
  } else {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false }) as string[][];
  }

  const { headerIdx, headers } = findHeader(rows);
  const detected = detectColumns(headers);

  // Apply overrides if provided
  const dateCol = overrides?.dateCol ?? detected.dateCol;
  const descCol = overrides?.descCol ?? detected.descCol;
  const amountCol = overrides?.amountCol ?? detected.amountCol;
  const splitCols = overrides?.splitCols ?? detected.splitCols;

  // Determine ambiguity — only relevant when no override supplied
  let isAmbiguous = false;
  let ambiguityReason: string | undefined;

  if (!overrides) {
    if (detected.usedFallback) {
      isAmbiguous = true;
      ambiguityReason = "fallback_columns";
    } else if (!splitCols) {
      // Check if all sampled amounts are positive → can't distinguish income from expense
      const amounts = sampleAmounts(rows, headerIdx + 1, amountCol, null);
      if (amounts.length > 0 && amounts.every((a) => a > 0)) {
        isAmbiguous = true;
        ambiguityReason = "all_positive";
      }
    }
    // Split columns detected cleanly — not ambiguous, we handle them
  }

  let transactions: Transaction[];

  if (overrides?.expenseCol !== undefined) {
    // Special case: user designated a separate expense column on an all-positive file
    transactions = rows
      .slice(headerIdx + 1)
      .filter((r) => r?.some((c) => c?.trim()))
      .reduce<Transaction[]>((acc, row) => {
        const rawDate = row[dateCol]?.trim() ?? "";
        const desc = row[descCol]?.trim() ?? "";
        if (!rawDate || !desc) return acc;

        const incomeAmt = parseAmount(row[amountCol]?.trim() ?? "0");
        const expenseAmt = parseAmount(row[overrides.expenseCol!]?.trim() ?? "0");

        if (incomeAmt !== 0) {
          acc.push({ id: generateId(), businessId, date: parseDate(rawDate), description: desc, amount: Math.abs(incomeAmt) });
        }
        if (expenseAmt !== 0) {
          acc.push({ id: generateId(), businessId, date: parseDate(rawDate), description: desc, amount: -Math.abs(expenseAmt) });
        }
        return acc;
      }, []);
  } else {
    transactions = rowsToTransactions(rows, headerIdx + 1, dateCol, descCol, amountCol, businessId, splitCols);
  }

  const columns: ParsedColumn = {
    dateCol,
    descCol,
    amountCol,
    splitCols: splitCols ?? undefined,
    isAmbiguous,
    ambiguityReason,
    headers,
    preview: transactions.slice(0, 5),
  };

  return { columns, transactions };
}

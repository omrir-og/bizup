import { ParsedColumn, Transaction } from "@/types";
import { generateId, parseAmount, parseDate } from "./utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const DATE_KEYWORDS = ["תאריך", "date", "Date"];
const DESC_KEYWORDS = ["תיאור", "description", "פרטים", "אסמכתא", "Description"];
const AMOUNT_KEYWORDS = ["סכום", "זכות", "חובה", "amount", "Amount", "₪"];

function findHeader(rows: string[][]): { headerIdx: number; headers: string[] } {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const hasDate = row.some((c) => DATE_KEYWORDS.some((k) => c.includes(k)));
    const hasDesc = row.some((c) => DESC_KEYWORDS.some((k) => c.includes(k)));
    if (hasDate && hasDesc) {
      return { headerIdx: i, headers: row };
    }
  }
  return { headerIdx: 0, headers: rows[0] || [] };
}

function detectColumns(headers: string[]): { dateCol: number; descCol: number; amountCol: number } {
  let dateCol = -1, descCol = -1, amountCol = -1;

  headers.forEach((h, i) => {
    if (dateCol === -1 && DATE_KEYWORDS.some((k) => h.includes(k))) dateCol = i;
    if (descCol === -1 && DESC_KEYWORDS.some((k) => h.includes(k))) descCol = i;
    if (amountCol === -1 && AMOUNT_KEYWORDS.some((k) => h.includes(k))) amountCol = i;
  });

  // Fallback
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1;
  if (amountCol === -1) amountCol = 2;

  return { dateCol, descCol, amountCol };
}

function rowsToTransactions(
  rows: string[][],
  startIdx: number,
  dateCol: number,
  descCol: number,
  amountCol: number,
  businessId: string
): Transaction[] {
  const transactions: Transaction[] = [];

  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c || c.trim() === "")) continue;

    const rawDate = row[dateCol]?.trim() || "";
    const desc = row[descCol]?.trim() || "";
    const rawAmount = row[amountCol]?.trim() || "0";

    if (!rawDate || !desc) continue;

    const amount = parseAmount(rawAmount);
    const date = parseDate(rawDate);

    transactions.push({
      id: generateId(),
      businessId,
      date,
      description: desc,
      amount,
    });
  }

  return transactions;
}

export async function parseFile(
  file: File,
  businessId: string
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
  const { dateCol, descCol, amountCol } = detectColumns(headers);
  const transactions = rowsToTransactions(rows, headerIdx + 1, dateCol, descCol, amountCol, businessId);

  const columns: ParsedColumn = {
    dateCol,
    descCol,
    amountCol,
    headers,
    preview: transactions.slice(0, 5),
  };

  return { columns, transactions };
}

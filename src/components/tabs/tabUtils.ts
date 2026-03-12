import { TimeRange, Transaction } from "@/types";

export const truncate = (s: string, max: number): string =>
  s.length > max ? s.slice(0, max) + "…" : s;

export function filterByTimeRange(txs: Transaction[], range: TimeRange): Transaction[] {
  if (range === "all") return txs;
  const now = new Date();
  const [y, mo] = [now.getFullYear(), now.getMonth()];
  let boundary: Date;
  if (range === "month") boundary = new Date(y, mo, 1);
  else if (range === "3months") { const d = new Date(now); d.setMonth(d.getMonth() - 3); boundary = d; }
  else if (range === "6months") { const d = new Date(now); d.setMonth(d.getMonth() - 6); boundary = d; }
  else boundary = new Date(y, 0, 1);
  return txs.filter((tx) => {
    const [ty, tm, td] = tx.date.split("-").map(Number);
    return new Date(ty, tm - 1, td) >= boundary;
  });
}

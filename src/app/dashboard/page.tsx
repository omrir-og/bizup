"use client";

import { useApp } from "@/contexts/AppContext";
import DashboardContent from "@/components/DashboardContent";
import AppShell from "@/components/AppShell";

export default function DashboardPage() {
  const { transactions, businesses } = useApp();
  return (
    <AppShell>
      <DashboardContent
        transactions={transactions}
        businessName={businesses.length > 0 ? "All Businesses / מבט מאוחד" : undefined}
        businessId={null}
      />
    </AppShell>
  );
}

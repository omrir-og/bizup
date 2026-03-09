"use client";

import { use, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { getTransactions } from "@/lib/store";
import DashboardContent from "@/components/DashboardContent";
import AppShell from "@/components/AppShell";

export default function BusinessDashboardPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = use(params);
  const { businesses, setSelectedBusinessId } = useApp();

  useEffect(() => {
    setSelectedBusinessId(businessId);
  }, [businessId, setSelectedBusinessId]);

  const biz = businesses.find((b) => b.id === businessId);
  const transactions = getTransactions(businessId);

  return (
    <AppShell>
      <DashboardContent
        transactions={transactions}
        businessName={biz?.name}
        businessId={businessId}
        business={biz}
      />
    </AppShell>
  );
}

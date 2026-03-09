"use client";

import { useApp } from "@/contexts/AppContext";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { t } from "@/lib/translations";

export default function InsightsRedirectPage() {
  const { businesses, lang } = useApp();
  const router = useRouter();
  const tr = t[lang];

  return (
    <AppShell>
      <div className="p-8 max-w-xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">{tr.selectBusiness}</h1>
        <div className="space-y-3">
          {businesses.map((biz) => (
            <button
              key={biz.id}
              onClick={() => router.push(`/insights/${biz.id}`)}
              className="w-full bg-white border border-gray-200 rounded-xl p-4 text-start hover:border-blue-400 hover:shadow-md transition-all"
            >
              <p className="font-semibold text-gray-800">{biz.name}</p>
              <p className="text-sm text-gray-400 capitalize">{biz.industry}</p>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

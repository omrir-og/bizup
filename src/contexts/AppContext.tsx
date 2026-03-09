"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Business, Language, Transaction } from "@/types";
import { getBusinesses, getTransactions, saveBusiness, deleteBusiness, saveTransactions } from "@/lib/store";

interface AppContextType {
  lang: Language;
  setLang: (l: Language) => void;
  dir: "rtl" | "ltr";
  businesses: Business[];
  selectedBusinessId: string | null;
  setSelectedBusinessId: (id: string | null) => void;
  transactions: Transaction[];
  addBusiness: (b: Omit<Business, "id" | "createdAt">) => Business;
  removeBusiness: (id: string) => void;
  importTransactions: (txs: Transaction[]) => void;
  refreshData: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("he");
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const refreshData = useCallback(() => {
    const biz = getBusinesses();
    setBusinesses(biz);
    const txs = selectedBusinessId
      ? getTransactions(selectedBusinessId)
      : getTransactions();
    setTransactions(txs);
  }, [selectedBusinessId]);

  useEffect(() => {
    const stored = localStorage.getItem("bizup_lang") as Language | null;
    if (stored) setLangState(stored);
    refreshData();
  }, []);

  useEffect(() => {
    refreshData();
  }, [selectedBusinessId, refreshData]);

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("bizup_lang", l);
  };

  const addBusiness = (b: Omit<Business, "id" | "createdAt">) => {
    const nb = saveBusiness(b);
    setBusinesses((prev) => [...prev, nb]);
    return nb;
  };

  const removeBusiness = (id: string) => {
    deleteBusiness(id);
    setBusinesses((prev) => prev.filter((b) => b.id !== id));
    if (selectedBusinessId === id) setSelectedBusinessId(null);
  };

  const importTransactions = (txs: Transaction[]) => {
    saveTransactions(txs);
    refreshData();
  };

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        dir: lang === "he" ? "rtl" : "ltr",
        businesses,
        selectedBusinessId,
        setSelectedBusinessId,
        transactions,
        addBusiness,
        removeBusiness,
        importTransactions,
        refreshData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

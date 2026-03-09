"use client";

import { useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import Sidebar from "./Sidebar";
import ChatWidget from "./ChatWidget";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { dir, lang } = useApp();

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
  }, [dir, lang]);

  return (
    <div
      className="flex h-screen bg-gray-50 overflow-hidden"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}

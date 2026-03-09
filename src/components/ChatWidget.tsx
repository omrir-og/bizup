"use client";

import { useState, useRef, useEffect } from "react";
import { useApp } from "@/contexts/AppContext";
import { t } from "@/lib/translations";
import { MessageCircle, X, Send, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { groupByMonth, formatCurrency } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { lang, dir, transactions, businesses, selectedBusinessId } = useApp();
  const tr = t[lang];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildContext = () => {
    const biz = businesses.find((b) => b.id === selectedBusinessId);
    const txs = selectedBusinessId
      ? transactions.filter((t) => t.businessId === selectedBusinessId)
      : transactions;
    const stats = groupByMonth(txs);
    const totalIncome = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const totalExpenses = txs.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const netProfit = totalIncome - totalExpenses;

    return `Business: ${biz?.name || "All Businesses"}
Industry: ${biz?.industry || "N/A"}
Total Income: ${formatCurrency(totalIncome)}
Total Expenses: ${formatCurrency(totalExpenses)}
Net Profit: ${formatCurrency(netProfit)}
Monthly breakdown: ${stats.slice(-3).map((s) => `${s.month}: profit=${formatCurrency(s.netProfit)}`).join(", ")}
Number of transactions: ${txs.length}`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: buildContext(),
          lang,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.content }]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: lang === "he" ? "שגיאה, נסה שנית" : "Error, please try again" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceReview = async () => {
    setLoading(true);
    const voicePrompt = lang === "he"
      ? "צור סקירה קולית של 30 שניות על מצב העסק"
      : "Create a 30-second voice review of the business status";

    const userMsg: Message = { role: "user", content: voicePrompt };
    setMessages((m) => [...m, userMsg]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          context: buildContext(),
          lang,
          voiceMode: true,
        }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.content }]);
    } catch {
      null;
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-all",
          dir === "rtl" ? "left-6" : "right-6",
          open && "hidden"
        )}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed bottom-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200",
            dir === "rtl" ? "left-6" : "right-6"
          )}
          dir={dir}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-blue-600 text-white rounded-t-2xl">
            <span className="font-semibold">{tr.aiChat}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleVoiceReview}
                className="flex items-center gap-1 text-xs bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded-lg"
                title={tr.voiceReview}
              >
                <Mic className="w-3 h-3" />
                {tr.voiceReview}
              </button>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center mt-8">{tr.aiPlaceholder}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
                  m.role === "user"
                    ? "bg-blue-600 text-white ms-auto"
                    : "bg-gray-100 text-gray-800"
                )}
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-gray-100 text-gray-800 max-w-[80%] px-4 py-2 rounded-2xl text-sm">
                <span className="animate-pulse">...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder={tr.aiPlaceholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={loading}
              className="bg-blue-600 text-white rounded-xl p-2 hover:bg-blue-700 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, context, lang, voiceMode, categorizeMode, insightsMode, firstLookMode, cleanMode, pageInsightMode, pageType, descriptions, customCategories } = await req.json();

  // ── Categorize mode: batch-label transaction descriptions ──
  if (categorizeMode && descriptions) {
    const defaultExpenseCategories = lang === "he"
      ? ["שכר", "שכירות", "שיווק", "תוכנה", "חשמל ומים", "בנק ועמלות", "ביטוח", "מלאי", "שירותים מקצועיים", "נסיעות", "אוכל", "משרד", "הלוואת בעלים", "משיכת בעלים", "הפרשת דיבידנדים", "אחר"]
      : ["Salaries", "Rent", "Marketing", "Software", "Utilities", "Banking & Fees", "Insurance", "Inventory", "Professional Services", "Travel", "Food", "Office", "Owner Loan", "Owner Withdrawal", "Dividend Provision", "Other"];
    const defaultIncomeCategories = lang === "he"
      ? ["תשלום לקוח", "הלוואה", "החזר מס", "השקעה", "מענק", "הכנסה אחרת"]
      : ["Client Payment", "Loan", "Tax Refund", "Investment", "Grant", "Other Income"];
    const allCategories: string[] = customCategories && customCategories.length > 0
      ? customCategories
      : [...defaultExpenseCategories, ...defaultIncomeCategories];

    const prompt = lang === "he"
      ? `אתה מסווג עסקאות בנקאיות לקטגוריות. הקטגוריות האפשריות: ${allCategories.join(", ")}.
קבל רשימת תיאורי עסקאות והחזר JSON בלבד בפורמט: {"description": "category"}
אל תוסיף הסברים, רק JSON.
תיאורים המסומנים ב"+" הם הכנסות — השתמש בקטגוריות ההכנסה.
תיאורים המסומנים ב"-" הם הוצאות — השתמש בקטגוריות ההוצאה.

תיאורים לסיווג:
${(descriptions as string[]).join("\n")}`
      : `You are categorizing bank transactions. Categories: ${allCategories.join(", ")}.
Given a list of transaction descriptions, return JSON only in format: {"description": "category"}
No explanations, JSON only.
Descriptions prefixed with "+" are income — use income categories.
Descriptions prefixed with "-" are expenses — use expense categories.

Descriptions to categorize:
${(descriptions as string[]).join("\n")}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const stripped = text.replace(/^```json\n?|```$/gm, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return NextResponse.json({ categories: result });
    } catch {
      return NextResponse.json({ categories: {} });
    }
  }

  if (cleanMode && descriptions) {
    const prompt = lang === "he"
      ? `אתה מנקה תיאורי עסקאות בנקאיות ישראליות.
הסר: מספרי סניפים, מספרי חשבונות, קידומות כמו "הע.", "העברה מ/ל", "חיוב", "זיכוי".
השאר רק את שם הגורם העיקרי.
דוגמאות:
"הע. לנוף המושבה פת בסניף 31-095" → "נוף המושבה פת"
"העברה מתמוז סחר (1983) חשבון 12-159-0005-000170753" → "תמוז סחר"
"מס הכנסה ע חיוב" → "מס הכנסה"
"ביט' לאומי חיוב" → "ביט לאומי"

קבל מערך JSON של תיאורים, החזר JSON בלבד בפורמט: {"original": "cleaned"}

תיאורים לניקוי:
${JSON.stringify(descriptions)}`
      : `You are cleaning bank transaction descriptions.
Remove: branch numbers, account numbers, prefixes like "transfer from/to", "charge", "credit".
Keep only the main entity name.

Receive a JSON array of descriptions, return JSON only: {"original": "cleaned"}

Descriptions to clean:
${JSON.stringify(descriptions)}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const stripped = text.replace(/^```json\n?|```$/gm, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return NextResponse.json({ cleaned: result });
    } catch {
      return NextResponse.json({ cleaned: {} });
    }
  }

  // ── Insights mode: deep AI analysis ──
  if (insightsMode && context) {
    const prompt = lang === "he"
      ? `אתה יועץ פיננסי למנהל עסק קטן-בינוני. נתח את הנתונים הבאים ספק תגובה כ-JSON בלבד:
{
  "savings": ["הזדמנות חיסכון ספציפית 1 עם סכום", "הזדמנות 2", "הזדמנות 3"],
  "anomalies": ["חריגה שזוהתה 1", "חריגה 2"],
  "growth": ["המלצה לצמיחה 1", "המלצה 2"],
  "healthScore": 75,
  "healthReason": "הסבר קצר לציון"
}

נתוני העסק:
${context}`
      : `You are a financial advisor for an SMB owner. Analyze the data and respond with JSON only:
{
  "savings": ["Specific saving opportunity 1 with amount", "Opportunity 2", "Opportunity 3"],
  "anomalies": ["Anomaly detected 1", "Anomaly 2"],
  "growth": ["Growth recommendation 1", "Recommendation 2"],
  "healthScore": 75,
  "healthReason": "Brief explanation of score"
}

Business data:
${context}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return NextResponse.json({ analysis: result });
    } catch {
      return NextResponse.json({ analysis: null });
    }
  }

  if (firstLookMode && context) {
    const schema = `{
  "isProfitable": true,
  "currentProfitSummary": "...",
  "bestMonth": "YYYY-MM",
  "bestMonthProfit": 0,
  "bestMonthReason": "...",
  "profitabilityShifts": [{ "month": "YYYY-MM", "changeType": "expense_spike|income_drop|new_supplier|salary_increase|client_loss", "description": "...", "amount": 0 }],
  "supplierChanges": ["..."],
  "topExpenseCategory": "...",
  "topExpenseCategoryAmount": 0,
  "topExpenseCategoryPercent": 0,
  "categoryClassifications": [{ "category": "...", "type": "mandatory|discretionary", "reason": "..." }],
  "operatingProfit": 0,
  "operatingProfitExplanation": "...",
  "nextMonthPredictedIncome": 0,
  "nextMonthPredictedExpenses": 0,
  "nextMonthPredictedProfit": 0,
  "nextMonthConfidence": "high|medium|low",
  "nextMonthNote": "...",
  "healthScore": 75,
  "healthReason": "...",
  "dataQualityNote": null
}`;

    const prompt = lang === "he"
      ? `אתה אנליסט פיננסי מומחה לעסקים קטנים-בינוניים ישראלים.
נתח את הנתונים והחזר אובייקט JSON אחד בלבד — ללא טקסט אחר.

חוקים:
- profitabilityShifts: עד 3 חודשים עם שינוי של 15%+ ברווח לעומת החודש הקודם
- categoryClassifications: סווג כל קטגוריה; "mandatory" = לא ניתן לוותר (שכירות, שכר, ביטוח, חשמל, בנק, מס); "discretionary" = ניתן לצמצם
- operatingProfit: הכנסות חוזרות בניכוי הוצאות תפעוליות חוזרות (לא כולל בנק ומסים), ממוצע חודשי
- nextMonthConfidence: "low" אם פחות מ-3 חודשי נתונים
- dataQualityNote: null אם 6+ חודשים; אחרת הסבר המגבלה
- כל הסכומים ב-ILS

מבנה JSON:
${schema}

נתוני העסק:
${context}`
      : `You are an expert financial analyst for Israeli SMB owners.
Analyze the data and return ONE JSON object only — no other text.

Rules:
- profitabilityShifts: up to 3 months with >15% profit swing vs prior month
- categoryClassifications: classify EVERY category; "mandatory" = cannot cut (rent, salaries, insurance, utilities, bank, taxes); "discretionary" = can reduce
- operatingProfit: recurring income minus recurring opex (excl. banking/taxes); monthly average
- nextMonthConfidence: "low" if fewer than 3 months of data
- dataQualityNote: null if 6+ months; otherwise describe the limitation
- all amounts in ILS

Required JSON:
${schema}

Business data:
${context}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const stripped = text.replace(/^```json\n?|```$/gm, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      return NextResponse.json({ analysis: result });
    } catch {
      return NextResponse.json({ analysis: null });
    }
  }

  // ── Page insight mode: AI summary for Categories/Suppliers/Clients/CashFlow ──
  if (pageInsightMode && context && pageType) {
    const pageLabels: Record<string, { he: string; en: string }> = {
      categories: { he: "קטגוריות", en: "categories" },
      suppliers: { he: "ספקים", en: "suppliers" },
      clients: { he: "לקוחות", en: "clients" },
      cashflow: { he: "תזרים מזומנים", en: "cash flow" },
    };
    const label = pageLabels[pageType]?.[lang as "he" | "en"] || pageType;

    const prompt = lang === "he"
      ? `אתה BizUp AI — אנליסט פיננסי לבעלי עסקים.
נתח את נתוני ${label} הבאים וספק תגובה כ-JSON בלבד:
{
  "summary": "סיכום של 2-3 משפטים על מה שהנתונים מראים",
  "alerts": [
    { "type": "anomaly|recommendation|positive", "text": "טקסט התראה קצר" }
  ]
}
מקסימום 3 התראות. ציין מספרים ספציפיים. ללא ז'רגון.

נתונים:
${context}`
      : `You are BizUp AI — a financial analyst for business owners.
Analyze the following ${label} data and respond with JSON only:
{
  "summary": "2-3 sentence summary of what the data shows",
  "alerts": [
    { "type": "anomaly|recommendation|positive", "text": "short alert text" }
  ]
}
Maximum 3 alerts. Be specific with numbers. No jargon.

Data:
${context}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const stripped = text.replace(/^```json\n?|```$/gm, "").trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return NextResponse.json({ insight: result });
    } catch {
      return NextResponse.json({ insight: null });
    }
  }

  // ── Chat mode (default) ──
  const systemPrompt = lang === "he"
    ? `אתה עוזר פיננסי חכם לבעלי עסקים קטנים ובינוניים.
אתה מנתח נתוני בנק ומספק תובנות מעשיות.
ענה תמיד בעברית, בצורה תמציתית ומקצועית.
${voiceMode ? "צור סקירה קולית קצרה (30 שניות) של מצב העסק - ידידותית ועניינית." : ""}
נתוני העסק הנוכחי:\n${context}`
    : `You are a smart financial assistant for SMB owners.
You analyze bank data and provide actionable insights.
Always respond in English, concisely and professionally.
${voiceMode ? "Create a short voice review (30 seconds) of the business status - friendly and on-point." : ""}
Current business data:\n${context}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const content = response.content[0].type === "text" ? response.content[0].text : "";
  return NextResponse.json({ content });
}

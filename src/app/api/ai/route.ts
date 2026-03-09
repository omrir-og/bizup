import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, context, lang, voiceMode, categorizeMode, insightsMode, descriptions } = await req.json();

  // ── Categorize mode: batch-label transaction descriptions ──
  if (categorizeMode && descriptions) {
    const categories = [
      "Salaries", "Rent", "Marketing", "Software", "Utilities",
      "Banking & Fees", "Insurance", "Inventory", "Professional Services",
      "Travel", "Food", "Office", "Other"
    ];
    const catHe = [
      "שכר", "שכירות", "שיווק", "תוכנה", "חשמל ומים",
      "בנק ועמלות", "ביטוח", "מלאי", "שירותים מקצועיים",
      "נסיעות", "אוכל", "משרד", "אחר"
    ];
    const catList = lang === "he" ? catHe : categories;

    const prompt = lang === "he"
      ? `אתה מסווג עסקאות בנקאיות לקטגוריות. הקטגוריות האפשריות: ${catList.join(", ")}.
קבל רשימת תיאורי עסקאות והחזר JSON בלבד בפורמט: {"description": "category"}
אל תוסיף הסברים, רק JSON.

תיאורים לסיווג:
${(descriptions as string[]).join("\n")}`
      : `You are categorizing bank transactions. Categories: ${catList.join(", ")}.
Given a list of transaction descriptions, return JSON only in format: {"description": "category"}
No explanations, JSON only.

Descriptions to categorize:
${(descriptions as string[]).join("\n")}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "{}";
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const result = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
      return NextResponse.json({ categories: result });
    } catch {
      return NextResponse.json({ categories: {} });
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

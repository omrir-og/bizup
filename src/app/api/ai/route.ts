import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { messages, context, lang, voiceMode } = await req.json();

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

import { TRPCError } from "@trpc/server";
import { GoogleGenAI } from "@google/genai";

export type ChatHistoryMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
};

const SYSTEM_INSTRUCTION = [
  "You are a helpful health assistant.",
  "Be clear and actionable. Ask 1-2 clarifying questions if needed.",
  "You are not a doctor. Include a short safety disclaimer when giving medical advice.",
  "If there are urgent symptoms, advise seeking urgent medical care.",
  "Do not request or store unnecessary personal data.",
].join("\n");

function toGeminiContents(messages: ChatHistoryMessage[]): string {
  return messages
    .map(m => {
      const tag = m.role === "ASSISTANT" ? "Assistant" : m.role === "USER" ? "User" : "System";
      return `${tag}: ${m.content}`;
    })
    .join("\n\n");
}

export async function generateChatReply(params: {
  messages: Array<{ role: "USER" | "ASSISTANT" | "SYSTEM"; content: string }>;
}): Promise<{ content: string; model: string }> {
  const apiKey = process.env["GOOGLE_GENAI_API_KEY"] ?? process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Missing Google GenAI API key (set GOOGLE_GENAI_API_KEY or GEMINI_API_KEY).",
    });
  }

  const model = process.env["GEMINI_CHAT_MODEL"] ?? process.env["GEMINI_ADVICE_MODEL"] ?? "gemini-2.5-flash";
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model,
    contents: toGeminiContents(params.messages),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.4,
      maxOutputTokens: 512,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Empty AI response." });
  }

  return { content: text, model };
}


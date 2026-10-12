import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = [
  "Answer the user's actual request directly and concisely.",
  "Use the same language as the user's latest message unless they request another language.",
  "For translation requests, provide the requested translation without an introduction, capability list, unrelated explanation, or unsolicited alternatives.",
  "For simple questions, answer briefly. Give detail only when requested or genuinely needed.",
  "Use Markdown formatting when it improves readability.",
].join(" ");

let openrouter;
let groq;
let gemini;

function getOpenRouter() {
  openrouter ??= new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    timeout: 60000,
    maxRetries: 0,
  });
  return openrouter;
}

function getGroq() {
  groq ??= new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: 60000,
    maxRetries: 0,
  });
  return groq;
}

function getGemini() {
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return gemini;
}

export const providers = [
  {
    name: "OpenRouter",
    enabled: () => Boolean(process.env.OPENROUTER_API_KEY),
    stream: async function* (messages) {
      const result = await getOpenRouter().chat.completions.create({
        model: process.env.OPENROUTER_MODEL || "openrouter/free",
        messages,
        stream: true,
      });
      for await (const chunk of result) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) yield text;
      }
    },
  },
  {
    name: "Groq",
    enabled: () => Boolean(process.env.GROQ_API_KEY),
    stream: async function* (messages) {
      const result = await getGroq().chat.completions.create({
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        messages,
        stream: true,
      });
      for await (const chunk of result) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (typeof text === "string" && text) yield text;
      }
    },
  },
  {
    name: "Gemini",
    enabled: () => Boolean(process.env.GEMINI_API_KEY),
    stream: async function* (messages) {
      const contents = messages
        .filter((item) => item.role !== "system")
        .map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: String(item.content ?? "") }],
        }));
      const result = await getGemini().models.generateContentStream({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
      for await (const chunk of result) {
        const text = chunk.text || "";
        if (text) yield text;
      }
    },
  },
];

export async function* generateReplyStream(messages) {
  // Add this per request; system instructions are never part of stored history.
  const providerMessages = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...messages.filter((item) => item.role !== "system"),
  ];
  const errors = [];
  for (const provider of providers) {
    if (!provider.enabled()) {
      console.log(`${provider.name}: API key missing; skipping`);
      continue;
    }
    let yieldedAny = false;
    try {
      console.log(`${provider.name}: trying request`);
      for await (const text of provider.stream(providerMessages)) {
        if (text) {
          yieldedAny = true;
          yield { provider: provider.name, text };
        }
      }
      if (yieldedAny) {
        console.log(`${provider.name}: response completed`);
        return;
      }
      errors.push(`${provider.name}: empty response`);
      console.log(`${provider.name}: empty response`);
    } catch (error) {
      console.error(`${provider.name} failed:`, error.status || error.message);
      if (yieldedAny) throw new Error(`${provider.name} failed after streaming began`);
      errors.push(`${provider.name}: ${error.status || error.message}`);
    }
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

export async function generateReply(messages) {
  let reply = "";
  for await (const part of generateReplyStream(messages)) reply += part.text;
  if (!reply.trim()) throw new Error("All providers returned an empty response");
  return reply;
}

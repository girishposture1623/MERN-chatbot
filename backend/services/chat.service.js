import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = [
  "Answer the user's actual request directly and concisely.",
  "Use the same language as the user's latest message unless they request another language.",
  "For translation requests, provide the requested translation without an introduction, capability list, unrelated explanation, or unsolicited alternatives.",
  "For simple questions, answer briefly. Give detail only when requested or genuinely needed.",
  "Use Markdown formatting when it improves readability.",
].join(" ");
const OPENROUTER_DEFAULT_MODEL = "google/gemma-4-31b-it:free";

export function extractOpenAIText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (
        (part?.type === "text" || part?.type === "output_text") &&
        typeof part.text === "string"
      ) {
        return part.text;
      }
      return "";
    })
    .join("");
}

function getOpenRouterModel() {
  const configuredModel = process.env.OPENROUTER_MODEL?.trim();
  return configuredModel && configuredModel !== "openrouter/free"
    ? configuredModel
    : OPENROUTER_DEFAULT_MODEL;
}

function getGroqModel() {
  return process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function providerErrorInfo(error) {
  const status = Number.isInteger(error?.status) ? error.status : undefined;
  const code =
    typeof error?.code === "string" && /^[a-z0-9_-]{1,64}$/i.test(error.code)
      ? error.code
      : undefined;
  return {
    ...(status ? { status } : {}),
    ...(code ? { code } : {}),
    category:
      status === 401 || status === 403
        ? "authentication_or_permission"
        : status === 429
          ? "rate_limited_or_quota"
          : status && status >= 500
            ? "provider_server_error"
            : "request_failed",
  };
}

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
        model: getOpenRouterModel(),
        messages,
        stream: true,
      });
      for await (const chunk of result) {
        const delta = chunk?.choices?.[0]?.delta;
        const text = extractOpenAIText(delta?.content) || delta?.refusal || "";
        if (typeof text === "string" && text) yield text;
      }
    },
    model: getOpenRouterModel,
  },
  {
    name: "Groq",
    enabled: () => Boolean(process.env.GROQ_API_KEY),
    stream: async function* (messages) {
      const result = await getGroq().chat.completions.create({
        model: getGroqModel(),
        messages,
        stream: true,
      });
      for await (const chunk of result) {
        const delta = chunk?.choices?.[0]?.delta;
        const text = extractOpenAIText(delta?.content) || delta?.refusal || "";
        if (typeof text === "string" && text) yield text;
      }
    },
    model: getGroqModel,
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
        model: getGeminiModel(),
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
      for await (const chunk of result) {
        const text = typeof chunk?.text === "string" ? chunk.text : "";
        if (text) yield text;
      }
    },
    model: getGeminiModel,
  },
];

export function getProviderDiagnostics() {
  return providers.map((provider) => ({
    name: provider.name,
    configured: provider.enabled(),
    model: provider.model(),
  }));
}

export async function* generateReplyStream(messages) {
  // Add this per request; system instructions are never part of stored history.
  const providerMessages = [
    { role: "system", content: SYSTEM_INSTRUCTION },
    ...messages.filter((item) => item.role !== "system"),
  ];
  const errors = [];
  for (const provider of providers) {
    if (!provider.enabled()) {
      console.info(`[ai] ${provider.name}: skipped (API key not configured)`);
      continue;
    }
    let yieldedAny = false;
    try {
      console.info(`[ai] ${provider.name}: request started (model=${provider.model()})`);
      let leadingWhitespace = "";
      for await (const text of provider.stream(providerMessages)) {
        if (typeof text !== "string" || !text) continue;

        if (!yieldedAny) {
          leadingWhitespace += text;
          if (!leadingWhitespace.trim()) continue;
          yieldedAny = true;
          yield { provider: provider.name, text: leadingWhitespace };
          leadingWhitespace = "";
        } else {
          yieldedAny = true;
          yield { provider: provider.name, text };
        }
      }
      if (yieldedAny) {
        console.info(`[ai] ${provider.name}: response completed`);
        return;
      }
      errors.push(`${provider.name}: empty response`);
      console.warn(`[ai] ${provider.name}: empty or malformed response`);
    } catch (error) {
      const info = providerErrorInfo(error);
      console.error(`[ai] ${provider.name}: request failed`, info);
      if (yieldedAny) {
        throw new Error(`${provider.name} failed after response streaming began`);
      }
      errors.push(`${provider.name}: ${info.category}${info.status ? ` (HTTP ${info.status})` : ""}`);
    }
  }
  if (!errors.length) {
    throw new Error("No AI provider is configured; all provider API keys are missing");
  }
  throw new Error(`All AI providers failed. ${errors.join(" | ")}`);
}

export async function generateReply(messages) {
  let reply = "";
  for await (const part of generateReplyStream(messages)) reply += part.text;
  if (!reply.trim()) throw new Error("All providers returned an empty response");
  return reply;
}

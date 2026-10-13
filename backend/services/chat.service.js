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
  return process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

const SECRET_KEY_PATTERN = /(?:Bearer\s+)[A-Za-z0-9._~+/=-]+|\bsk-[A-Za-z0-9_-]{12,}\b|\bAIza[A-Za-z0-9_-]{20,}\b/gi;
const REDACTED_ERROR_FIELDS = /(?:api.?key|authorization|secret|token|prompt|content|input|credential)/i;

function redactDiagnosticText(value) {
  return String(value).replace(SECRET_KEY_PATTERN, "[REDACTED]").slice(0, 1200);
}

function sanitizeDiagnosticValue(value, depth = 0) {
  if (typeof value === "string") return redactDiagnosticText(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (depth >= 5) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 12).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value !== "object") return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !REDACTED_ERROR_FIELDS.test(key))
      .slice(0, 30)
      .map(([key, item]) => [key, sanitizeDiagnosticValue(item, depth + 1)])
  );
}

function getProviderErrorBody(error) {
  let body = error?.error ?? error?.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return redactDiagnosticText(body);
    }
  }
  return body && typeof body === "object" ? sanitizeDiagnosticValue(body) : undefined;
}

function getRateLimitHeaders(headers) {
  if (!headers) return undefined;
  const selected = {};
  const allowHeader = (name) =>
    name === "retry-after" || name === "retry-after-ms" || name === "x-request-id" ||
    name === "request-id" || name.startsWith("x-ratelimit-") || name.startsWith("ratelimit-");

  if (typeof headers.forEach === "function") {
    headers.forEach((value, name) => {
      const normalizedName = String(name).toLowerCase();
      if (allowHeader(normalizedName)) selected[normalizedName] = redactDiagnosticText(value);
    });
  } else if (typeof headers === "object") {
    for (const [name, value] of Object.entries(headers)) {
      const normalizedName = name.toLowerCase();
      if (allowHeader(normalizedName)) selected[normalizedName] = redactDiagnosticText(value);
    }
  }
  return Object.keys(selected).length ? selected : undefined;
}

export function summarizeProviderError(error) {
  const status = Number.isInteger(error?.status) ? error.status : undefined;
  const code =
    typeof error?.code === "string" && /^[a-z0-9_-]{1,64}$/i.test(error.code)
      ? error.code
      : undefined;
  const body = getProviderErrorBody(error);
  const headers = getRateLimitHeaders(error?.headers ?? error?.response?.headers);
  const requestId = typeof error?.requestID === "string"
    ? redactDiagnosticText(error.requestID)
    : undefined;
  return {
    ...(status ? { status } : {}),
    ...(code ? { code } : {}),
    ...(body ? { body } : {}),
    ...(headers ? { headers } : {}),
    ...(requestId ? { requestId } : {}),
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
  gemini ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    apiVersion: "v1beta",
    httpOptions: { baseUrl: "https://generativelanguage.googleapis.com" },
  });
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
      const info = summarizeProviderError(error);
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

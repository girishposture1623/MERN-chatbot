import test from "node:test";
import assert from "node:assert/strict";
import { generateReplyStream, providers, summarizeProviderError } from "../services/chat.service.js";

test("provider fallback continues after an HTTP error and streams the next provider", async () => {
  const originalStreams = providers.map((provider) => provider.stream);
  const keyNames = ["OPENROUTER_API_KEY", "GROQ_API_KEY", "GEMINI_API_KEY"];
  const originalKeys = Object.fromEntries(keyNames.map((name) => [name, process.env[name]]));
  keyNames.forEach((name) => { process.env[name] = "test-only-key"; });
  providers[0].stream = async function* () {
    throw Object.assign(new Error("429 too many requests"), { status: 429 });
  };
  providers[1].stream = async function* () {
    yield "Hello";
    yield " there";
  };
  providers[2].stream = async function* () {
    assert.fail("Gemini must not run after Groq returns text");
  };

  try {
    const received = [];
    for await (const part of generateReplyStream([{ role: "user", content: "Hi" }])) {
      received.push(part);
    }
    assert.deepEqual(received, [
      { provider: "Groq", text: "Hello" },
      { provider: "Groq", text: " there" },
    ]);
  } finally {
    providers.forEach((provider, index) => { provider.stream = originalStreams[index]; });
    for (const name of keyNames) {
      if (originalKeys[name] === undefined) delete process.env[name];
      else process.env[name] = originalKeys[name];
    }
  }
});

test("provider error diagnostics include rate headers and redact secrets", () => {
  const diagnostics = summarizeProviderError({
    status: 429,
    code: "rate_limit_exceeded",
    error: {
      message: "quota blocked",
      metadata: { reason: "free_model_daily_limit", limit_source: "rate_limit" },
      api_key: "sk-or-v1-never-log-this-secret",
    },
    headers: new Headers({
      "retry-after": "30",
      "x-ratelimit-limit-requests": "20",
      authorization: "Bearer do-not-log-this",
    }),
  });

  assert.equal(diagnostics.status, 429);
  assert.equal(diagnostics.body.metadata.reason, "free_model_daily_limit");
  assert.equal(diagnostics.headers["retry-after"], "30");
  assert.equal(diagnostics.headers["x-ratelimit-limit-requests"], "20");
  assert.equal(JSON.stringify(diagnostics).includes("never-log-this-secret"), false);
  assert.equal(JSON.stringify(diagnostics).includes("do-not-log-this"), false);
  assert.equal(diagnostics.category, "rate_limited_or_quota");
});

test("provider model defaults use currently documented Groq and Gemini model IDs", () => {
  const originalGroq = process.env.GROQ_MODEL;
  const originalGemini = process.env.GEMINI_MODEL;
  delete process.env.GROQ_MODEL;
  delete process.env.GEMINI_MODEL;
  try {
    assert.equal(providers.find(({ name }) => name === "Groq").model(), "openai/gpt-oss-120b");
    assert.equal(providers.find(({ name }) => name === "Gemini").model(), "gemini-3.8-flash");
  } finally {
    if (originalGroq === undefined) delete process.env.GROQ_MODEL;
    else process.env.GROQ_MODEL = originalGroq;
    if (originalGemini === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalGemini;
  }
});

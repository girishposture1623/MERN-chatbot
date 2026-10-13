import test from "node:test";
import assert from "node:assert/strict";
import { generateReplyStream, providers, summarizeProviderError } from "../services/chat.service.js";
import { addTinyFishSearchContext } from "../services/tinyfish.service.js";
import { buildCorsOptions } from "../config/cors.js";

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

test("TinyFish is called only for explicit web searches and its results enrich a copied prompt", async () => {
  const originalKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = "tinyfish-test-key";
  const messages = [{ role: "user", content: "Can you search the web for current MERN guidance?" }];
  let requestedUrl;
  let requestedKey;
  try {
    const enriched = await addTinyFishSearchContext(messages, async (url, options) => {
      requestedUrl = new URL(url);
      requestedKey = options.headers["X-API-Key"];
      return {
        ok: true,
        json: async () => ({
          results: [{ title: "MERN guide", url: "https://example.com/mern", snippet: "A useful guide." }],
        }),
      };
    });

    assert.equal(requestedUrl.origin, "https://api.search.tinyfish.ai");
    assert.equal(requestedUrl.searchParams.get("query"), "current MERN guidance?");
    assert.equal(requestedKey, "tinyfish-test-key");
    assert.match(enriched[0].content, /MERN guide/);
    assert.match(enriched[0].content, /https:\/\/example\.com\/mern/);
    assert.equal(messages[0].content, "Can you search the web for current MERN guidance?");

    let wasCalled = false;
    const untouched = await addTinyFishSearchContext(
      [{ role: "user", content: "Explain how MongoDB indexes work." }],
      async () => { wasCalled = true; }
    );
    assert.equal(wasCalled, false);
    assert.equal(untouched[0].content, "Explain how MongoDB indexes work.");
  } finally {
    if (originalKey === undefined) delete process.env.TINYFISH_API_KEY;
    else process.env.TINYFISH_API_KEY = originalKey;
  }
});

test("TinyFish failures leave the conversation input unchanged", async () => {
  const originalKey = process.env.TINYFISH_API_KEY;
  process.env.TINYFISH_API_KEY = "tinyfish-test-key";
  const messages = [{ role: "user", content: "Search the web for current MERN guidance." }];
  try {
    const enriched = await addTinyFishSearchContext(messages, async () => ({
      ok: false,
      status: 503,
    }));
    assert.equal(enriched, messages);
  } finally {
    if (originalKey === undefined) delete process.env.TINYFISH_API_KEY;
    else process.env.TINYFISH_API_KEY = originalKey;
  }
});

test("CORS allows the current frontend and configured stable origins, with preflight enabled", async () => {
  const options = buildCorsOptions("https://mern-chatbot-pi.vercel.app/, https://chat.example.com");
  const checkOrigin = (origin) => new Promise((resolve, reject) => {
    options.origin(origin, (error, allowed) => error ? reject(error) : resolve(allowed));
  });

  assert.equal(await checkOrigin("https://mern-chatbot-m3blo47nx-girish19.vercel.app"), true);
  assert.equal(await checkOrigin("https://mern-chatbot-pi.vercel.app"), true);
  assert.equal(await checkOrigin("https://chat.example.com"), true);
  assert.equal(await checkOrigin("http://localhost:5173"), true);
  await assert.rejects(checkOrigin("https://unlisted.example.com"), /not allowed by CORS/);
  assert.equal(options.optionsSuccessStatus, 204);
  assert.equal(options.preflightContinue, false);
  assert.equal(options.credentials, undefined);
});

test("Gemini 404 diagnostics keep the sanitized provider error body", () => {
  const diagnostics = summarizeProviderError({
    status: 404,
    error: {
      error: {
        code: 404,
        message: "models/gemini-2.5-flash was not found or is not supported",
        status: "NOT_FOUND",
        details: [{ reason: "MODEL_NOT_FOUND", apiKey: "never-log-this" }],
      },
    },
  });

  assert.equal(diagnostics.status, 404);
  assert.equal(diagnostics.body.error.message, "models/gemini-2.5-flash was not found or is not supported");
  assert.equal(diagnostics.body.error.details[0].reason, "MODEL_NOT_FOUND");
  assert.equal(JSON.stringify(diagnostics).includes("never-log-this"), false);
});

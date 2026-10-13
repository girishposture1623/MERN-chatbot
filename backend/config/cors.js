const CURRENT_VERCEL_ORIGIN = "https://mern-chatbot-m3blo47nx-girish19.vercel.app";

function normalizeOrigin(value) {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

export function buildCorsOptions(frontendUrls = "") {
  const configuredOrigins = String(frontendUrls)
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
  const allowedOrigins = new Set([
    "http://localhost:5173",
    CURRENT_VERCEL_ORIGIN,
    ...configuredOrigins,
  ]);

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Origin is not allowed by CORS"));
    },
    optionsSuccessStatus: 204,
    preflightContinue: false,
  };
}

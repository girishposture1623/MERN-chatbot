import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import connectDB from "./config/db.js";
import chatbotRoute from "./Routes/chat.route.js";
import { getProviderDiagnostics } from "./services/chat.service.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);

app.use(express.json({ limit: "2mb" }));

app.use("/api", chatbotRoute);

async function startServer() {
  try {
    await connectDB();

    const port = process.env.PORT || 5000;

    app.listen(port, () => {
      console.log(`Backend running on port ${port}`);
      const providerDiagnostics = getProviderDiagnostics();
      console.log(
        "Configured providers:",
        providerDiagnostics
          .filter((provider) => provider.configured)
          .map((provider) => `${provider.name} (${provider.model})`)
          .join(", ") || "none",
      );
      const missingProviders = providerDiagnostics
        .filter((provider) => !provider.configured)
        .map((provider) => provider.name);
      if (missingProviders.length) {
        console.info("Providers without API keys:", missingProviders.join(", "));
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

startServer();

import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { isSessionConfigured } from "./session";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Behind Railway / Render / nginx the client IP and protocol arrive via X-Forwarded-*.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  // tRPC API
  app.use(
    "/api/trpc",
    (_req, res, next) => {
      res.setHeader("Cache-Control", "private, no-store");
      next();
    },
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  if (!ENV.databaseUrl) console.warn("[config] DATABASE_URL is not set — the app cannot store or read data.");
  if (!isSessionConfigured()) console.warn("[config] SESSION_SECRET is missing or shorter than 32 characters — sign-in is disabled.");
  if (!ENV.googleMapsApiKey) console.warn("[config] GOOGLE_MAPS_API_KEY is not set — Google Maps search is disabled.");

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

startServer().catch(error => { console.error(error); process.exit(1); });

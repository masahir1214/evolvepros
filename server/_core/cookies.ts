import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

// The session cookie is host-only, HttpOnly and SameSite=Lax. It is marked Secure in
// production, and in development whenever the request actually arrived over HTTPS
// (the server runs with "trust proxy", so req.secure reflects X-Forwarded-Proto).
export function getSessionCookieOptions(req: Request): CookieOptions {
  return { httpOnly: true, path: "/", sameSite: "lax", secure: ENV.isProduction || req.secure };
}

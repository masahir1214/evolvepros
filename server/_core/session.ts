import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { jwtVerify, SignJWT } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function secretKey(): Uint8Array {
  const secret = ENV.sessionSecret;
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET is not configured. Set it to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function isSessionConfigured(): boolean {
  return ENV.sessionSecret.length >= 32;
}

export async function createSessionToken(openId: string): Promise<string> {
  return new SignJWT({ openId })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000))
    .sign(secretKey());
}

export async function readSession(token: string | undefined | null): Promise<{ openId: string; issuedAt: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.openId !== "string" || !payload.openId) return null;
    return { openId: payload.openId, issuedAt: typeof payload.iat === "number" ? payload.iat : 0 };
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  return (await readSession(token))?.openId ?? null;
}

// Resolves the signed-in user from the session cookie, or null when signed out.
export async function authenticateRequest(req: Request): Promise<User | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  const session = await readSession(token);
  if (!session) return null;
  const user = await db.getUserByOpenId(session.openId);
  if (!user) return null;
  // A password change or reset signs out every session issued before it.
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > session.issuedAt) return null;
  return user;
}


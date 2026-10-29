import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, type InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function isLocalDatabase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

// Lazily create the connection so tooling and tests can run without a database.
// Works with Supabase's direct connection and with its Supavisor pooler (session or
// transaction mode): prepared statements are disabled because transaction-mode
// poolers do not support them, and TLS is required for any non-local host.
export async function getDb() {
  const url = ENV.databaseUrl;
  if (!_db && url) {
    try {
      _client = postgres(url, {
        prepare: false,
        max: 10,
        idle_timeout: 20,
        connect_timeout: 15,
        ssl: isLocalDatabase(url) ? false : "require",
      });
      _db = drizzle(_client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error instanceof Error ? error.message : error);
      _client = null;
      _db = null;
    }
  }
  return _db;
}

export async function closeDb() {
  if (_client) await _client.end({ timeout: 5 });
  _client = null;
  _db = null;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const [user] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return user;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
  return user;
}

export async function touchLastSignedIn(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, userId));
}

export type NewUser = Pick<InsertUser, "openId" | "email" | "passwordHash" | "name" | "role" | "loginMethod">;

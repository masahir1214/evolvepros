import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { isMapsConfigured } from "./places";
import { integrationSecrets } from "../drizzle/schema";

export const providers = ["googleSearch", "openai", "zeroBounce", "twilio", "hubspot", "zoho"] as const;
export type Provider = (typeof providers)[number];
export type ProviderCredentials = Record<string, string>;

function getEncryptionKey(): Buffer {
  const configured = process.env.APP_CREDENTIALS_ENCRYPTION_KEY?.trim();
  if (!configured) throw new Error("Credential encryption is not configured. Set APP_CREDENTIALS_ENCRYPTION_KEY in the server environment.");
  const key = /^[a-f0-9]{64}$/i.test(configured) ? Buffer.from(configured, "hex") : Buffer.from(configured, "base64");
  if (key.length !== 32) throw new Error("APP_CREDENTIALS_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.");
  return key;
}

export function isEncryptionConfigured(): boolean {
  try { getEncryptionKey(); return true; } catch { return false; }
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
}

function decrypt(value: string): string {
  const [version, ivText, tagText, ciphertextText] = value.split(":");
  if (version !== "v1" || !ivText || !tagText || !ciphertextText) throw new Error("Stored credential format is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64"));
  decipher.setAuthTag(Buffer.from(tagText, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64")), decipher.final()]).toString("utf8");
}

export async function getProviderCredentials(provider: Provider): Promise<ProviderCredentials | null> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const [row] = await db.select().from(integrationSecrets).where(eq(integrationSecrets.provider, provider)).limit(1);
  if (!row) return null;
  try { return JSON.parse(decrypt(row.encryptedValue)) as ProviderCredentials; }
  catch (error) {
    if (error instanceof Error && error.message.includes("APP_CREDENTIALS_ENCRYPTION_KEY")) throw error;
    throw new Error("Saved credentials could not be decrypted. Check the configured encryption key.");
  }
}

export async function saveProviderCredentials(provider: Provider, credentials: ProviderCredentials): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const encryptedValue = encrypt(JSON.stringify(credentials));
  await db.insert(integrationSecrets).values({ provider, encryptedValue }).onConflictDoUpdate({ target: integrationSecrets.provider, set: { encryptedValue, updatedAt: new Date() } });
}

export async function removeProviderCredentials(provider: Provider): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  await db.delete(integrationSecrets).where(eq(integrationSecrets.provider, provider));
}

export async function getProviderStatus(): Promise<Record<Provider | "googleMaps", boolean>> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const configured = await db.select({ provider: integrationSecrets.provider }).from(integrationSecrets);
  const saved = new Set(configured.map((item) => item.provider));
  return {
    googleMaps: isMapsConfigured(),
    googleSearch: saved.has("googleSearch"),
    openai: saved.has("openai"),
    zeroBounce: saved.has("zeroBounce"),
    twilio: saved.has("twilio"),
    hubspot: saved.has("hubspot"),
    zoho: saved.has("zoho"),
  };
}

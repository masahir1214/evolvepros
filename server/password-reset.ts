import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { passwordResetTokens, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { isMailConfigured, sendMail } from "./_core/mail";
import { hashPassword } from "./_core/password";
import { getDb } from "./db";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// Creates a fresh single-use token for the user (older unused ones are discarded) and returns the raw token.
export async function createPasswordResetToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const token = randomBytes(32).toString("hex");
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.insert(passwordResetTokens).values({
    userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  return token;
}

// Spends the token (atomically, so it works once) and sets the new password.
// Returns false for unknown, expired or already used tokens.
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database is not available.");
  const passwordHash = await hashPassword(newPassword);
  return db.transaction(async (tx) => {
    const now = new Date();
    const [spent] = await tx.update(passwordResetTokens).set({ usedAt: now })
      .where(and(eq(passwordResetTokens.tokenHash, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
      .returning({ userId: passwordResetTokens.userId });
    if (!spent) return false;
    // passwordChangedAt signs out every session that was issued before this moment.
    await tx.update(users).set({ passwordHash, passwordChangedAt: now }).where(eq(users.id, spent.userId));
    await tx.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, spent.userId), ne(passwordResetTokens.tokenHash, sha256(token))));
    return true;
  });
}

function resetBaseUrl(): string {
  if (ENV.appBaseUrl) return ENV.appBaseUrl;
  return ENV.isProduction ? "" : `http://localhost:${process.env.PORT || "3000"}`;
}

// Emails the reset link. Without SMTP, the link is printed to the server console in development
// only (so you can test locally); in production nothing is revealed and a warning is logged.
export async function deliverPasswordReset(email: string, token: string): Promise<void> {
  const base = resetBaseUrl();
  if (!base) { console.warn("[reset] APP_BASE_URL is not set — cannot build a password reset link."); return; }
  const link = `${base}/reset-password?token=${token}`;
  if (!isMailConfigured()) {
    if (!ENV.isProduction) console.log(`\n[reset] Password reset link for ${email} (valid 1 hour):\n${link}\n`);
    else console.warn("[reset] A password reset was requested but SMTP_URL / MAIL_FROM are not configured.");
    return;
  }
  await sendMail({
    to: email,
    subject: "Reset your password",
    text: `We received a request to reset your password.\n\nOpen this link within 1 hour to choose a new one:\n${link}\n\nIf you did not ask for this, you can ignore this email — your password stays the same.`,
  });
}

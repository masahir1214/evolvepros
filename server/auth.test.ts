import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "./_core/password";
import { checkRateLimit, clearRateLimit, consumeRateLimit, recordFailure } from "./_core/rateLimit";
import { createSessionToken, readSession, verifySessionToken } from "./_core/session";
import { getSessionCookieOptions } from "./_core/cookies";

afterEach(() => vi.unstubAllEnvs());

describe("password hashing", () => {
  it("verifies the right password and rejects wrong, empty or malformed ones", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password!!", hash)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same-password-1")).not.toBe(await hashPassword("same-password-1"));
  });
});

describe("session tokens", () => {
  it("round-trips a signed session and rejects tampering or a different secret", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-signing-key-that-is-at-least-32-chars");
    const token = await createSessionToken("local_user-1");
    expect(await verifySessionToken(token)).toBe("local_user-1");
    expect(await verifySessionToken(token.slice(0, -2) + "xx")).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
    vi.stubEnv("SESSION_SECRET", "a-completely-different-secret-of-32-characters!!");
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("refuses to sign with a missing or short secret", async () => {
    vi.stubEnv("SESSION_SECRET", "short");
    await expect(createSessionToken("local_user-1")).rejects.toThrow(/SESSION_SECRET/);
  });
});

describe("session issue time", () => {
  it("exposes when the session was issued, so a password change can sign it out", async () => {
    vi.stubEnv("SESSION_SECRET", "unit-test-signing-key-that-is-at-least-32-chars");
    const before = Math.floor(Date.now() / 1000);
    const session = await readSession(await createSessionToken("local_user-2"));
    expect(session?.openId).toBe("local_user-2");
    expect(session!.issuedAt).toBeGreaterThanOrEqual(before - 1);
    expect(session!.issuedAt).toBeLessThanOrEqual(before + 2);
    expect(await readSession("garbage")).toBeNull();
  });
});

describe("session cookie", () => {
  it("is HttpOnly + Lax, and Secure in production or over HTTPS", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(getSessionCookieOptions({ secure: false } as never)).toMatchObject({ httpOnly: true, sameSite: "lax", secure: false });
    expect(getSessionCookieOptions({ secure: true } as never)).toMatchObject({ secure: true });
    vi.stubEnv("NODE_ENV", "production");
    expect(getSessionCookieOptions({ secure: false } as never)).toMatchObject({ secure: true });
  });
});

describe("rate limiter", () => {
  it("blocks after the limit of failures and resets on success", () => {
    const key = "test:limit";
    clearRateLimit(key);
    for (let i = 0; i < 3; i++) { expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true); recordFailure(key); }
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(false);
    clearRateLimit(key);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it("consumeRateLimit counts each allowed use and stops at the limit", () => {
    const key = "test:consume";
    clearRateLimit(key);
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(consumeRateLimit(key, 2, 60_000).allowed).toBe(true);
    const blocked = consumeRateLimit(key, 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});

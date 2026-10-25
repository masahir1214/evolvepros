import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derived) => (error ? reject(error) : resolve(derived)));
  });
}

// scrypt parameters (OWASP-recommended minimum: N=2^17, r=8, p=1). They are stored in the
// hash string, so they can be raised later without invalidating existing passwords.
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024;


export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return ["scrypt", N, R, P, salt.toString("base64"), derived.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [scheme, n, r, p, saltText, hashText] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64");
    const derived = await scrypt(password.normalize("NFKC"), Buffer.from(saltText, "base64"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// Burn the same CPU time for unknown emails so response timing does not reveal which accounts exist.
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("dummy-password-for-timing-only");
  await verifyPassword(password, await dummyHash);
}

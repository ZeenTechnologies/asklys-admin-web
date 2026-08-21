// Password hashing: scrypt from node:crypto — OWASP-approved, no native dependency.
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 128 * 1024 * 1024; // Node's 32 MB default is below what N needs

// promisify() picks the option-less overload, so wrap scrypt by hand.
const scryptAsync = (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key))),
  );

// Stored as scrypt$N$r$p$salt$hash — parameters travel with the hash, so raising them later doesn't invalidate old passwords.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, KEYLEN, {
    N, r: R, p: P, maxmem: MAXMEM,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

// Constant-time; false on any malformed stored value.
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const expected = Buffer.from(hashB64, "base64");
    const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

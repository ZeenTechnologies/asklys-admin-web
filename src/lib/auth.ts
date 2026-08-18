import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "crypto";

const COOKIE = "pv_admin";

/** Signed session value so the cookie can't be forged. */
function token() {
  const secret = process.env.ADMIN_PASSWORD ?? "";
  return crypto.createHash("sha256").update(`pv-admin::${secret}`).digest("hex");
}

export async function isLoggedIn() {
  // Local-only convenience so you don't log in on every reload while developing.
  // Hard-guarded: can never apply to a production build.
  if (process.env.NODE_ENV !== "production" && process.env.DEV_SKIP_AUTH === "1") return true;
  const jar = await cookies();
  return jar.get(COOKIE)?.value === token();
}

/** Call at the top of every protected page. */
export async function requireAuth() {
  if (!(await isLoggedIn())) redirect("/login");
}

export async function signIn(password: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return false;
  const jar = await cookies();
  jar.set(COOKIE, token(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return true;
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

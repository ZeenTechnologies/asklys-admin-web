// Tell the public site to refresh. Best effort: a failed ping must never fail the save.
import "server-only";
import { env } from "./env";

export async function pingSite(payload: { slug?: string; tag?: string } = {}): Promise<void> {
  if (!env.SITE_URL) return;
  try {
    await fetch(`${env.SITE_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-secret": env.REVALIDATE_SECRET },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("[revalidate] ping failed:", e);
  }
}

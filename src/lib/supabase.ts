import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/** Browser-safe client (respects row-level security). */
export const supabase = createClient(URL, ANON);

/**
 * Server-only client. Uses the service-role key, which bypasses RLS —
 * NEVER import this into a "use client" component.
 */
export const supabaseAdmin = () =>
  createClient(URL, SERVICE, { auth: { persistSession: false } });

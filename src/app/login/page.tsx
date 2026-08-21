import { redirect } from "next/navigation";
import { isLoggedIn, signIn } from "@/features/auth/services/session";

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ error?: string }> }) {
  if (await isLoggedIn()) redirect("/");
  const { error } = await searchParams;

  async function attempt(formData: FormData) {
    "use server";
    const result = await signIn(
      String(formData.get("email") ?? ""),
      String(formData.get("password") ?? ""),
    );
    redirect(result.ok ? "/" : `/login?error=${result.reason}`);
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink px-4">
      <form action={attempt} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-brand grid place-items-center">
            <span className="text-white font-black">?</span>
          </div>
          <div className="leading-tight">
            <p className="font-extrabold text-ink">Ask Parent</p>
            <p className="text-[12px] text-muted">Admin portal</p>
          </div>
        </div>

        <label className="mt-7 block text-[13px] font-bold text-ink">Email</label>
        <input
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 outline-none focus:border-brand"
        />

        <label className="mt-4 block text-[13px] font-bold text-ink">Password</label>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-lg border border-line px-4 py-2.5 outline-none focus:border-brand"
        />
        {error === "throttled" ? (
          <p className="mt-2 text-[13px] font-semibold text-red-600">
            Too many attempts. Try again in 15 minutes.
          </p>
        ) : error ? (
          // Deliberately doesn't say which of the two was wrong.
          <p className="mt-2 text-[13px] font-semibold text-red-600">
            Incorrect email or password.
          </p>
        ) : null}

        <button className="mt-5 w-full rounded-lg bg-brand py-2.5 font-extrabold text-white hover:bg-brand-mid transition-colors">
          Sign in
        </button>
      </form>
    </div>
  );
}

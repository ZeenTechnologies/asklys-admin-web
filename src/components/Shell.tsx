"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, FileText, Image as ImageIcon, LayoutDashboard,
  Link2, LogOut, Settings, Share2, Sparkles,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/social", label: "Social", icon: Share2 },
  { href: "/media", label: "Media", icon: ImageIcon },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-screen flex">
      {/* sidebar */}
      <aside className="w-60 shrink-0 bg-ink text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand grid place-items-center">
              <span className="text-white font-black text-sm">?</span>
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-[15px]">Ask Parent</p>
              <p className="text-[11px] text-white/50">Admin</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                active(href) ? "bg-brand text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <form action="/api/logout" method="post" className="p-3 border-t border-white/10">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-white/60 hover:bg-white/10 hover:text-white transition-colors">
            <LogOut size={17} />
            Sign out
          </button>
        </form>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

/** Page header used across admin screens. */
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-white">
      <div className="px-8 py-6 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-[15px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

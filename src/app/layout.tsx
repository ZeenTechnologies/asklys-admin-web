import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({ subsets: ["latin"], weight: ["400","500","600","700","800","900"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Ask Parent Admin",
  description: "Publishing and analytics",
  robots: { index: false, follow: false },  // never index the admin
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable}>
      <body style={{ fontFamily: "var(--font-nunito), system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}

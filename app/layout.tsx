import type { Metadata } from "next";
import "./globals.css";
import Analytics from "@/components/Analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "K-RRO — Axis Vendor",
  description: "Seja parceiro K-RRO. Ganhe mais com sua frota.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <head>
        <Analytics />
      </head>
      <body>
        {children}
        <VercelAnalytics />
      </body>
    </html>
  );
}

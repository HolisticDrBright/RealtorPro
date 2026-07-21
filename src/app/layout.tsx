import type { Metadata } from "next";
import "./globals.css";
import { AppStateProvider } from "@/components/app-state";

export const metadata: Metadata = {
  title: "AgentOS — local-first workspace for REALTORS®",
  description:
    "Local-first productivity workspace for individual real-estate agents who use Follow Up Boss. Drafts and tasks only — FUB stays the system of record.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Archivo — the single typeface of the Modernist system. Loaded via a
            stylesheet link (rather than next/font) so the build never depends on
            reaching Google Fonts; the token sheet falls back to system-ui. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;600;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}

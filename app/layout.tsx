import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  title: "Geora · Descubre el mundo",
  description:
    "Descubre el mundo, país a país. Banderas, capitales, mapas y expediciones.",
  verification: { google: "OG9D66SlwknFRMtEgEf0zVnHkbQAH1oiANKQveNkX3o" }, other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}

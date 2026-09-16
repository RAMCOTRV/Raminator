import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ramco Brochure Studio",
  description: "Créez des propositions de voyage Ramco, personnalisées et prêtes à envoyer.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}

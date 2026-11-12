import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PETORA INDONESIA",
  description: "Sistem operasional terpadu untuk petshop dan klinik hewan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}

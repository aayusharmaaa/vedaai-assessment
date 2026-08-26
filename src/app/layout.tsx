import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";

import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VedaAI · Exam Assessment",
  description:
    "Upload a question paper and a student's answer sheet, then see every answer extracted, mapped to its question and highlighted on the page.",
};

export const viewport: Viewport = {
  themeColor: "#ebebeb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}

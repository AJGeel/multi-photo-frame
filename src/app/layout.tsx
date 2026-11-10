import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../tokens.css";
import "./globals.css";
import "../frames.css";

export const metadata: Metadata = {
  title: "Multi Photo Frame",
  description: "Lay out many photos in one printable frame image, entirely in your browser.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Browse Dashboard",
  description: "Sites browsed in the last 30 days",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

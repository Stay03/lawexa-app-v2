import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import "./globals.css";

import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

const comfortaa = Comfortaa({ subsets: ["latin"], variable: "--font-comfortaa" });

export const metadata: Metadata = {
  title: "Lawexa - Nigerian Legal Resources",
  description: "Access Nigerian law cases, notes, and legal research materials",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
  themeColor: "#C9A227",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={comfortaa.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            {children}
            <Toaster position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Comfortaa, Fraunces } from "next/font/google";
import "./globals.css";

import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { AttributionBootstrap } from "@/components/AttributionBootstrap";

const comfortaa = Comfortaa({ subsets: ["latin"], variable: "--font-comfortaa" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lawexa.com"),
  title: {
    default: "Lawexa - Nigerian Legal Resources",
    template: "%s",
  },
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
  openGraph: {
    type: "website",
    siteName: "Lawexa",
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@LawexaAi",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${comfortaa.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <QueryProvider>
            <AttributionBootstrap />
            {children}
            <Toaster position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

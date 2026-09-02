import type { Metadata, Viewport } from "next";
import { Comfortaa, Fraunces } from "next/font/google";
import "./globals.css";

import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import { AttributionBootstrap } from "@/components/AttributionBootstrap";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";

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
    default: "Lawexa - Where Modern Legal Work Happens",
    // Child routes export a bare title (e.g. "Terms of Service") and this
    // appends the brand → "Terms of Service | Lawexa". `default` is NOT run
    // through the template, so the homepage stays the line above. Routes
    // needing an exact title use `title.absolute`.
    template: "%s | Lawexa",
  },
  // @arthur's wording, 2026-08-11 — see `lib/constants/seo.ts` for why
  // "Nigerian" came out of every shared link.
  description:
    "Lawexa powers lawyers, students, and teams to research cases and laws across jurisdictions, draft, study, and collaborate with AI to get legal work done faster and reliably",
  // The web app manifest link is the <link> rendered in the layout below, NOT
  // declared here: `manifest` cannot carry `crossorigin="use-credentials"`,
  // which is what lets the manifest request send the theme cookie (see
  // `app/manifest.webmanifest/route.ts`). Do NOT declare `manifest` here — a
  // second declaration produced two links before (one at the stale, duplicate
  // /site.webmanifest), and the install pipeline reads whichever it likes.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lawexa",
  },
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

export const viewport: Viewport = {
  themeColor: "#C9A227",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${comfortaa.variable} ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased" suppressHydrationWarning>
        {/* THE ONE manifest link — React hoists it into <head>. It is written
            by hand, not via `metadata.manifest`, because the metadata field
            cannot emit `crossorigin`, and `use-credentials` is the entire
            mechanism: a manifest is fetched WITHOUT cookies by default (spec,
            and measured against production 2 Sep 2026), and this attribute is
            the spec's override. With it, the fetch carries the theme cookie
            and `app/manifest.webmanifest/route.ts` serves the manifest — and
            so the status bar of an app installed from this page — in the
            theme the reader is actually in. The href never varies, so every
            statically-rendered page serves the identical tag. */}
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <ThemeProvider>
          <QueryProvider>
            <AttributionBootstrap />
            <PwaInstallProvider />
            {children}
            <Toaster position="top-right" />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

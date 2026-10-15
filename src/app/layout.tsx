import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { publicBaseUrl } from "@/env";
import { THEME_COLORS } from "@/lib/brand-mark";
import { SITE } from "@/lib/seo";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  // Resolved per request (the layout is dynamic anyway) so a Docker image built without APP_URL still
  // gets absolute URLs at runtime. Unknown base: no metadataBase, URLs stay relative.
  const base = publicBaseUrl();
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: { default: SITE.name, template: `%s · ${SITE.name}` },
    description: SITE.description,
    applicationName: SITE.name,
    keywords: [...SITE.keywords],
    authors: [{ name: SITE.name, url: SITE.repoUrl }],
    creator: SITE.name,
    // Public pages are indexable; the (dashboard), (auth) and offline layouts/pages opt out.
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: SITE.name,
      description: SITE.description,
      locale: "en_US",
      alternateLocale: ["id_ID"],
      ...(base ? { url: base } : {}),
    },
    twitter: { card: "summary_large_image", title: SITE.name, description: SITE.description },
    appleWebApp: { capable: true, title: SITE.shortName, statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLORS.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLORS.dark },
  ],
  // Draw under notches/home indicators in standalone mode; headers and footers pad with safe-area insets.
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Set by the proxy (src/proxy.ts, CSP nonce). Reading headers also keeps every page dynamic so each
  // response gets a fresh nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // data-scroll-behavior: CSS enables smooth anchor scrolling; Next.js turns it off during route changes.
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster richColors closeButton position="top-right" />
          <ServiceWorkerRegistration />
        </ThemeProvider>
      </body>
    </html>
  );
}

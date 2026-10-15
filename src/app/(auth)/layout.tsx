import type { Metadata } from "next";
import { Brand } from "@/components/brand";
import { LegalNav } from "@/components/legal-page";
import { ThemeToggle } from "@/components/theme-toggle";

/** Sign-in pages are never indexed (robots.txt also disallows them). */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <header className="pt-safe-4 flex items-center justify-between px-4 pb-4 sm:px-6">
        <Brand />
        <ThemeToggle />
      </header>
      <main
        id="main"
        className="flex flex-1 items-start justify-center px-4 pt-8 pb-16 sm:items-center sm:pt-0"
      >
        <div className="w-full max-w-sm">{children}</div>
      </main>
      <footer className="text-muted-foreground pb-safe-6 grid gap-2 px-4 text-center text-xs">
        <LegalNav />
        <p>Self-hosted · Open source · Your data stays in your database</p>
      </footer>
    </div>
  );
}

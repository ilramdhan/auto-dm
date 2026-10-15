import Link from "next/link";
import { ArrowRight, Heart } from "lucide-react";
import { Brand } from "@/components/brand";
import { BackToTop } from "@/components/site/back-to-top";
import { GitHubIcon } from "@/components/site/logos";
import { DesktopNav, MobileNav } from "@/components/site/site-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { SITE } from "@/lib/seo";
import { FOOTER_COLUMNS, REPO_LINKS } from "@/lib/site-nav";

const linkClass =
  "hover:text-foreground focus-visible:ring-ring/50 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-[3px]";

function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/70 pt-safe-0 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="focus-visible:ring-ring/50 rounded-md outline-none focus-visible:ring-[3px]"
          aria-label={`${APP_NAME} home`}
        >
          <Brand />
        </Link>
        <DesktopNav />
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <a
              href={REPO_LINKS.repo}
              target="_blank"
              rel="noreferrer"
              aria-label="AutoDM on GitHub (opens in a new tab)"
            >
              <GitHubIcon className="size-4" />
            </a>
          </Button>
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Dashboard" : "Sign in"}</Link>
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/setup">
              Get started
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <MobileNav signedIn={signedIn} />
        </div>
      </div>
    </header>
  );
}

function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-muted/30 pb-safe-8 border-t pt-12">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_2fr]">
        <div className="max-w-sm">
          <Link
            href="/"
            className="focus-visible:ring-ring/50 inline-block rounded-md outline-none focus-visible:ring-[3px]"
            aria-label={`${APP_NAME} home`}
          >
            <Brand />
          </Link>
          <p className="text-muted-foreground mt-3 text-sm">{SITE.tagline}</p>
          <a
            href={REPO_LINKS.repo}
            target="_blank"
            rel="noreferrer"
            className={`${linkClass} text-muted-foreground mt-4 inline-flex items-center gap-2 text-sm`}
          >
            <GitHubIcon className="size-4" />
            Star or fork on GitHub
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="text-sm font-semibold">{col.title}</h2>
              <ul className="text-muted-foreground mt-3 grid gap-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        hrefLang={l.hrefLang}
                        className={linkClass}
                      >
                        {l.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ) : (
                      <Link href={l.href} className={linkClass}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t px-4 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {year} {APP_NAME} contributors · MIT license. Not affiliated with Meta or Instagram.
        </p>
        <p className="inline-flex items-center gap-1">
          Made with <Heart className="text-destructive size-3.5 fill-current" aria-hidden />
          <span className="sr-only">love</span> in Indonesia
        </p>
      </div>
    </footer>
  );
}

/** Public website frame: skip link, sticky header, main landmark, footer and back-to-top. */
export function SiteShell({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  return (
    <div id="top" tabIndex={-1} className="site-shell relative flex min-h-dvh flex-col outline-none">
      <a
        href="#main"
        className="bg-primary text-primary-foreground focus-visible:ring-ring/50 sr-only z-[60] rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <SiteHeader signedIn={signedIn} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
    </div>
  );
}

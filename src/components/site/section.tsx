import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Page heading block for the inner pages (/features, /setup, ...). */
export function PageHero({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 pb-10 text-center sm:px-6 sm:pt-16">
      <p className="text-primary text-sm font-medium">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
      {children ? (
        <div className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base text-pretty sm:text-lg">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A titled page section; `id` is both the anchor and the heading id. */
export function Section({
  id,
  title,
  intro,
  muted = false,
  className,
  children,
}: {
  id: string;
  title: string;
  intro?: React.ReactNode;
  muted?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={cn(muted && "bg-muted/30 border-y")}>
      <div className={cn("mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20", className)}>
        <div className="mx-auto max-w-2xl text-center">
          <h2 id={id} className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            {title}
          </h2>
          {intro ? <p className="text-muted-foreground mt-3 text-pretty">{intro}</p> : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

export interface FeatureCardData {
  icon: LucideIcon;
  title: string;
  body: string;
}

export function FeatureGrid({ items, className }: { items: readonly FeatureCardData[]; className?: string }) {
  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((f) => (
        <li key={f.title} className="bg-card rounded-xl border p-5">
          <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
            <f.icon className="size-4.5" aria-hidden />
          </span>
          <h3 className="mt-4 font-medium">{f.title}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** Closing call to action used at the bottom of every page. */
export function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section aria-labelledby="cta" className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
      <div className="bg-card relative overflow-hidden rounded-2xl border p-6 text-center sm:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(70%_80%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
        />
        <div className="relative">
          <h2 id="cta" className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Ready to answer every comment?
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-lg text-pretty">
            Free accounts on Supabase and Vercel, a Meta developer app and about an hour. The setup guide
            walks you through every click.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/setup">
                Get started
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Open dashboard" : "Sign in"}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** External link with the "opens in a new tab" hint for screen readers. */
export function ExternalLink({
  href,
  children,
  className,
  hrefLang,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  hrefLang?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      hrefLang={hrefLang}
      className={cn("text-primary font-medium underline underline-offset-4", className)}
    >
      {children}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

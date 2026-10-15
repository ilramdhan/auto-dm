import Link from "next/link";
import { APP_NAME, REPO_URL } from "@/lib/constants";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/data-deletion", label: "Data deletion" },
] as const;

/** Links to the public legal pages; used in every public footer. */
export function LegalNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={className ?? "flex flex-wrap justify-center gap-x-4 gap-y-1"}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="underline underline-offset-4">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Body of the public /privacy, /terms and /data-deletion pages (no sign-in needed). The header,
 * footer and `<main>` landmark come from the (marketing) layout.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
      {intro ? <div className="text-muted-foreground mt-2 text-sm">{intro}</div> : null}
      <div className="mt-8 grid gap-8">{children}</div>
      <p className="text-muted-foreground mt-12 border-t pt-6 text-xs">
        Powered by{" "}
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
          {APP_NAME}
        </a>
        , open-source software. Not affiliated with Meta or Instagram.
      </p>
    </article>
  );
}

/** A titled section of a legal page. */
export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid gap-3 text-sm leading-relaxed sm:text-base">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LegalList({ children }: { children: React.ReactNode }) {
  return <ul className="marker:text-muted-foreground grid list-disc gap-1.5 pl-5">{children}</ul>;
}

/** Contact line: a mailto link when the operator set an email, generic wording otherwise. */
export function ContactLink({ email }: { email: string | null }) {
  if (!email) return <>the operator of this site</>;
  return (
    <a href={`mailto:${email}`} className="font-medium underline underline-offset-4">
      {email}
    </a>
  );
}

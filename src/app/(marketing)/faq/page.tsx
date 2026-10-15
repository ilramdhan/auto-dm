import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { ExternalLink, FinalCta, PageHero } from "@/components/site/section";
import { FAQ_GROUPS, faqJsonLd, type FaqItem } from "@/lib/faq";
import { jsonLdScript, publicPageMetadata } from "@/lib/seo";
import { REPO_LINKS } from "@/lib/site-nav";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = publicPageMetadata({
  title: "FAQ",
  description:
    "Answers about AutoDM: cost, Instagram account requirements, one DM per comment within 7 days, Development vs Live mode, testers, App Review, data and troubleshooting.",
  path: "/faq",
});

function AnswerLink({ link }: { link: NonNullable<FaqItem["link"]> }) {
  return link.href.startsWith("/") ? (
    <Link href={link.href} className="text-primary font-medium underline underline-offset-4">
      {link.label}
    </Link>
  ) : (
    <ExternalLink href={link.href}>{link.label}</ExternalLink>
  );
}

export default async function FaqPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Safe: jsonLdScript escapes "<", and the data is our own constants.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd()) }}
      />
      <PageHero eyebrow="FAQ" title="Frequently asked questions">
        <p>
          Straight answers about cost, Instagram&apos;s rules and what to check when something doesn&apos;t
          work.
        </p>
      </PageHero>

      <div className="mx-auto grid max-w-3xl gap-12 px-4 pb-16 sm:px-6">
        <nav aria-label="FAQ topics">
          <ul className="flex flex-wrap justify-center gap-2">
            {FAQ_GROUPS.map((g) => (
              <li key={g.id}>
                <a
                  href={`#${g.id}`}
                  className="hover:bg-accent focus-visible:ring-ring/50 inline-flex min-h-9 items-center rounded-full border px-3 text-sm outline-none focus-visible:ring-[3px]"
                >
                  {g.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {FAQ_GROUPS.map((group) => (
          <section key={group.id} aria-labelledby={group.id}>
            <h2 id={group.id} className="text-xl font-semibold tracking-tight">
              {group.title}
            </h2>
            <div className="mt-4 grid gap-3">
              {group.items.map((item) => (
                <details key={item.id} id={item.id} className="bg-card group rounded-xl border">
                  <summary className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-4 font-medium outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
                    <h3>{item.question}</h3>
                    <span
                      aria-hidden
                      className="text-muted-foreground text-lg transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="text-muted-foreground grid gap-2 px-4 pb-4 text-sm leading-relaxed">
                    {item.answer.map((p) => (
                      <p key={p}>{p}</p>
                    ))}
                    {item.link ? (
                      <p>
                        <AnswerLink link={item.link} />
                      </p>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p className="text-muted-foreground text-center text-sm">
          Didn&apos;t find your answer? Ask in{" "}
          <ExternalLink href={REPO_LINKS.discussions}>GitHub Discussions</ExternalLink> or{" "}
          <ExternalLink href={REPO_LINKS.issues}>open an issue</ExternalLink>.
        </p>
      </div>

      <FinalCta signedIn={signedIn} />
    </>
  );
}

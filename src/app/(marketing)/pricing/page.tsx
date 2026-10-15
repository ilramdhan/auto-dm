import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Check, Minus } from "lucide-react";
import { ExternalLink, FinalCta, PageHero, Section } from "@/components/site/section";
import { publicPageMetadata } from "@/lib/seo";
import { docUrl, REPO_LINKS } from "@/lib/site-nav";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = publicPageMetadata({
  title: "Pricing",
  description:
    "AutoDM is free and open source (MIT): no plans, no per-contact fees. What self-hosting on Vercel + Supabase or Docker really costs, and the limits Meta sets.",
  path: "/pricing",
});

const INCLUDED = [
  "Unlimited campaigns, rules and keywords",
  "Unlimited comments, replies and DMs (within Meta's limits)",
  "Activity log, analytics and CSV export",
  "Encrypted secrets and automatic token refresh",
  "Optional n8n relay",
  "All future updates, under the MIT license",
] as const;

const HOSTING = [
  {
    option: "Vercel Hobby + Supabase Free",
    cost: "Free",
    notes:
      "The default path. Vercel's Hobby plan is meant for personal, non-commercial use, so check Vercel's terms if you run it for a business. Supabase pauses free projects after about a week without activity; AutoDM's daily job keeps it awake.",
  },
  {
    option: "Vercel Pro and/or Supabase Pro",
    cost: "Paid, per those providers' pricing",
    notes: "For commercial use or more headroom. AutoDM itself still costs nothing.",
  },
  {
    option: "Docker on your own server",
    cost: "Whatever your server costs",
    notes:
      "Any VPS or home server that runs Docker Compose, plus a domain with HTTPS (Meta only calls HTTPS addresses).",
  },
  {
    option: "Meta / Instagram API",
    cost: "Free",
    notes: "Meta does not charge per comment or per message. Its limits are below.",
  },
] as const;

export default async function PricingPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return (
    <>
      <PageHero eyebrow="Pricing" title="Free and open source. Really.">
        <p>
          No plans, no trials, no per-contact or per-message fees. AutoDM is MIT-licensed software that you
          run yourself. The only possible costs are your hosting, and you choose it.
        </p>
      </PageHero>

      <div className="mx-auto max-w-md px-4 sm:px-6">
        <section aria-labelledby="plan" className="bg-card rounded-2xl border p-6 shadow-sm sm:p-8">
          <h2 id="plan" className="text-lg font-semibold">
            AutoDM
          </h2>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tracking-tight">$0</span>
            <span className="text-muted-foreground text-sm">forever, self-hosted</span>
          </p>
          <ul className="mt-6 grid gap-2.5 text-sm">
            {INCLUDED.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="text-success mt-0.5 size-4 shrink-0" aria-hidden />
                {item}
              </li>
            ))}
            <li className="text-muted-foreground flex gap-2">
              <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="sr-only">Not included: </span>No hosted version or paid support. Help comes
                from the docs and the community.
              </span>
            </li>
          </ul>
        </section>
      </div>

      <Section
        id="hosting"
        title="What self-hosting costs"
        intro="Most people pay nothing. Here is the honest picture."
      >
        <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
          {HOSTING.map((h) => (
            <li key={h.option} className="bg-card rounded-xl border p-5">
              <h3 className="font-medium">{h.option}</h3>
              <p className="mt-1 text-sm">
                <span className="text-muted-foreground">Cost: </span>
                <strong className="font-semibold">{h.cost}</strong>
              </p>
              <p className="text-muted-foreground mt-2 text-sm">{h.notes}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="limits" title="The limits come from Meta" muted>
        <ul className="marker:text-muted-foreground mx-auto grid max-w-2xl list-disc gap-2 pl-5 text-sm sm:text-base">
          <li>One private reply (DM) per comment, sent within 7 days of the comment.</li>
          <li>More messages only after the person replies, inside Instagram&apos;s 24-hour window.</li>
          <li>Rate limits: commonly reported around 750 private replies per hour per account.</li>
          <li>
            Serving the public needs Live mode, and possibly App Review with Business Verification, which take
            time but cost nothing.
          </li>
          <li>Instagram can throttle accounts that send spam-like messages.</li>
        </ul>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          Details:{" "}
          <ExternalLink href={docUrl("meta-setup.md", "is-it-free-and-unlimited")}>
            Is it free and unlimited?
          </ExternalLink>
        </p>
      </Section>

      <Section id="support" title="Want to support the project?">
        <p className="text-muted-foreground mx-auto max-w-2xl text-center">
          Star the repository, report bugs, improve the docs or translations, or send a pull request. See{" "}
          <ExternalLink href={REPO_LINKS.contributing}>how to contribute</ExternalLink> and join{" "}
          <ExternalLink href={REPO_LINKS.discussions}>GitHub Discussions</ExternalLink>.
        </p>
      </Section>

      <FinalCta signedIn={signedIn} />
    </>
  );
}

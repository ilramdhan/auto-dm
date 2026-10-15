import type { Metadata } from "next";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Gift,
  GraduationCap,
  KeyRound,
  ListChecks,
  MessageSquareReply,
  Send,
  ServerCog,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { SetupRequired } from "@/components/setup-required";
import { InstagramIcon } from "@/components/icons";
import { TechMarquee } from "@/components/site/logos";
import { FeatureGrid, FinalCta, Section } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { envProblems, publicBaseUrl } from "@/env";
import { APP_NAME, DM_MAX_CHARS } from "@/lib/constants";
import { findFaqItems, HOME_FAQ_IDS } from "@/lib/faq";
import { absoluteUrl, jsonLdScript, publicPageMetadata, SITE } from "@/lib/seo";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = publicPageMetadata({
  title: `${APP_NAME} · Instagram comment-to-DM automation`,
  absoluteTitle: true,
  path: "/",
});

/** schema.org description of the app for search engines (JSON-LD). */
function softwareApplicationJsonLd(base: string | null) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    alternateName: SITE.shortName,
    description: SITE.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    keywords: SITE.keywords.join(", "),
    ...(base ? { url: absoluteUrl(base, "/"), image: absoluteUrl(base, "/opengraph-image") } : {}),
    codeRepository: SITE.repoUrl,
    sameAs: [SITE.repoUrl],
  };
}

const STEPS = [
  {
    icon: InstagramIcon,
    title: "Someone comments a keyword",
    body: "For example “GUIDE” on your post or reel. Instagram sends the comment to your copy of AutoDM.",
  },
  {
    icon: MessageSquareReply,
    title: "AutoDM replies in public",
    body: "A short reply under the comment, picked at random from your variants so it doesn't look robotic.",
  },
  {
    icon: Send,
    title: "And sends a private DM",
    body: "Your link goes straight to their inbox, with an optional button. Everything is logged in Activity.",
  },
] as const;

const FEATURES = [
  {
    icon: ListChecks,
    title: "Keyword rules per post",
    body: "Whole word, exact comment or contains. Case, accents and emoji are handled for you.",
  },
  {
    icon: MessageSquareReply,
    title: "Replies that vary",
    body: "Several public reply variants per rule, plus {username} and {keyword} in your messages.",
  },
  {
    icon: BarChart3,
    title: "Activity and analytics",
    body: "Every comment, what matched and what was sent, with reasons for skips and failures. CSV export.",
  },
  {
    icon: ShieldCheck,
    title: "Safe by default",
    body: "Signed webhooks, encrypted tokens, one DM per comment and no duplicate sends.",
  },
  {
    icon: KeyRound,
    title: "Your keys, your data",
    body: "You create your own Meta app and everything lives in your own database.",
  },
  {
    icon: ServerCog,
    title: "Easy to host",
    body: "Vercel + Supabase on free tiers, or one Docker image on your own server.",
  },
] as const;

const USE_CASES = [
  {
    icon: Gift,
    title: "Freebies and lead magnets",
    body: "“Comment GUIDE and I'll send you the PDF.” The link arrives in seconds, even at 3 a.m.",
  },
  {
    icon: ShoppingBag,
    title: "Small shops",
    body: "“Comment PRICE for the price list.” Send the catalogue or the order form link automatically.",
  },
  {
    icon: CalendarClock,
    title: "Events and launches",
    body: "Hand out the registration link to everyone who comments, and see how many asked for it.",
  },
  {
    icon: GraduationCap,
    title: "Creators and educators",
    body: "Share the tutorial, preset or resource link mentioned in a reel without copy-pasting all day.",
  },
] as const;

const LIMITS = [
  {
    title: "One DM per comment",
    body: "Instagram allows one private reply per comment, within 7 days of it.",
  },
  {
    title: `${DM_MAX_CHARS} characters`,
    body: "Maximum DM text length. Keep messages short and to the point.",
  },
  {
    title: "Development vs Live",
    body: "New Meta apps start in Development mode: only you and invited Instagram Testers trigger it until you go Live.",
  },
  {
    title: "Professional account",
    body: "Your Instagram account must be Business or Creator, with access to messages turned on.",
  },
] as const;

export default async function Home() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  const missingEnv = envProblems();
  // Set by the proxy (src/proxy.ts); inline scripts need it to pass the CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const faqs = findFaqItems(HOME_FAQ_IDS);

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Safe: jsonLdScript escapes "<", and the data is our own constants.
        dangerouslySetInnerHTML={{ __html: jsonLdScript(softwareApplicationJsonLd(publicBaseUrl())) }}
      />
      {missingEnv.length > 0 ? (
        <div className="mx-auto max-w-3xl px-4 pt-6 sm:px-6">
          <SetupRequired missing={missingEnv} />
        </div>
      ) : null}

      <section
        aria-labelledby="hero"
        className="mx-auto max-w-3xl px-4 pt-12 pb-16 text-center sm:px-6 sm:pt-20"
      >
        <p className="text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
          <InstagramIcon className="size-3.5" />
          Free · Open source · Self-hosted
        </p>
        <h1 id="hero" className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          {SITE.headline}
        </h1>
        <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty sm:text-lg">
          When someone comments your keyword, {APP_NAME} replies under the comment and sends them a private
          message with your link, using Instagram&apos;s official API. You host it, you own the data, and
          there is no monthly fee.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
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
        <p className="text-muted-foreground mt-4 text-sm">
          <a href="#how-it-works" className="underline underline-offset-4">
            See how it works
          </a>
        </p>
      </section>

      <Section
        id="how-it-works"
        title="How it works"
        intro="Three things happen within seconds of a comment."
        muted
      >
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <step.icon className="size-4.5" aria-hidden />
                </span>
                <span className="text-muted-foreground font-mono text-xs">Step {i + 1}</span>
              </div>
              <h3 className="mt-4 font-medium">{step.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="features"
        title="What you get"
        intro="Everything you need for comment-to-DM, nothing you pay for."
      >
        <FeatureGrid items={FEATURES} />
        <p className="mt-8 text-center">
          <Link
            href="/features"
            className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            All features
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </Section>

      <Section id="use-cases" title="What people use it for" muted>
        <ul className="grid gap-4 sm:grid-cols-2">
          {USE_CASES.map((u) => (
            <li key={u.title} className="bg-card flex gap-4 rounded-xl border p-5">
              <u.icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <h3 className="font-medium">{u.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{u.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        id="limits"
        title="Good to know before you start"
        intro="These limits come from Instagram and Meta, not from AutoDM. Every comment-to-DM tool has them."
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LIMITS.map((l) => (
            <div key={l.title} className="rounded-xl border p-5">
              <dt className="font-medium">{l.title}</dt>
              <dd className="text-muted-foreground mt-1 text-sm">{l.body}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="faq" title="Common questions" muted>
        <div className="mx-auto grid max-w-3xl gap-3">
          {faqs.map((item) => (
            <details key={item.id} className="bg-card group rounded-xl border">
              <summary className="focus-visible:ring-ring/50 flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-4 font-medium outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
                {item.question}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="text-muted-foreground grid gap-2 px-4 pb-4 text-sm">
                {item.answer.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/faq"
            className="text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
          >
            All questions
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </p>
      </Section>

      <Section
        id="tech-stack"
        title="Built on open, well-known tools"
        intro="Hover or focus the strip to pause it."
      >
        <TechMarquee />
      </Section>

      <FinalCta signedIn={signedIn} />
    </>
  );
}

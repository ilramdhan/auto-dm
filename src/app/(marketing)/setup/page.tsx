import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Container, UserPlus } from "lucide-react";
import { ExternalLink, FinalCta, PageHero, Section } from "@/components/site/section";
import { DM_MAX_CHARS } from "@/lib/constants";
import { publicPageMetadata } from "@/lib/seo";
import { docUrl } from "@/lib/site-nav";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = publicPageMetadata({
  title: "Setup guide",
  description:
    "Step-by-step: deploy AutoDM free on Vercel + Supabase (or Docker), create your Meta app, connect Instagram, set up the webhook and run your first campaign.",
  path: "/setup",
});

interface Step {
  title: string;
  where: string;
  body: React.ReactNode;
  done: string;
}

interface Phase {
  id: string;
  title: string;
  intro: string;
  steps: readonly Step[];
  doc: { href: string; label: string };
}

const PHASES: readonly Phase[] = [
  {
    id: "deploy",
    title: "Part 1 · Deploy the app",
    intro:
      "About 15 minutes. Free accounts on Supabase (database) and Vercel (hosting), plus a GitHub account.",
    steps: [
      {
        title: "Create the database",
        where: "Supabase",
        body: (
          <>
            Create a new project in a region close to your audience (for Indonesia: Singapore) and note the
            password. Under <strong>Connect</strong>, copy the <strong>Transaction pooler</strong> (port 6543)
            and <strong>Session pooler</strong> (port 5432) connection strings. Don&apos;t use the
            &ldquo;Direct connection&rdquo;: Vercel can&apos;t reach it on the free plan. You don&apos;t need
            to run any SQL.
          </>
        ),
        done: "You have two connection strings.",
      },
      {
        title: "Generate two secrets",
        where: "Your computer",
        body: (
          <>
            Run <code className="bg-muted rounded px-1">openssl rand -base64 48</code> for{" "}
            <code>APP_SECRET</code> and <code className="bg-muted rounded px-1">openssl rand -hex 32</code>{" "}
            for <code>CRON_SECRET</code> (the guide has a Node.js alternative for Windows). Save{" "}
            <code>APP_SECRET</code> in a password manager: if it changes, stored secrets can no longer be
            read.
          </>
        ),
        done: "You have APP_SECRET and CRON_SECRET.",
      },
      {
        title: "Deploy on Vercel",
        where: "GitHub + Vercel",
        body: (
          <>
            Fork the repository, import it in Vercel and add four environment variables:{" "}
            <code>DATABASE_URL</code> (transaction pooler), <code>DATABASE_URL_UNPOOLED</code> (session
            pooler), <code>APP_SECRET</code> and <code>CRON_SECRET</code>. Deploy. The database tables are
            created during the build. Then set the Vercel <strong>Function Region</strong> to the one next to
            your database and redeploy, or every page will be slow.
          </>
        ),
        done: "The build log shows “[migrate] Database is up to date.”",
      },
      {
        title: "Check it and sign in",
        where: "Your new URL",
        body: (
          <>
            Open <code>/api/health</code> on your production domain; it should say{" "}
            <code>&quot;status&quot;:&quot;ok&quot;</code>. Sign in with <code>admin</code> /{" "}
            <code>changeme123</code> (or the password you set); you must choose a new password right away.
          </>
        ),
        done: "You are in the dashboard with your own password.",
      },
    ],
    doc: { href: docUrl("deployment.md"), label: "Full deployment guide" },
  },
  {
    id: "meta",
    title: "Part 2 · Connect Instagram",
    intro: "About 15 to 30 minutes in the Instagram app and the Meta developer dashboard. Free.",
    steps: [
      {
        title: "Prepare your Instagram account",
        where: "Instagram app",
        body: (
          <>
            Switch to a <strong>professional account</strong> (Business or Creator). Then turn on{" "}
            <em>
              Settings → Messages and story replies → Message controls → Connected tools → Allow access to
              messages
            </em>
            . Without it, every DM fails. A Facebook Page is not needed.
          </>
        ),
        done: "Professional account with message access on.",
      },
      {
        title: "Create your Meta app",
        where: "developers.facebook.com",
        body: (
          <>
            Create a <strong>Business</strong> app and add the <strong>Instagram</strong> product (API setup
            with Instagram login). Copy the Instagram app ID and secret into AutoDM under{" "}
            <strong>Settings → Instagram</strong>, and add the OAuth redirect URI shown there to Meta&apos;s{" "}
            <strong>Business login settings</strong>, character for character.
          </>
        ),
        done: "App ID and secret saved; the secret shows “stored encrypted”.",
      },
      {
        title: "Add yourself as a tester",
        where: "Meta dashboard + Instagram",
        body: (
          <>
            New apps start in <strong>Development mode</strong>, where only people with a role on the app can
            use it. Add your Instagram account under <strong>App roles → Roles → Instagram Testers</strong>,
            then accept the invite in Instagram:{" "}
            <em>Settings → Website permissions → Apps and websites → Tester invites</em>.
          </>
        ),
        done: "The tester shows as accepted.",
      },
      {
        title: "Connect Instagram and the webhook",
        where: "AutoDM + Meta dashboard",
        body: (
          <>
            In AutoDM click <strong>Connect Instagram</strong> and allow all permissions. Then, in Meta, open{" "}
            <strong>Configure webhooks</strong>, paste the callback URL and verify token from{" "}
            <strong>Settings → Instagram → Webhook</strong>, click <strong>Verify and save</strong> and
            subscribe to the <code>comments</code> field.
          </>
        ),
        done: "Your username shows in Settings and the webhook verifies.",
      },
    ],
    doc: { href: docUrl("meta-setup.md"), label: "Full Meta setup guide" },
  },
  {
    id: "first-campaign",
    title: "Part 3 · Your first campaign",
    intro: "Five minutes, then a real test from a second account.",
    steps: [
      {
        title: "Create a campaign and a rule",
        where: "AutoDM",
        body: (
          <>
            <strong>Campaigns → New campaign</strong>, pick a post or reel (or all posts). Add a rule: a
            keyword such as <code>guide</code>, match mode <strong>Whole word</strong>, two or three public
            reply variants (&ldquo;Sent to your DMs, {"{username}"}!&rdquo;) and the DM text with your link
            (up to {DM_MAX_CHARS} characters). Use <strong>Test a comment</strong> to check the match; it
            sends nothing.
          </>
        ),
        done: "“Test a comment” shows your rule matching.",
      },
      {
        title: "Test with a second account",
        where: "Instagram",
        body: (
          <>
            Comments from your own connected account are always skipped, so the app never answers itself. Add
            a <strong>second</strong> Instagram account as an Instagram Tester, accept the invite, and comment
            your keyword from it. Within seconds you should see the public reply and the DM.
          </>
        ),
        done: "Activity shows the comment as Sent.",
      },
    ],
    doc: {
      href: docUrl("deployment.md", "10-create-a-campaign-and-a-rule"),
      label: "Campaign steps in detail",
    },
  },
  {
    id: "go-live",
    title: "Part 4 · Open it to everyone",
    intro: "Switch your Meta app to Live so comments from the public are processed.",
    steps: [
      {
        title: "Fill in your public contact",
        where: "AutoDM",
        body: (
          <>
            In <strong>Settings → Account → Public contact</strong>, enter your name or business name and a
            contact email. They appear on the built-in privacy policy and data deletion pages, which Meta
            requires before going Live.
          </>
        ),
        done: "Your name shows on /privacy.",
      },
      {
        title: "Paste the URLs and go Live",
        where: "Meta dashboard",
        body: (
          <>
            <strong>Settings → Instagram → Meta app review</strong> lists the privacy, terms, data deletion
            and callback URLs with copy buttons. Paste them where Meta asks, then flip the app mode to{" "}
            <strong>Live</strong>. Test again from an account that is not a tester. If public comments
            don&apos;t arrive, Meta may require Advanced Access through App Review; the guide explains the
            honest state of this.
          </>
        ),
        done: "A comment from a non-tester shows up in Activity.",
      },
    ],
    doc: {
      href: docUrl("meta-setup.md", "part-8---development-vs-live-mode-important"),
      label: "Development vs Live mode",
    },
  },
];

export default async function SetupPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return (
    <>
      <PageHero eyebrow="Setup guide" title="From zero to your first automatic DM">
        <p>
          A plain-language summary of the whole setup. Plan 30 to 60 minutes; everything here is free. Each
          part links to the detailed guide if you get stuck.
        </p>
      </PageHero>

      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <section aria-labelledby="before" className="bg-card rounded-xl border p-5 sm:p-6">
          <h2 id="before" className="flex items-center gap-2 font-semibold">
            <UserPlus className="text-primary size-5" aria-hidden />
            What you need before you start
          </h2>
          <ul className="text-muted-foreground marker:text-muted-foreground mt-3 grid list-disc gap-1.5 pl-5 text-sm">
            <li>An Instagram professional account (Business or Creator).</li>
            <li>A second Instagram account for testing.</li>
            <li>A Facebook account to sign in to the Meta developer dashboard.</li>
            <li>Free GitHub, Supabase and Vercel accounts (or a server with Docker and an HTTPS domain).</li>
          </ul>
          <p className="text-muted-foreground mt-4 text-sm">
            Prefer Bahasa Indonesia?{" "}
            <ExternalLink href={docUrl("panduan-lengkap-id.md")} hrefLang="id">
              Panduan lengkap berbahasa Indonesia
            </ExternalLink>
            .
          </p>
          <nav aria-label="On this page" className="mt-4 border-t pt-4">
            <ol className="grid gap-1 text-sm sm:grid-cols-2">
              {PHASES.map((p) => (
                <li key={p.id}>
                  <a
                    href={`#${p.id}`}
                    className="text-primary font-medium underline-offset-4 hover:underline"
                  >
                    {p.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </section>
      </div>

      {PHASES.map((phase, phaseIndex) => {
        const offset = PHASES.slice(0, phaseIndex).reduce((n, p) => n + p.steps.length, 0);
        return (
          <Section
            key={phase.id}
            id={phase.id}
            title={phase.title}
            intro={phase.intro}
            muted={phaseIndex % 2 === 0}
          >
            <ol className="mx-auto grid max-w-3xl gap-4" start={offset + 1}>
              {phase.steps.map((step, i) => (
                <li key={step.title} className="bg-card flex gap-4 rounded-xl border p-5">
                  <span
                    aria-hidden
                    className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  >
                    {offset + i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-medium">
                      <span className="sr-only">Step {offset + i + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground text-xs">Where: {step.where}</p>
                    <p className="mt-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{step.body}</p>
                    <p className="text-success mt-3 text-sm font-medium">Done when: {step.done}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-center text-sm">
              <ExternalLink href={phase.doc.href}>{phase.doc.label}</ExternalLink>
            </p>
          </Section>
        );
      })}

      <Section
        id="docker"
        title="Rather run it on your own server?"
        intro="Use the published Docker image instead of Vercel + Supabase."
      >
        <div className="mx-auto max-w-3xl">
          <div className="bg-card flex gap-4 rounded-xl border p-5">
            <Container className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="min-w-0 text-sm leading-relaxed">
              <p>
                Docker Compose starts the app, a Postgres 16 database and a small cron service on any VPS or
                home server. Clone the repository, copy <code>.env.example</code> to <code>.env</code>, set{" "}
                <code>APP_SECRET</code>, <code>CRON_SECRET</code> and <code>APP_URL</code>, and run{" "}
                <code className="bg-muted rounded px-1">docker compose up -d</code>. Meta only talks to HTTPS,
                so put a reverse proxy with a certificate in front. Then continue with Part 2.
              </p>
              <p className="mt-3">
                <ExternalLink href={docUrl("docker.md")}>Docker guide</ExternalLink>
              </p>
            </div>
          </div>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Optional extras once everything works:{" "}
            <ExternalLink href={docUrl("n8n.md")}>n8n relay</ExternalLink>. Stuck?{" "}
            <ExternalLink href={docUrl("troubleshooting.md")}>Troubleshooting</ExternalLink>.
          </p>
        </div>
      </Section>

      <FinalCta signedIn={signedIn} />
    </>
  );
}

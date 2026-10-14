import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import {
  ArrowRight,
  BarChart3,
  KeyRound,
  ListChecks,
  MessageSquareReply,
  Send,
  ServerCog,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { SetupRequired } from "@/components/setup-required";
import { InstagramIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { envProblems } from "@/env";
import { APP_NAME, REPO_URL } from "@/lib/constants";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = {
  title: { absolute: `${APP_NAME} · Instagram comment-to-DM automation` },
};

const STEPS = [
  {
    icon: InstagramIcon,
    title: "Someone comments a keyword",
    body: "For example “DRIVE” on your post or reel. Instagram sends the comment to your app.",
  },
  {
    icon: MessageSquareReply,
    title: "The app replies in public",
    body: "A short reply under the comment, picked at random from your variants so it doesn't look robotic.",
  },
  {
    icon: Send,
    title: "And sends a private DM",
    body: "Your link or file goes straight to their inbox, with an optional button.",
  },
] as const;

const FEATURES = [
  {
    icon: ListChecks,
    title: "Keyword rules per post",
    body: "Exact word, contains or any comment. Case and accents are ignored.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Comments, public replies and DMs per post, with success and failure counts.",
  },
  {
    icon: ShieldCheck,
    title: "Safe by default",
    body: "Signed webhooks, encrypted tokens, one DM per comment, no duplicate sends.",
  },
  {
    icon: Workflow,
    title: "n8n ready",
    body: "Forward events to your own workflows with API keys you control.",
  },
  {
    icon: KeyRound,
    title: "Your keys, your data",
    body: "Everything lives in your own database. No per-contact fees.",
  },
  {
    icon: ServerCog,
    title: "Easy to host",
    body: "Vercel + Supabase on free tiers, or one Docker image.",
  },
] as const;

export default async function Home() {
  // Cookie presence only decides the button label; the dashboard still validates the session.
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  const missingEnv = envProblems();

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]"
      />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </Button>
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href={signedIn ? "/dashboard" : "/login"}>{signedIn ? "Dashboard" : "Sign in"}</Link>
          </Button>
        </nav>
      </header>

      <main id="main" className="flex-1">
        {missingEnv.length > 0 ? (
          <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
            <SetupRequired missing={missingEnv} />
          </div>
        ) : null}
        <section className="mx-auto max-w-3xl px-4 pt-12 pb-16 text-center sm:px-6 sm:pt-20">
          <p className="text-muted-foreground mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <InstagramIcon className="size-3.5" />
            Open source · Self-hosted
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Turn Instagram comments into replies and DMs, automatically
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-base text-pretty sm:text-lg">
            When someone comments your keyword, {APP_NAME} replies under the comment and sends them a private
            message with your link. You host it, you own the data.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={signedIn ? "/dashboard" : "/login"}>
                {signedIn ? "Open dashboard" : "Sign in to get started"}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href={`${REPO_URL}/blob/main/docs/deployment.md`} target="_blank" rel="noreferrer">
                Read the setup guide
              </a>
            </Button>
          </div>
        </section>

        <section aria-labelledby="how" className="bg-muted/30 border-y">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
            <h2 id="how" className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
              How it works
            </h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
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
          </div>
        </section>

        <section aria-labelledby="features" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
          <h2 id="features" className="text-center text-xl font-semibold tracking-tight sm:text-2xl">
            What you get
          </h2>
          <ul className="mt-8 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <f.icon className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
                <div>
                  <h3 className="font-medium">{f.title}</h3>
                  <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="start" className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
          <div className="bg-card rounded-2xl border p-6 text-center sm:p-10">
            <h2 id="start" className="text-xl font-semibold tracking-tight sm:text-2xl">
              Set up in about 30 minutes
            </h2>
            <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
              You need an Instagram Business or Creator account, a Meta developer app, and a Postgres
              database. The guides walk you through each step.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a href={`${REPO_URL}/blob/main/docs/meta-setup.md`} target="_blank" rel="noreferrer">
                  Meta app setup
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <a
                  href={`${REPO_URL}/blob/main/docs/panduan-lengkap-id.md`}
                  target="_blank"
                  rel="noreferrer"
                  hrefLang="id"
                >
                  Panduan Bahasa Indonesia
                </a>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground border-t px-4 py-6 text-center text-xs">
        <p>
          {APP_NAME} is free and open source (MIT).{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="underline underline-offset-4">
            Source on GitHub
          </a>
          . Not affiliated with Meta or Instagram.
        </p>
      </footer>
    </div>
  );
}

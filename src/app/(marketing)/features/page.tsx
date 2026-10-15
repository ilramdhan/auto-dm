import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  BarChart3,
  CalendarRange,
  Download,
  FlaskConical,
  Hash,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  MessageSquareReply,
  MoonStar,
  OctagonPause,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserCheck,
  Webhook,
  Workflow,
} from "lucide-react";
import { ExternalLink, FeatureGrid, FinalCta, PageHero, Section } from "@/components/site/section";
import { DM_MAX_CHARS } from "@/lib/constants";
import { publicPageMetadata } from "@/lib/seo";
import { REPO_LINKS } from "@/lib/site-nav";
import { SESSION_COOKIE } from "@/server/auth/session-token";

export const metadata: Metadata = publicPageMetadata({
  title: "Features",
  description:
    "Keyword rules per post, random public replies, personalised DMs with a link button, activity log, analytics with CSV export, kill switch, encrypted secrets and optional n8n.",
  path: "/features",
});

const AUTOMATION = [
  {
    icon: ListChecks,
    title: "Campaigns per post",
    body: "One campaign per post or reel, or one for all posts. Each campaign holds as many rules as you need.",
  },
  {
    icon: Hash,
    title: "Unlimited keywords",
    body: "Up to 50 keywords per rule and no cap on rules. Match by whole word, exact comment or contains.",
  },
  {
    icon: MessageSquareReply,
    title: "Random public replies",
    body: "Up to 10 reply variants per rule. One is picked at random so your replies don't look copy-pasted.",
  },
  {
    icon: Link2,
    title: "Personalised DMs",
    body: `Use {username} and {keyword} in the message (up to ${DM_MAX_CHARS} characters) and add an optional link button.`,
  },
  {
    icon: UserCheck,
    title: "Once per person",
    body: "Optionally message each person only once per rule, even if they comment the keyword again.",
  },
  {
    icon: CalendarRange,
    title: "Start and end dates",
    body: "Give a campaign a start and end time, for a giveaway or a limited offer.",
  },
  {
    icon: FlaskConical,
    title: "Test a comment",
    body: "Type a sample comment to see which rule matches and what would be sent. Nothing is sent.",
  },
  {
    icon: OctagonPause,
    title: "Kill switch",
    body: "Pause all sending instantly from Settings, without touching your campaigns.",
  },
] as const;

const INSIGHT = [
  {
    icon: Webhook,
    title: "Live activity log",
    body: "Every comment with its status (sent, partial, skipped or failed), the matched keyword and the reason when something did not go out.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    body: "Comments, keyword matches, public replies and DMs over time, per campaign, post and keyword.",
  },
  {
    icon: Download,
    title: "CSV export",
    body: "Download Activity and Analytics as CSV for a spreadsheet or report.",
  },
] as const;

const SAFETY = [
  {
    icon: ShieldCheck,
    title: "Verified webhooks",
    body: "Every event from Meta is checked against its signature before anything happens.",
  },
  {
    icon: Repeat,
    title: "No duplicate sends",
    body: "Each comment is processed once, even if Meta delivers it twice. Your own replies are ignored, so it never loops.",
  },
  {
    icon: Lock,
    title: "Encrypted secrets",
    body: "The Instagram token and the Meta app secret are stored encrypted (AES-256-GCM), never in plain text.",
  },
  {
    icon: RefreshCw,
    title: "Automatic token refresh",
    body: "A daily job renews the ~60-day Instagram token so it does not expire on you.",
  },
  {
    icon: Trash2,
    title: "Data retention and deletion",
    body: "Old comment records are deleted after a period you choose. Privacy, terms and data deletion pages for Meta's Live mode are built in.",
  },
  {
    icon: KeyRound,
    title: "Your own Meta app",
    body: "You connect through your own Meta developer app. No third party ever holds your access.",
  },
] as const;

const EXTRAS = [
  {
    icon: Workflow,
    title: "Optional n8n relay",
    body: "Route Meta's events through your own n8n to add steps such as chat alerts or a spreadsheet log, using API keys you create.",
  },
  {
    icon: Smartphone,
    title: "Works on your phone",
    body: "Responsive dashboard that can be installed as an app from the browser.",
  },
  {
    icon: MoonStar,
    title: "Accessible, with dark mode",
    body: "Keyboard friendly, screen reader labels, and a dark theme that follows your system.",
  },
] as const;

export default async function FeaturesPage() {
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return (
    <>
      <PageHero eyebrow="Features" title="Everything for comment-to-DM, in your own hands">
        <p>
          AutoDM does one job well: when someone comments a keyword, it replies under the comment and sends a
          private message. Here is everything that comes with it, free.
        </p>
      </PageHero>

      <Section
        id="automation"
        title="Automation"
        intro="Set up rules once; AutoDM handles every comment."
        muted
      >
        <FeatureGrid items={AUTOMATION} className="lg:grid-cols-4" />
      </Section>

      <Section
        id="insight"
        title="See what happened"
        intro="Know exactly what was sent, to whom, and why not."
      >
        <FeatureGrid items={INSIGHT} />
      </Section>

      <Section id="safety" title="Safe and private by design" muted>
        <FeatureGrid items={SAFETY} />
      </Section>

      <Section id="extras" title="And also">
        <FeatureGrid items={EXTRAS} />
      </Section>

      <Section id="not-included" title="What it does not do" muted>
        <div className="mx-auto max-w-2xl">
          <ul className="marker:text-muted-foreground grid list-disc gap-2 pl-5 text-sm sm:text-base">
            <li>
              It does not send more than one DM per comment, or DMs outside the rules Instagram sets (one
              private reply per comment, within 7 days).
            </li>
            <li>It has no chat flows, broadcasts or visual bot builder.</li>
            <li>One Instagram account per installation. Need another account? Run another copy.</li>
            <li>It is not a hosted service: you run it on your own Vercel + Supabase or server.</li>
          </ul>
          <p className="text-muted-foreground mt-6 text-sm">
            Ideas for the future are discussed openly on{" "}
            <ExternalLink href={REPO_LINKS.discussions}>GitHub Discussions</ExternalLink> (see also the{" "}
            <ExternalLink href={REPO_LINKS.roadmap}>roadmap ideas</ExternalLink>) .
          </p>
        </div>
      </Section>

      <FinalCta signedIn={signedIn} />
    </>
  );
}

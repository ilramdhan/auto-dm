import { DM_MAX_CHARS } from "@/lib/constants";
import { docUrl } from "@/lib/site-nav";

/**
 * Questions for the public FAQ page (and the short list on the home page). Answers are plain text
 * so the same copy feeds the FAQPage JSON-LD. Keep them accurate: they summarise docs/*.md.
 */
export interface FaqItem {
  id: string;
  question: string;
  answer: readonly string[];
  link?: { href: string; label: string };
}

export interface FaqGroup {
  id: string;
  title: string;
  items: readonly FaqItem[];
}

export const FAQ_GROUPS: readonly FaqGroup[] = [
  {
    id: "general",
    title: "General",
    items: [
      {
        id: "what-is-autodm",
        question: "What is AutoDM?",
        answer: [
          "A small web app you run yourself. When someone comments a keyword you chose (for example GUIDE) on one of your Instagram posts or reels, it replies under the comment and sends that person a private message with your link.",
          "It uses Instagram's official API, so you never share your Instagram password with anyone.",
        ],
      },
      {
        id: "is-it-free",
        question: "Is it really free?",
        answer: [
          "The software is free and open source under the MIT license. There are no plans, no per-contact or per-message fees and no limits on posts, keywords or campaigns.",
          "You pay only for hosting if you go beyond free tiers. Instagram's API itself is free to use. Limits come from Meta (see below), not from AutoDM.",
        ],
        link: { href: "/pricing", label: "What hosting costs" },
      },
      {
        id: "who-is-it-for",
        question: "Who is it for?",
        answer: [
          "Creators, small businesses and communities who already use comment keywords to share links, freebies or sign-up forms and want it to happen automatically.",
          "It serves your own Instagram account. It is not a multi-customer SaaS: every person or business runs their own copy.",
        ],
      },
      {
        id: "need-to-code",
        question: "Do I need to know how to code?",
        answer: [
          "No, but you need to be comfortable following a step-by-step guide: creating free accounts on Supabase and Vercel, copying a few values between websites, and creating an app in the Meta developer dashboard. Plan 30 to 60 minutes.",
        ],
        link: { href: "/setup", label: "Read the setup guide" },
      },
      {
        id: "manychat",
        question: "How is it different from ManyChat-style tools?",
        answer: [
          "It focuses on one job: comment keyword to public reply and DM. In exchange you get no monthly fee, no per-contact pricing, and your data stays in your own database. It does not have chat flows, broadcasts or a visual bot builder.",
        ],
      },
    ],
  },
  {
    id: "instagram",
    title: "Instagram rules and limits",
    items: [
      {
        id: "account-type",
        question: "What kind of Instagram account do I need?",
        answer: [
          "A professional account (Business or Creator). You do not need a Facebook Page. In the Instagram app, also turn on Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages, or every DM fails.",
        ],
      },
      {
        id: "second-dm",
        question: "Can I send more than one DM per comment?",
        answer: [
          "No. Instagram allows one private reply per comment, sent within 7 days of the comment. You can send more messages only after the person replies to you, which opens Instagram's normal 24-hour messaging window.",
          `DM text is limited to ${DM_MAX_CHARS} characters. You can add one optional link button.`,
        ],
      },
      {
        id: "dev-vs-live",
        question: "What are Development mode and Live mode?",
        answer: [
          "Every new Meta app starts in Development mode. In that mode only accounts with a role on the app (admins, developers and Instagram Testers you invited) trigger it. To answer comments from everyone, switch the app to Live mode. Meta asks for a privacy policy and data deletion instructions first; AutoDM serves both pages for you.",
        ],
        link: {
          href: docUrl("meta-setup.md", "part-8---development-vs-live-mode-important"),
          label: "Development vs Live mode",
        },
      },
      {
        id: "app-review",
        question: "Do I need Meta App Review?",
        answer: [
          "For your own account, Standard Access is the intended path and App Review is normally not needed. Meta's documentation is not clear on whether comments from the general public reach the app in Live mode without Advanced Access, so test it with an account that is not a tester. If nothing arrives, request Advanced Access through App Review (this can take days to weeks and may need Business Verification).",
        ],
        link: {
          href: docUrl("meta-setup.md", "standard-vs-advanced-access---do-i-need-app-review"),
          label: "Standard vs Advanced Access",
        },
      },
      {
        id: "ban",
        question: "Will Instagram ban my account?",
        answer: [
          "Replying to people who asked for something by commenting a keyword is a supported use of the API. Instagram can still throttle or hide replies that look spammy, so write several reply variants, keep messages relevant, and never message people who did not ask.",
        ],
      },
      {
        id: "rate-limits",
        question: "Are there rate limits?",
        answer: [
          "Yes, set by Meta. Private replies are commonly reported at around 750 per hour per account. A typical account never gets close, but a viral post can. Failures are listed in the Activity page with the reason.",
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    items: [
      {
        id: "test-comment-did-nothing",
        question: "My test comment did nothing. Why?",
        answer: [
          "Comments from your own connected account are always skipped, so the app never replies to itself. Test from a second Instagram account.",
          "While your Meta app is in Development mode, that second account must be added as an Instagram Tester (App roles → Roles → Add People) and must accept the invite in Instagram (Settings → Website permissions → Apps and websites → Tester invites). Also check that the webhook is verified with the comments field subscribed, and that the kill switch in Settings → Processing is off.",
        ],
        link: {
          href: docUrl("troubleshooting.md", "webhook-does-not-fire-no-rows-in-activity"),
          label: "Webhook does not fire",
        },
      },
      {
        id: "reply-but-no-dm",
        question: "The public reply was posted but no DM arrived.",
        answer: [
          "The Activity row shows the error. Common causes: the comment is older than 7 days, a private reply was already sent for that comment, the commenter does not accept messages, Allow access to messages is off on your account, or the message permission was not granted when connecting Instagram.",
        ],
      },
      {
        id: "slow",
        question: "The dashboard is slow.",
        answer: [
          "Almost always the server and the database are in different regions. Set the Vercel function region to the region of your Supabase project and redeploy.",
        ],
        link: { href: docUrl("troubleshooting.md"), label: "All troubleshooting tips" },
      },
    ],
  },
  {
    id: "data",
    title: "Data and privacy",
    items: [
      {
        id: "where-is-data",
        question: "Where is my data stored?",
        answer: [
          "In your own Postgres database (Supabase or the database in the Docker setup). Nobody else, including the AutoDM project, can see it. The Instagram access token and the Meta app secret are encrypted with AES-256-GCM.",
        ],
      },
      {
        id: "commenter-data",
        question: "What does it store about people who comment?",
        answer: [
          "Their Instagram user id and username, the comment text, which keyword matched and whether the reply and DM were sent. Records are deleted automatically after a retention period you choose (365 days by default), and you can delete one person's data on request.",
        ],
        link: { href: "/privacy", label: "Privacy policy template" },
      },
      {
        id: "n8n",
        question: "Can I connect it to n8n?",
        answer: [
          "Yes, optionally. Meta can send comments to your own n8n first, which forwards them to AutoDM, so you can add steps such as chat alerts or a spreadsheet log. AutoDM still does the matching and sending. Get the direct setup working first.",
        ],
        link: { href: docUrl("n8n.md"), label: "n8n guide" },
      },
    ],
  },
];

/** Question ids shown on the home page, in order. */
export const HOME_FAQ_IDS = ["is-it-free", "need-to-code", "second-dm", "test-comment-did-nothing"] as const;

export function findFaqItems(ids: readonly string[]): FaqItem[] {
  const all = FAQ_GROUPS.flatMap((g) => g.items);
  return ids.flatMap((id) => all.filter((item) => item.id === id));
}

/** schema.org FAQPage for the /faq page (JSON-LD). */
export function faqJsonLd(groups: readonly FaqGroup[] = FAQ_GROUPS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((g) =>
      g.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer.join("\n\n") },
      })),
    ),
  };
}

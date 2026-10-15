import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { APP_NAME } from "@/lib/constants";
import { loadPublicContact, loadRetentionDays } from "@/server/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Privacy policy",
  description:
    "What this site stores when you comment on our Instagram posts, why, who it is shared with and how to delete it.",
  path: "/privacy",
});

/** Bump when the wording below changes. */
const LAST_UPDATED = "15 October 2026";

export default async function PrivacyPage() {
  const { operatorName, contactEmail } = await loadPublicContact();
  const retentionDays = await loadRetentionDays();
  const operator = operatorName ?? "the operator of this site";
  const Operator = operatorName ?? "The operator of this site";

  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          Effective date and last updated: <time dateTime="2026-10-15">{LAST_UPDATED}</time>
        </p>
      }
    >
      <LegalSection id="who" title="Who we are">
        <p>
          This site is run by <strong className="font-medium">{operator}</strong> (&ldquo;we&rdquo;). It uses{" "}
          {APP_NAME}, an open-source tool that automatically replies to comments on our Instagram professional
          account and sends a private message (DM) to people who comment a keyword, for example to deliver a
          link they asked for. {Operator} decides how this site is used and is responsible for the data
          described here.
        </p>
      </LegalSection>

      <LegalSection id="data" title="What we store">
        <p>
          <strong className="font-medium">If you comment on one of our posts</strong>, Instagram sends the
          comment to this site. For each comment we process, we store:
        </p>
        <LegalList>
          <li>your Instagram-scoped user id and your Instagram username;</li>
          <li>the text of your comment, and the ids of the comment and the post;</li>
          <li>the keyword your comment matched, if any;</li>
          <li>
            whether our public reply and the private message were sent, skipped or failed (with an error code
            when something went wrong);
          </li>
          <li>when the comment was received and processed.</li>
        </LegalList>
        <p>
          <strong className="font-medium">For the Instagram account connected to this site</strong> (ours), we
          store its Instagram account id, username, display name and profile picture link, and an access token
          that lets this site reply and send messages on its behalf. The token is encrypted.
        </p>
        <p>
          We do not read your other messages, and we never receive your password, email address or phone
          number. Public pages like this one use no analytics or advertising cookies; a sign-in cookie is used
          only for our own dashboard.
        </p>
      </LegalSection>

      <LegalSection id="use" title="Why we use it">
        <LegalList>
          <li>to reply to your comment in public and send you the message you asked for by commenting;</li>
          <li>to avoid sending you the same message twice;</li>
          <li>to see how many comments, replies and messages each post gets.</li>
        </LegalList>
        <p>We don&apos;t use your data for advertising or profiling, and we don&apos;t sell it.</p>
      </LegalSection>

      <LegalSection id="sharing" title="Who we share it with">
        <LegalList>
          <li>
            <strong className="font-medium">Meta (Instagram)</strong>: replies and messages are sent through
            Instagram&apos;s official API. Meta&apos;s own privacy policy covers your use of Instagram.
          </li>
          <li>
            <strong className="font-medium">Hosting providers</strong> that run this site and its database
            store and process the data on our behalf, and only to provide this service.
          </li>
          <li>
            If we use our own automation tools (such as a self-hosted n8n workflow), comment notifications may
            pass through them.
          </li>
        </LegalList>
        <p>We don&apos;t sell, rent or share your data with anyone else.</p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          {retentionDays > 0
            ? `Comment records are deleted automatically after ${retentionDays} days. You can also ask us to delete them sooner. `
            : `Comment records are kept until ${operator} deletes them or you ask us to delete them. `}
          When you ask, everything stored about your Instagram account is deleted. When the connected
          Instagram account is disconnected or removes this app, its access token is deleted straight away.
        </p>
      </LegalSection>

      <LegalSection id="security" title="Security">
        <p>
          Data is sent over HTTPS. Access tokens and other secrets are encrypted at rest, and the dashboard is
          protected by a password. Only {operator} has access to it.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="Your choices and deleting your data">
        <p>
          You can ask to see, correct or delete the data we hold about you. See{" "}
          <Link href="/data-deletion" className="font-medium underline underline-offset-4">
            how to delete your data
          </Link>
          , or contact <ContactLink email={contactEmail} />.
        </p>
      </LegalSection>

      <LegalSection id="children" title="Children">
        <p>This service is not directed at children. Instagram requires users to be at least 13 years old.</p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to this policy">
        <p>If we change this policy, we&apos;ll update it on this page and change the date at the top.</p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about this policy or your data: <ContactLink email={contactEmail} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

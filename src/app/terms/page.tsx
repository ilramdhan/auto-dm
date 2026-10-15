import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalList, LegalPage, LegalSection } from "@/components/legal-page";
import { APP_NAME } from "@/lib/constants";
import { loadPublicContact } from "@/server/legal";

export const metadata: Metadata = { title: "Terms of service" };

/** Bump when the wording below changes. */
const LAST_UPDATED = "15 October 2026";

export default async function TermsPage() {
  const { operatorName, contactEmail } = await loadPublicContact();
  const operator = operatorName ?? "the operator of this site";

  return (
    <LegalPage
      title="Terms of service"
      intro={
        <p>
          Effective date and last updated: <time dateTime="2026-10-15">{LAST_UPDATED}</time>
        </p>
      }
    >
      <LegalSection id="about" title="What this service does">
        <p>
          This site is run by <strong className="font-medium">{operator}</strong> (&ldquo;we&rdquo;). When you
          comment a keyword on one of our Instagram posts, it may reply to your comment in public and send you
          one private message (DM) on Instagram, usually with a link or file you asked for. It is built with{" "}
          {APP_NAME}, an open-source tool.
        </p>
        <p>
          By commenting a keyword we announced, you ask us to send you that message. These terms apply to that
          exchange. If you don&apos;t agree, simply don&apos;t comment the keyword.
        </p>
      </LegalSection>

      <LegalSection id="instagram" title="Instagram's rules still apply">
        <p>
          Comments and messages go through Instagram, so{" "}
          <a
            href="https://help.instagram.com/581066165581870"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Instagram&apos;s Terms of Use
          </a>{" "}
          and Meta&apos;s policies apply as well. Instagram decides whether a message can be delivered (for
          example because of your privacy settings) and limits us to one private reply per comment, within 7
          days.
        </p>
      </LegalSection>

      <LegalSection id="use" title="Fair use">
        <LegalList>
          <li>Don&apos;t use the keyword to spam, harass or impersonate anyone.</li>
          <li>Don&apos;t try to disrupt or break into this site or its dashboard.</li>
          <li>We may ignore or block comments that abuse the service.</li>
        </LegalList>
      </LegalSection>

      <LegalSection id="content" title="Links and content we send">
        <p>
          Messages may link to content or websites run by us or by others. We try to keep them accurate and
          safe, but content provided by third parties is their responsibility, and their own terms apply.
          Content we send you remains ours or its owner&apos;s; you may use it for your own, personal purposes
          unless we say otherwise.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="No guarantees">
        <p>
          The service is free and provided &ldquo;as is&rdquo;. Replies are automatic and may be late, missing
          or sent more than once, for example when Instagram is unavailable or limits messages. We may change,
          pause or stop the service at any time.
        </p>
        <p>
          To the extent the law allows, we are not liable for indirect or consequential losses arising from
          the service. Nothing in these terms limits rights you have under the consumer law that applies to
          you.
        </p>
      </LegalSection>

      <LegalSection id="privacy" title="Your data">
        <p>
          How we handle the data from your comment is described in our{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            privacy policy
          </Link>
          . You can ask us to delete it at any time; see{" "}
          <Link href="/data-deletion" className="underline underline-offset-4">
            data deletion
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes to these terms">
        <p>
          If we change these terms, we&apos;ll update this page and the date at the top. The version shown
          when you comment applies to that comment.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="Contact">
        <p>
          Questions about these terms: <ContactLink email={contactEmail} />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleHelp, SearchX } from "lucide-react";
import { ContactLink, LegalPage, LegalSection } from "@/components/legal-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { confirmationCodeSchema, type DataDeletionStatus } from "@/lib/validation/data-deletion";
import { loadPublicContact, lookupDeletionRequest, type DeletionLookup } from "@/server/legal";

export const metadata: Metadata = { title: "Data deletion" };

const STATUS_TEXT: Record<DataDeletionStatus, { label: string; description: string }> = {
  completed: {
    label: "Completed",
    description: "All data stored about this Instagram account was deleted.",
  },
  no_data: {
    label: "Completed",
    description: "We had no data stored about this Instagram account, so there was nothing to delete.",
  },
};

function formatUtc(date: Date): string {
  return `${date.toLocaleString("en", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" })} UTC`;
}

export default async function DataDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code: rawCode } = await searchParams;
  const [{ operatorName, contactEmail }, lookup] = await Promise.all([
    loadPublicContact(),
    statusFor(rawCode),
  ]);
  const operator = operatorName ?? "the operator of this site";

  return (
    <LegalPage
      title="Data deletion"
      intro={<p>How to delete the data this site stores about you, and the status of your request.</p>}
    >
      {lookup ? <RequestStatus lookup={lookup} /> : null}

      <LegalSection id="remove-app" title="If you connected your Instagram account to this site">
        <p>Remove the app from your Instagram settings:</p>
        <ol className="marker:text-muted-foreground grid list-decimal gap-1.5 pl-5">
          <li>In Instagram, open your profile and tap the menu (☰).</li>
          <li>
            Go to{" "}
            <strong className="font-medium">
              Settings and activity → Website permissions → Apps and websites
            </strong>
            .
          </li>
          <li>
            Under Active, select this app and tap <strong className="font-medium">Remove</strong>.
          </li>
        </ol>
        <p>
          Instagram then notifies this site automatically: the stored access token is deleted right away. If
          you also send a data deletion request from there, everything stored about your account is deleted
          automatically and you&apos;ll get a confirmation code you can check on this page.
        </p>
      </LegalSection>

      <LegalSection id="email" title="If you commented on one of our posts">
        <p>
          Email <ContactLink email={contactEmail} /> with your Instagram username and ask for your data to be
          deleted. {operatorName ?? "The operator"} will delete the stored comments, replies and message
          records linked to your account and reply with a confirmation code you can check on this page.
        </p>
      </LegalSection>

      <LegalSection id="what" title="What gets deleted">
        <p>
          Everything listed in the{" "}
          <Link href="/privacy" className="font-medium underline underline-offset-4">
            privacy policy
          </Link>
          : your comments and their keyword, reply and message status, and, for a connected account, its
          access token and profile details. Messages already delivered to your Instagram inbox are kept by
          Instagram, and you can delete them there. Questions? Contact{" "}
          {contactEmail ? <ContactLink email={contactEmail} /> : operator}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

/** `undefined` when no code was given. */
async function statusFor(
  rawCode: string | string[] | undefined,
): Promise<DeletionLookup | "invalid" | undefined> {
  if (rawCode === undefined) return undefined;
  const parsed = confirmationCodeSchema.safeParse(Array.isArray(rawCode) ? rawCode[0] : rawCode);
  if (!parsed.success) return "invalid";
  return lookupDeletionRequest(parsed.data);
}

function RequestStatus({ lookup }: { lookup: DeletionLookup | "invalid" }) {
  if (lookup === "invalid" || lookup.kind === "not_found") {
    return (
      <Alert variant="warning">
        <SearchX aria-hidden />
        <AlertTitle>Request not found</AlertTitle>
        <AlertDescription>
          <p>
            We couldn&apos;t find a deletion request with this confirmation code. Check that you copied the
            whole link.
          </p>
        </AlertDescription>
      </Alert>
    );
  }
  if (lookup.kind === "unavailable") {
    return (
      <Alert variant="warning">
        <CircleHelp aria-hidden />
        <AlertTitle>Status unavailable</AlertTitle>
        <AlertDescription>
          <p>We can&apos;t look up deletion requests right now. Please try again later.</p>
        </AlertDescription>
      </Alert>
    );
  }
  const { status, createdAt, completedAt } = lookup.request;
  const text = STATUS_TEXT[status];
  return (
    <section aria-labelledby="request-status" className="bg-card grid gap-3 rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="request-status" className="text-lg font-semibold tracking-tight">
          Your deletion request
        </h2>
        <Badge variant="success">
          <CheckCircle2 aria-hidden /> Status: {text.label}
        </Badge>
      </div>
      <p className="text-sm">{text.description}</p>
      <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt>Received</dt>
        <dd className="text-foreground">{formatUtc(createdAt)}</dd>
        {completedAt ? (
          <>
            <dt>Completed</dt>
            <dd className="text-foreground">{formatUtc(completedAt)}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}

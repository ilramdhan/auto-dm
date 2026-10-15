import {
  BookOpen,
  Bug,
  CircleArrowUp,
  CircleCheck,
  CloudOff,
  ExternalLink,
  GitPullRequest,
  Lightbulb,
  MessagesSquare,
  ShieldAlert,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/copy-button";
import { stripV } from "@/lib/semver";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { checkForUpdates, getAppVersion, REPO, type AppVersion, type UpdateCheck } from "@/server/updates";
import { ReleaseNotesView } from "./release-notes-view";

const DOCKER_UPDATE = "docker compose pull && docker compose up -d";

/** Async wrapper: render inside <Suspense> so a slow GitHub call never blocks the other tabs. */
export async function AboutTab({ timeZone }: { timeZone: string }) {
  const check = await checkForUpdates();
  return <AboutView version={getAppVersion()} check={check} timeZone={timeZone} />;
}

/** Small marker next to the About tab label when a newer release exists. */
export async function AboutUpdateMarker() {
  const check = await checkForUpdates();
  if (!check.ok || !check.updateAvailable) return null;
  return (
    <>
      <span className="bg-info size-2 rounded-full" aria-hidden />
      <span className="sr-only">(update available)</span>
    </>
  );
}

export function AboutTabSkeleton() {
  return (
    <div
      className="grid max-w-3xl grid-cols-1 gap-6"
      aria-busy="true"
      aria-label="Loading version information"
    >
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export function AboutView({
  version,
  check,
  timeZone,
}: {
  version: AppVersion;
  check: UpdateCheck;
  timeZone: string;
}) {
  const tz = isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <VersionCard version={version} check={check} />
      <WhatsNewCard check={check} timeZone={tz} />
      <HowToUpdateCard />
      <CommunityCard />
    </div>
  );
}

function ExtLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-4 focus-visible:ring-[3px] focus-visible:outline-none",
        className,
      )}
    >
      {children}
      <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

function UpdateStatusBadge({ check }: { check: UpdateCheck }) {
  if (!check.ok) {
    return (
      <Badge variant="muted" className="whitespace-normal">
        <CloudOff aria-hidden /> Couldn&apos;t check for updates
      </Badge>
    );
  }
  if (check.updateAvailable && check.latest) {
    return (
      <Badge variant="info" className="whitespace-normal">
        <CircleArrowUp aria-hidden /> Update available v{stripV(check.latest.tag)}
      </Badge>
    );
  }
  return (
    <Badge variant="success">
      <CircleCheck aria-hidden /> Up to date
    </Badge>
  );
}

function VersionCard({ version, check }: { version: AppVersion; check: UpdateCheck }) {
  const latest = check.ok ? check.latest : null;
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:grid">
        <CardTitle role="heading" aria-level={2}>
          Version
        </CardTitle>
        <CardDescription>The release this deployment is running.</CardDescription>
        <CardAction className="col-start-auto row-start-auto sm:col-start-2 sm:row-span-2 sm:row-start-1">
          <UpdateStatusBadge check={check} />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm min-[400px]:grid-cols-3">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-mono">v{version.version}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Commit</dt>
            <dd className="font-mono">{version.commit ?? "—"}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Environment</dt>
            <dd>{version.environment}</dd>
          </div>
        </dl>
        {check.ok && check.updateAvailable && latest ? (
          <Alert variant="info">
            <CircleArrowUp aria-hidden />
            <AlertTitle>{latest.name} is available</AlertTitle>
            <AlertDescription>
              <p>
                You&apos;re on v{version.version}. Read the release notes, then follow{" "}
                <a
                  href="#how-to-update"
                  className="focus-visible:ring-ring/50 rounded-sm underline underline-offset-4 focus-visible:ring-[3px] focus-visible:outline-none"
                >
                  How to update
                </a>
                .
              </p>
              <ExtLink href={latest.url}>View release</ExtLink>
            </AlertDescription>
          </Alert>
        ) : null}
        {check.ok && !check.updateAvailable && latest ? (
          <p className="text-muted-foreground text-sm">
            Latest release: <ExtLink href={latest.url}>{latest.name}</ExtLink>
          </p>
        ) : null}
        {!check.ok ? (
          <p className="text-muted-foreground text-sm">
            GitHub couldn&apos;t be reached (offline, blocked or rate-limited). It&apos;s checked again
            automatically; you can also look at the <ExtLink href={REPO.releases}>releases page</ExtLink>.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function formatReleaseDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone }).format(new Date(iso));
}

function WhatsNewCard({ check, timeZone }: { check: UpdateCheck; timeZone: string }) {
  const releases = check.ok ? check.releases.slice(0, 3) : [];
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          What&apos;s new
        </CardTitle>
        <CardDescription>Recent releases of auto-reply-ig.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {releases.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {check.ok
              ? "No releases published yet."
              : "Release notes are unavailable right now. Use the links below to read them on GitHub."}
          </p>
        ) : (
          <ol className="grid gap-6">
            {releases.map((r) => {
              const installed = stripV(r.tag) === check.current;
              const latest = check.ok && check.latest?.tag === r.tag;
              return (
                <li key={r.tag} className="grid gap-3 border-b pb-6 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.publishedAt ? (
                      <time dateTime={r.publishedAt} className="text-muted-foreground text-sm">
                        {formatReleaseDate(r.publishedAt, timeZone)}
                      </time>
                    ) : null}
                    {latest ? <Badge variant="info">Latest</Badge> : null}
                    {installed ? <Badge variant="success">Installed</Badge> : null}
                    {r.prerelease ? <Badge variant="warning">Pre-release</Badge> : null}
                  </div>
                  <ReleaseNotesView body={r.body} />
                  <ExtLink href={r.url} className="w-fit text-sm">
                    Full release {r.tag}
                  </ExtLink>
                </li>
              );
            })}
          </ol>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-sm">
          <ExtLink href={REPO.releases}>All releases</ExtLink>
          <ExtLink href={REPO.changelog}>Full changelog</ExtLink>
        </div>
      </CardContent>
    </Card>
  );
}

function HowToUpdateCard() {
  return (
    <Card id="how-to-update" className="scroll-mt-20">
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          How to update
        </CardTitle>
        <CardDescription>
          Read the release notes and back up the database before a major version.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 text-sm">
        <section className="grid gap-2">
          <h3 className="font-medium">Vercel (GitHub fork)</h3>
          <ol className="text-muted-foreground grid list-decimal gap-1 pl-5">
            <li>Open your fork on GitHub.</li>
            <li>
              Click <span className="text-foreground font-medium">Sync fork</span> →{" "}
              <span className="text-foreground font-medium">Update branch</span>.
            </li>
            <li>Vercel redeploys automatically and applies new database migrations during the build.</li>
          </ol>
          <ExtLink href={REPO.upgradeVercel} className="w-fit">
            Upgrading guide
          </ExtLink>
        </section>
        <section className="grid gap-2">
          <h3 className="font-medium">Docker</h3>
          <p className="text-muted-foreground">
            In the folder with your <code className="font-mono">docker-compose.yml</code>:
          </p>
          <div className="bg-muted flex items-center gap-2 rounded-md border p-2 pl-3">
            <code className="min-w-0 flex-1 font-mono text-xs break-words">{DOCKER_UPDATE}</code>
            <CopyButton value={DOCKER_UPDATE} label="Copy update command" size="icon-sm" variant="ghost" />
          </div>
          <p className="text-muted-foreground">Migrations run automatically when the container starts.</p>
          <ExtLink href={REPO.upgradeDocker} className="w-fit">
            Docker upgrading guide
          </ExtLink>
        </section>
      </CardContent>
    </Card>
  );
}

const COMMUNITY_LINKS = [
  {
    href: REPO.discussions,
    label: "Discussions",
    hint: "Questions and ideas",
    icon: MessagesSquare,
  },
  { href: REPO.bugReport, label: "Report a bug", hint: "Open a bug report", icon: Bug },
  { href: REPO.featureRequest, label: "Request a feature", hint: "Suggest an improvement", icon: Lightbulb },
  { href: REPO.pulls, label: "Pull requests", hint: "Contribute code or docs", icon: GitPullRequest },
  {
    href: REPO.securityAdvisory,
    label: "Report a vulnerability",
    hint: "Private security advisory",
    icon: ShieldAlert,
  },
  { href: REPO.docs, label: "Documentation", hint: "Setup and troubleshooting guides", icon: BookOpen },
] as const;

function CommunityCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>
          Community &amp; support
        </CardTitle>
        <CardDescription>
          auto-reply-ig is open source. Get help, report issues or contribute.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {COMMUNITY_LINKS.map(({ href, label, hint, icon: Icon }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-accent focus-visible:ring-ring/50 flex items-start gap-3 rounded-md border p-3 text-sm transition-colors focus-visible:ring-[3px] focus-visible:outline-none motion-reduce:transition-none"
              >
                <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="grid min-w-0 gap-0.5">
                  <span className="font-medium">
                    {label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                  <span className="text-muted-foreground text-xs">{hint}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

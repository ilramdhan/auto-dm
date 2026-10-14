import Link from "next/link";
import { ExternalLink, Globe, ImageOff } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { pct } from "@/lib/validation/analytics";
import { formatNumber, timeAgo } from "@/lib/format";

export type ContentRowView = {
  key: string;
  campaignId: string | null;
  name: string;
  mediaId: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  allPosts: boolean;
  comments: number;
  matched: number;
  repliesSent: number;
  repliesFailed: number;
  dmsSent: number;
  dmsFailed: number;
  delivered: number;
  lastActivity: Date | null;
};

function Thumb({ row }: { row: ContentRowView }) {
  if (row.thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs, not optimizable
      <img
        src={row.thumbnailUrl}
        alt=""
        className="size-10 shrink-0 rounded-md border object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span
      className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md border"
      aria-hidden
    >
      {row.allPosts ? <Globe className="size-4" /> : <ImageOff className="size-4" />}
    </span>
  );
}

function Name({ row }: { row: ContentRowView }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Thumb row={row} />
      <div className="min-w-0">
        {row.campaignId ? (
          <Link href={`/campaigns/${row.campaignId}`} className="block truncate font-medium hover:underline">
            {row.name}
          </Link>
        ) : (
          <span className="block truncate font-medium">{row.name}</span>
        )}
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {row.allPosts ? <Badge variant="muted">All posts</Badge> : null}
          {row.permalink ? (
            <a
              href={row.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:underline"
            >
              View post <ExternalLink className="size-3" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SentFailed({ sent, failed }: { sent: number; failed: number }) {
  return (
    <span className="tabular-nums">
      <span className="font-medium">{formatNumber(sent)}</span>
      {failed > 0 ? <span className="text-destructive"> / {formatNumber(failed)} failed</span> : null}
    </span>
  );
}

function successRate(r: ContentRowView): string {
  const v = pct(r.delivered, r.matched);
  return v === null ? "—" : `${v}%`;
}

export function ContentTable({ rows }: { rows: ContentRowView[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No content with activity in this period.
      </p>
    );
  }
  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Content</TableHead>
              <TableHead className="text-right">Comments</TableHead>
              <TableHead className="text-right">Matched</TableHead>
              <TableHead className="text-right">Replies sent</TableHead>
              <TableHead className="text-right">DMs sent</TableHead>
              <TableHead className="text-right">Success</TableHead>
              <TableHead className="text-right">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="max-w-72">
                  <Name row={r} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.comments)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.matched)}</TableCell>
                <TableCell className="text-right">
                  <SentFailed sent={r.repliesSent} failed={r.repliesFailed} />
                </TableCell>
                <TableCell className="text-right">
                  <SentFailed sent={r.dmsSent} failed={r.dmsFailed} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{successRate(r)}</TableCell>
                <TableCell className="text-muted-foreground text-right text-xs">
                  {r.lastActivity ? timeAgo(r.lastActivity) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {/* Mobile cards */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.key} className="rounded-lg border p-3">
            <Name row={r} />
            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Comments</dt>
                <dd className="font-medium tabular-nums">{formatNumber(r.comments)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Matched</dt>
                <dd className="font-medium tabular-nums">{formatNumber(r.matched)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Success</dt>
                <dd className="font-medium tabular-nums">{successRate(r)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Replies</dt>
                <dd className="text-xs">
                  <SentFailed sent={r.repliesSent} failed={r.repliesFailed} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">DMs</dt>
                <dd className="text-xs">
                  <SentFailed sent={r.dmsSent} failed={r.dmsFailed} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Last</dt>
                <dd className="text-xs">{r.lastActivity ? timeAgo(r.lastActivity) : "—"}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

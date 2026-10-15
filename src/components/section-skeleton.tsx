import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Fallback for one streamed `<Suspense>` section. `aria-busy` plus screen-reader text say what is
 * loading; the pulse animation stops under `prefers-reduced-motion` (globals.css). Deliberately not a
 * live region: several sections load at once and would all be announced.
 */
export function SectionSkeleton({
  label,
  className,
  children,
}: {
  /** What is loading, e.g. "key metrics" (read as "Loading key metrics…"). */
  label: string;
  /** Classes for the wrapper (size/grid). Without children the wrapper itself is the placeholder. */
  className?: string;
  /** Custom placeholder shape. */
  children?: React.ReactNode;
}) {
  return (
    <div
      aria-busy="true"
      data-slot="section-skeleton"
      className={cn(!children && "bg-accent animate-pulse rounded-xl", className)}
    >
      <span className="sr-only">Loading {label}…</span>
      {children ? <div aria-hidden>{children}</div> : null}
    </div>
  );
}

/** Placeholder rows for a list or table. */
export function RowsSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("grid gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

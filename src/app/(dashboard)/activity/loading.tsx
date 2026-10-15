import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6" data-route-loading aria-busy="true" aria-label="Loading activity">
      <Skeleton className="h-8 w-32" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-52" />
      </div>
      <div className="grid gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

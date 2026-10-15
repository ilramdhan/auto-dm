import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6" data-route-loading aria-busy="true" aria-label="Loading campaign">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-9 w-56" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-3">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

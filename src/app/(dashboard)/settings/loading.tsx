import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-6" data-route-loading aria-busy="true" aria-label="Loading settings">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-9 w-80 max-w-full" />
      <Skeleton className="h-64 max-w-3xl rounded-xl" />
      <Skeleton className="h-48 max-w-3xl rounded-xl" />
    </div>
  );
}

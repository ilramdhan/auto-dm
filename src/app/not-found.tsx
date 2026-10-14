import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      <BrandMark className="size-10" />
      <div className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full">
        <Compass className="size-7" aria-hidden />
      </div>
      <div className="space-y-2">
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Page not found</h1>
        <p className="text-muted-foreground mx-auto max-w-md text-sm">
          The page you were looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">
          <ArrowLeft aria-hidden />
          Back to dashboard
        </Link>
      </Button>
    </main>
  );
}

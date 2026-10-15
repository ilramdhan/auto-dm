"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Reloads the URL the user was trying to open (the service worker served this page in its place). */
export function RetryButton() {
  return (
    <Button size="lg" className="min-h-11" onClick={() => window.location.reload()}>
      <RotateCw aria-hidden />
      Try again
    </Button>
  );
}

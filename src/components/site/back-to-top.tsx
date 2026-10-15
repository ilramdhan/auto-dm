"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Floating "back to top" button, shown after scrolling about one screen down. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function toTop() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    // Move focus to the top of the page so keyboard users continue from there.
    document.getElementById("top")?.focus({ preventScroll: true });
  }

  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      onClick={toTop}
      aria-label="Back to top"
      // Hidden from everyone (incl. keyboard) until it is useful.
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={cn(
        "fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 size-11 rounded-full shadow-md transition-opacity",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp aria-hidden />
    </Button>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu } from "lucide-react";
import { Brand } from "@/components/brand";
import { GitHubIcon } from "@/components/site/logos";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isCurrentPath, MAIN_NAV, REPO_LINKS } from "@/lib/site-nav";
import { cn } from "@/lib/utils";

/** Desktop menu in the sticky header. */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {MAIN_NAV.map((link) => {
          const current = isCurrentPath(pathname, link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "hover:text-foreground hover:bg-accent focus-visible:ring-ring/50 rounded-md px-3 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]",
                  current ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone menu: a sheet with the same links plus the calls to action. */
export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="pt-safe-0 w-[85%] max-w-xs">
        <SheetHeader className="border-b">
          <SheetTitle>
            <Brand />
          </SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="px-2">
          <ul className="grid gap-1">
            {[{ href: "/", label: "Home" }, ...MAIN_NAV].map((link) => {
              const current = isCurrentPath(pathname, link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={close}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 items-center rounded-md px-3 text-base font-medium outline-none focus-visible:ring-[3px]",
                      current && "bg-accent",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            <li>
              <a
                href={REPO_LINKS.repo}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 items-center gap-2 rounded-md px-3 text-base font-medium outline-none focus-visible:ring-[3px]"
              >
                <GitHubIcon className="size-4" />
                GitHub
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </nav>
        <div className="pb-safe-4 mt-auto grid gap-2 border-t px-4 pt-4">
          <Button asChild size="lg">
            <Link href="/setup" onClick={close}>
              Get started
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={signedIn ? "/dashboard" : "/login"} onClick={close}>
              {signedIn ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

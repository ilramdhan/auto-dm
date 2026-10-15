"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Brand } from "@/components/brand";
import { NavLinks } from "./nav-links";
import { StatusCard, type ShellStatus } from "./status-card";

export function MobileNav({ status }: { status: ShellStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="size-11 lg:hidden" aria-label="Open navigation menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        // Safe-area insets for the installed app, and a 44px close button (the primitive's is 16px).
        className="bg-sidebar pl-safe-0 pb-safe-0 w-72 max-w-[85vw] p-0 [&>button:last-child]:top-2 [&>button:last-child]:right-2 [&>button:last-child]:flex [&>button:last-child]:size-11 [&>button:last-child]:items-center [&>button:last-child]:justify-center [&>button:last-child]:rounded-md"
      >
        <SheetHeader className="pt-safe-4 border-b pr-14">
          <SheetTitle>
            <Brand />
          </SheetTitle>
          <SheetDescription className="sr-only">Main navigation</SheetDescription>
        </SheetHeader>
        <nav aria-label="Main" className="px-3">
          <NavLinks onNavigate={() => setOpen(false)} touch />
        </nav>
        <div className="mt-auto p-3">
          <StatusCard status={status} onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

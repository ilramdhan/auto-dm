import Link from "next/link";
import { Brand } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/constants";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { StatusCard, type ShellStatus } from "./status-card";
import { UserMenu } from "./user-menu";

export function AppShell({
  username,
  status,
  children,
}: {
  username: string;
  status: ShellStatus;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="bg-primary text-primary-foreground focus-visible:ring-ring/50 sr-only z-[60] rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>

      <aside className="bg-sidebar text-sidebar-foreground fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
        <div className="pt-safe-0 box-content flex h-14 items-center px-5">
          <Link href="/dashboard" className="rounded-md" aria-label={`${APP_NAME} dashboard`}>
            <Brand />
          </Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </nav>
        <div className="pb-safe-3 px-3 pt-3">
          <StatusCard status={status} />
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="bg-background/80 supports-[backdrop-filter]:bg-background/65 pt-safe-0 sticky top-0 z-20 box-content flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-6">
          <MobileNav status={status} />
          <Link
            href="/dashboard"
            className="focus-visible:ring-ring/50 flex min-h-11 items-center rounded-md outline-none focus-visible:ring-[3px] lg:hidden"
            aria-label={`${APP_NAME} dashboard`}
          >
            <Brand />
          </Link>
          <div className="ml-auto flex items-center gap-1 max-lg:[&>button]:min-h-11 max-lg:[&>button]:min-w-11">
            <ThemeToggle />
            <UserMenu username={username} />
          </div>
        </header>
        <main
          id="main"
          tabIndex={-1}
          className="pb-safe-6 lg:pb-safe-8 mx-auto w-full max-w-6xl px-4 pt-6 outline-none sm:px-6 lg:pt-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

import { cookies } from "next/headers";
import { SiteShell } from "@/components/site/site-shell";
import { SESSION_COOKIE } from "@/server/auth/session-token";

/** Public website: home, features, setup guide, pricing, FAQ and the legal pages. */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Cookie presence only decides the button label; the dashboard still validates the session.
  const signedIn = (await cookies()).has(SESSION_COOKIE);
  return <SiteShell signedIn={signedIn}>{children}</SiteShell>;
}

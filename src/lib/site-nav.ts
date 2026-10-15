import { REPO_URL } from "@/lib/constants";

/** Navigation for the public website (header, mobile menu and footer). */

export interface NavLink {
  href: string;
  label: string;
  /** Opens another site (GitHub). Rendered as a plain `<a>` with `rel="noreferrer"`. */
  external?: boolean;
  /** Language of the target page when it differs from the site (English). */
  hrefLang?: string;
}

export interface NavColumn {
  title: string;
  links: readonly NavLink[];
}

/** A file in the repository's `docs/` folder on GitHub, with an optional `#anchor`. */
export function docUrl(file: string, anchor?: string): string {
  const hash = anchor ? `#${anchor.replace(/^#/, "")}` : "";
  return `${REPO_URL}/blob/main/docs/${file}${hash}`;
}

export const REPO_LINKS = {
  repo: REPO_URL,
  docs: `${REPO_URL}/blob/main/docs/README.md`,
  discussions: `${REPO_URL}/discussions`,
  issues: `${REPO_URL}/issues`,
  releases: `${REPO_URL}/releases`,
  contributing: `${REPO_URL}/blob/main/CONTRIBUTING.md`,
  security: `${REPO_URL}/blob/main/SECURITY.md`,
  license: `${REPO_URL}/blob/main/LICENSE`,
  roadmap: `${REPO_URL}#roadmap-ideas`,
} as const;

/** Main menu: header on wide screens, the sheet on phones. */
export const MAIN_NAV: readonly NavLink[] = [
  { href: "/features", label: "Features" },
  { href: "/setup", label: "Setup guide" },
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
];

export const FOOTER_COLUMNS: readonly NavColumn[] = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Home" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Get started",
    links: [
      { href: "/setup", label: "Setup guide" },
      { href: "/login", label: "Sign in" },
      { href: docUrl("deployment.md"), label: "Deployment docs", external: true },
      { href: docUrl("meta-setup.md"), label: "Meta app setup", external: true },
      {
        href: docUrl("panduan-lengkap-id.md"),
        label: "Panduan Bahasa Indonesia",
        external: true,
        hrefLang: "id",
      },
    ],
  },
  {
    title: "Community",
    links: [
      { href: REPO_LINKS.repo, label: "GitHub", external: true },
      { href: REPO_LINKS.docs, label: "Docs", external: true },
      { href: REPO_LINKS.discussions, label: "Discussions", external: true },
      { href: REPO_LINKS.releases, label: "Releases", external: true },
      { href: REPO_LINKS.contributing, label: "Contributing", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/data-deletion", label: "Data deletion" },
      { href: REPO_LINKS.license, label: "MIT license", external: true },
    ],
  },
];

/**
 * Whether a menu link points at the current page (for `aria-current="page"`). In-page anchors and
 * external links are never "current"; `/` only matches itself.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (!href.startsWith("/") || href.includes("#")) return false;
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (href === "/") return clean === "/";
  return clean === href || clean.startsWith(`${href}/`);
}

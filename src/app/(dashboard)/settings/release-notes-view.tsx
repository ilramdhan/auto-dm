import { parseReleaseNotes } from "@/lib/release-notes";

/**
 * Renders a release body as plain React elements (headings, lists, links) — never as HTML.
 * Only https://github.com/ links survive parsing; they open in a new tab.
 */
export function ReleaseNotesView({ body, headingLevel = 4 }: { body: string; headingLevel?: 3 | 4 | 5 }) {
  const notes = parseReleaseNotes(body);
  if (notes.sections.length === 0) {
    return <p className="text-muted-foreground text-sm">No release notes.</p>;
  }
  const Heading = `h${headingLevel}` as const;
  return (
    <div className="grid gap-3 text-sm">
      {notes.sections.map((section, i) => (
        <section key={i} className="grid gap-1.5">
          {section.title ? <Heading className="font-medium">{section.title}</Heading> : null}
          <ul className="text-muted-foreground grid list-disc gap-1 pl-5 marker:text-current">
            {section.items.map((item, j) => (
              <li key={j} className="break-words">
                {item.text ? <span className="text-foreground">{item.text}</span> : null}
                {item.links.length > 0 ? (
                  <span className="ml-1 inline-flex flex-wrap gap-x-1.5">
                    {item.links.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-foreground focus-visible:ring-ring/50 rounded-sm font-mono text-xs underline underline-offset-4 focus-visible:ring-[3px] focus-visible:outline-none"
                      >
                        {link.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {notes.truncated ? (
        <p className="text-muted-foreground text-xs">Shortened — see the full release.</p>
      ) : null}
    </div>
  );
}

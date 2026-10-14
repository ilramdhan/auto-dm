"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { splitKeywords } from "@/lib/validation/rule";

/**
 * Chips input: Enter or comma adds, Backspace on an empty field removes the last chip,
 * pasting "a, b, c" adds several. Duplicates (case-insensitive) are ignored.
 */
export function KeywordInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  max = 50,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  invalid?: boolean;
  describedBy?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const [announce, setAnnounce] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function add(raw: string) {
    const parts = splitKeywords(raw).map((k) => k.slice(0, 50));
    if (!parts.length) return;
    const lower = new Set(value.map((v) => v.toLocaleLowerCase()));
    const next = [...value];
    const added: string[] = [];
    for (const p of parts) {
      if (next.length >= max) break;
      if (lower.has(p.toLocaleLowerCase())) continue;
      lower.add(p.toLocaleLowerCase());
      next.push(p);
      added.push(p);
    }
    if (added.length) {
      onChange(next);
      setAnnounce(`Added ${added.join(", ")}`);
    }
    setDraft("");
  }

  function remove(i: number) {
    const removed = value[i];
    onChange(value.filter((_, idx) => idx !== i));
    setAnnounce(`Removed ${removed}`);
    inputRef.current?.focus();
  }

  return (
    <div
      className={cn(
        "border-input dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]",
        invalid && "border-destructive",
      )}
      onClick={() => inputRef.current?.focus()}
    >
      <ul className="contents" aria-label="Keywords">
        {value.map((k, i) => (
          <li
            key={`${k}-${i}`}
            className="bg-secondary text-secondary-foreground inline-flex max-w-full items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2 text-sm"
          >
            <span className="truncate">{k}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                remove(i);
              }}
              className="hover:bg-foreground/10 focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-[3px]"
              aria-label={`Remove keyword ${k}`}
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            e.preventDefault();
            remove(value.length - 1);
          }
        }}
        onBlur={() => draft && add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[,\n]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={value.length ? "Add another…" : "Type a keyword and press Enter"}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        enterKeyHint="enter"
        autoComplete="off"
        className="placeholder:text-muted-foreground min-w-32 flex-1 bg-transparent px-1 py-0.5 text-base outline-none md:text-sm"
      />
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

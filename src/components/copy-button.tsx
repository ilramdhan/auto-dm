"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  getValue,
  label = "Copy",
  size = "icon",
  variant = "outline",
}: {
  value?: string;
  /** Lazily resolve the value (e.g. via a server action) */
  getValue?: () => Promise<string | null>;
  label?: string;
  size?: "icon" | "sm" | "default" | "icon-sm";
  variant?: "outline" | "ghost" | "secondary";
}) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const text = value ?? (getValue ? await getValue() : null);
    if (!text) {
      toast.error("Nothing to copy");
      return;
    }
    if (await copyText(text)) {
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } else {
      toast.error("Couldn't access the clipboard");
    }
  }
  const icon = copied ? <Check aria-hidden /> : <Copy aria-hidden />;
  const isIcon = size === "icon" || size === "icon-sm";
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onClick}
      aria-label={isIcon ? label : undefined}
    >
      {icon}
      {isIcon ? null : copied ? "Copied" : label}
    </Button>
  );
}

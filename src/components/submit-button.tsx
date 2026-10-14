"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { pending?: boolean; pendingText?: string };

/** Submit button that shows a spinner while its parent <form> (or `pending`) is busy. */
export function SubmitButton({ children, pending, pendingText, disabled, ...props }: Props) {
  const status = useFormStatus();
  const busy = pending ?? status.pending;
  return (
    <Button type="submit" disabled={busy || disabled} aria-busy={busy || undefined} {...props}>
      {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
      {busy && pendingText ? pendingText : children}
    </Button>
  );
}

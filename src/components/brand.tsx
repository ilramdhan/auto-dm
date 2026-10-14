import { MessageCircleReply } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "brand-gradient inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
        className,
      )}
    >
      <MessageCircleReply className="size-[55%]" strokeWidth={2.25} />
    </span>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-[0.95rem] font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  );
}

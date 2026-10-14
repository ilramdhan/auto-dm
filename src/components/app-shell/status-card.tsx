import Link from "next/link";
import { PauseCircle, PlayCircle } from "lucide-react";
import { InstagramIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ShellStatus = {
  account: { username: string; profilePictureUrl: string | null } | null;
  processingEnabled: boolean;
  mode: "webhook" | "n8n";
};

export function StatusCard({ status, onNavigate }: { status: ShellStatus; onNavigate?: () => void }) {
  return (
    <div className="bg-background/60 grid gap-3 rounded-lg border p-3 text-sm">
      {status.account ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-8">
            {status.account.profilePictureUrl ? (
              <AvatarImage src={status.account.profilePictureUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-xs">
              {status.account.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">@{status.account.username}</p>
            <p className="text-muted-foreground text-xs">Instagram connected</p>
          </div>
        </div>
      ) : (
        <Link
          href="/settings?tab=instagram"
          onClick={onNavigate}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-sm"
        >
          <InstagramIcon className="size-4" aria-hidden />
          <span>Instagram not connected</span>
        </Link>
      )}
      <Link
        href="/settings?tab=processing"
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2 rounded-sm text-xs font-medium",
          status.processingEnabled ? "text-success" : "text-warning",
        )}
      >
        {status.processingEnabled ? (
          <PlayCircle className="size-4" aria-hidden />
        ) : (
          <PauseCircle className="size-4" aria-hidden />
        )}
        {status.processingEnabled ? "Automation on" : "Automation paused"}
        <span className="text-muted-foreground font-normal">
          · {status.mode === "n8n" ? "via n8n" : "direct webhook"}
        </span>
      </Link>
    </div>
  );
}

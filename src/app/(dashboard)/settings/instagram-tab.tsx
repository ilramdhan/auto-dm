"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CopyButton } from "@/components/copy-button";
import { FieldError } from "@/components/field-error";
import { InstagramIcon } from "@/components/icons";
import { PasswordInput } from "@/components/password-input";
import type { FieldErrors } from "@/lib/action-result";
import { formatDateTime } from "@/lib/format";
import {
  disconnectInstagramAction,
  regenerateVerifyTokenAction,
  revealVerifyTokenAction,
  saveMetaAppAction,
} from "./actions";

type Account = {
  username: string;
  name: string | null;
  profilePictureUrl: string | null;
  tokenExpiresAt: Date | null;
  /** Computed on the server so render stays pure. */
  tokenDaysLeft: number | null;
};

export type MetaReviewUrls = {
  privacyPolicy: string;
  termsOfService: string;
  dataDeletionInstructions: string;
  deauthorizeCallback: string;
  dataDeletionCallback: string;
};

export function InstagramTab(props: {
  appId: string;
  appSecretConfigured: boolean;
  account: Account | null;
  webhookUrl: string;
  redirectUri: string;
  receivedEvents: boolean;
  mode: "webhook" | "n8n";
  metaReview: MetaReviewUrls;
  contactConfigured: boolean;
}) {
  const configured = !!props.appId && props.appSecretConfigured;
  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <MetaAppCard
        appId={props.appId}
        secretConfigured={props.appSecretConfigured}
        redirectUri={props.redirectUri}
      />
      <ConnectionCard account={props.account} configured={configured} />
      <WebhookCard webhookUrl={props.webhookUrl} receivedEvents={props.receivedEvents} mode={props.mode} />
      <MetaReviewCard urls={props.metaReview} contactConfigured={props.contactConfigured} />
    </div>
  );
}

function CopyField({
  id,
  label,
  value,
  help,
}: {
  id: string;
  label: string;
  value: string;
  help?: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          readOnly
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
          aria-describedby={help ? `${id}-help` : undefined}
        />
        <CopyButton value={value} label={`Copy ${label}`} />
      </div>
      {help ? (
        <p id={`${id}-help`} className="text-muted-foreground text-xs">
          {help}
        </p>
      ) : null}
    </div>
  );
}

function MetaAppCard({
  appId,
  secretConfigured,
  redirectUri,
}: {
  appId: string;
  secretConfigured: boolean;
  redirectUri: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState({ appId, appSecret: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <Card>
      <form
        noValidate
        className="grid grid-cols-1 gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveMetaAppAction(values);
            if (res.ok) {
              setErrors({});
              setValues((v) => ({ ...v, appSecret: "" }));
              toast.success("Meta app credentials saved");
              router.refresh();
            } else {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.error);
            }
          });
        }}
      >
        <CardHeader>
          <CardTitle>Meta app</CardTitle>
          <CardDescription>
            From developers.facebook.com → your app → Instagram → API setup with Instagram login.
          </CardDescription>
          <CardAction>
            {appId && secretConfigured ? (
              <Badge variant="success">
                <CheckCircle2 aria-hidden /> Configured
              </Badge>
            ) : (
              <Badge variant="muted">
                <CircleDashed aria-hidden /> Not configured
              </Badge>
            )}
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="meta-app-id">Instagram App ID</Label>
              <Input
                id="meta-app-id"
                inputMode="numeric"
                autoComplete="off"
                value={values.appId}
                onChange={(e) => setValues((v) => ({ ...v, appId: e.target.value }))}
                aria-invalid={!!errors.appId}
                aria-describedby={errors.appId ? "meta-app-id-error" : undefined}
              />
              <FieldError id="meta-app-id-error" errors={errors.appId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meta-app-secret" className="flex items-center gap-2">
                Instagram App Secret
                {secretConfigured ? (
                  <span className="text-success inline-flex items-center gap-1 text-xs font-normal">
                    <ShieldCheck className="size-3.5" aria-hidden /> stored encrypted
                  </span>
                ) : null}
              </Label>
              <PasswordInput
                id="meta-app-secret"
                autoComplete="off"
                placeholder={secretConfigured ? "•••••••••••• (leave blank to keep)" : ""}
                value={values.appSecret}
                onChange={(e) => setValues((v) => ({ ...v, appSecret: e.target.value }))}
                aria-invalid={!!errors.appSecret}
                aria-describedby={`meta-app-secret-help${errors.appSecret ? " meta-app-secret-error" : ""}`}
              />
              <p id="meta-app-secret-help" className="text-muted-foreground text-xs">
                Write-only. It&apos;s never shown again or sent to the browser.
              </p>
              <FieldError id="meta-app-secret-error" errors={errors.appSecret} />
            </div>
          </div>
          <CopyField
            id="oauth-redirect"
            label="OAuth redirect URI"
            value={redirectUri}
            help="Add this under “Valid OAuth Redirect URIs” in the Instagram business login settings."
          />
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save credentials
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ConnectionCard({ account, configured }: { account: Account | null; configured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const daysLeft = account?.tokenDaysLeft ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instagram account</CardTitle>
        <CardDescription>
          A professional (Business or Creator) account. Tokens refresh automatically every day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {account ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar className="size-12">
                {account.profilePictureUrl ? <AvatarImage src={account.profilePictureUrl} alt="" /> : null}
                <AvatarFallback>{account.username.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  @{account.username}
                  <Badge variant="success">
                    <CheckCircle2 aria-hidden /> Connected
                  </Badge>
                </p>
                {account.name ? (
                  <p className="text-muted-foreground truncate text-sm">{account.name}</p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {account.tokenExpiresAt
                    ? `Token valid until ${formatDateTime(account.tokenExpiresAt)}${daysLeft !== null ? ` (${daysLeft} days)` : ""}`
                    : "Token expiry unknown"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/api/instagram/oauth/start">
                  <RefreshCw aria-hidden /> Reconnect
                </a>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect @{account.username}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The stored access token is deleted and comments stop being processed. Campaigns and
                      history are kept, so you can reconnect any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive hover:bg-destructive/90 text-white"
                      onClick={() =>
                        start(async () => {
                          const res = await disconnectInstagramAction({});
                          if (res.ok) {
                            toast.success("Instagram disconnected");
                            router.refresh();
                          } else toast.error(res.error);
                        })
                      }
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5 sm:flex-row sm:items-center">
            <span className="brand-gradient flex size-10 shrink-0 items-center justify-center rounded-lg text-white">
              <InstagramIcon className="size-5" />
            </span>
            <div className="flex-1">
              <p className="font-medium">Not connected</p>
              <p className="text-muted-foreground text-sm">
                {configured
                  ? "You'll be sent to Instagram to approve access."
                  : "Save your Meta app credentials above first."}
              </p>
            </div>
            {configured ? (
              <Button asChild>
                <a href="/api/instagram/oauth/start">Connect Instagram</a>
              </Button>
            ) : (
              <Button disabled>Connect Instagram</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WebhookCard({
  webhookUrl,
  receivedEvents,
  mode,
}: {
  webhookUrl: string;
  receivedEvents: boolean;
  mode: "webhook" | "n8n";
}) {
  const [token, setToken] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();

  async function fetchToken(): Promise<string | null> {
    if (token) return token;
    const res = await revealVerifyTokenAction({});
    if (!res.ok) {
      toast.error(res.error);
      return null;
    }
    setToken(res.data.token);
    return res.data.token;
  }

  return (
    <Card id="webhook" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Webhook</CardTitle>
        <CardDescription>Tells Meta where to send new comments.</CardDescription>
        <CardAction>
          {receivedEvents ? (
            <Badge variant="success">
              <CheckCircle2 aria-hidden /> Receiving events
            </Badge>
          ) : (
            <Badge variant="muted">
              <CircleDashed aria-hidden /> No events yet
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        {mode === "n8n" ? (
          <Alert variant="info">
            <AlertDescription>
              Processing mode is <strong>n8n</strong>: point Meta at your n8n webhook URL instead (see the n8n
              tab). Use the verify token below in both places.
            </AlertDescription>
          </Alert>
        ) : null}
        <CopyField id="webhook-url" label="Callback URL" value={webhookUrl} />
        <div className="grid gap-2">
          <Label htmlFor="verify-token">Verify token</Label>
          <div className="flex gap-2">
            <Input
              id="verify-token"
              readOnly
              className="font-mono text-xs"
              value={visible && token ? token : "••••••••••••••••••••••••••••••••"}
              aria-label={visible ? "Verify token" : "Verify token (hidden)"}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={visible ? "Hide verify token" : "Show verify token"}
              aria-pressed={visible}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  if (!visible && !(await fetchToken())) return;
                  setVisible((v) => !v);
                })
              }
            >
              {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
            </Button>
            <CopyButton getValue={fetchToken} label="Copy verify token" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs">Generated automatically and stored encrypted.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="link" size="sm" className="h-auto px-0 text-xs">
                  Regenerate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Regenerate verify token?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You&apos;ll need to paste the new token in the Meta dashboard (and n8n, if used) and
                    verify the webhook again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      start(async () => {
                        const res = await regenerateVerifyTokenAction({});
                        if (res.ok) {
                          setToken(res.data.token);
                          setVisible(true);
                          toast.success("New verify token generated");
                        } else toast.error(res.error);
                      })
                    }
                  >
                    Regenerate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        <ol className="text-muted-foreground grid list-decimal gap-1.5 pl-5 text-sm marker:font-medium">
          <li>In your Meta app open Instagram → API setup with Instagram login → Configure webhooks.</li>
          <li>Paste the callback URL and verify token, then click “Verify and save”.</li>
          <li>
            Subscribe to the <code className="text-foreground">comments</code> field.
          </li>
          <li>
            Connect your account above (this also subscribes it to webhooks), then comment on a post to test.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}

/** The four URLs Meta asks for before the app can be switched to Live mode. */
function MetaReviewCard({ urls, contactConfigured }: { urls: MetaReviewUrls; contactConfigured: boolean }) {
  return (
    <Card id="meta-review" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Meta app review</CardTitle>
        <CardDescription>
          Meta requires a privacy policy and user data deletion handling before your app can go Live. This app
          provides all four URLs.
        </CardDescription>
        <CardAction>
          {contactConfigured ? (
            <Badge variant="success">
              <CheckCircle2 aria-hidden /> Ready
            </Badge>
          ) : (
            <Badge variant="warning">
              <AlertTriangle aria-hidden /> Contact missing
            </Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-6">
        {contactConfigured ? null : (
          <Alert variant="warning">
            <AlertTriangle aria-hidden />
            <AlertDescription>
              <p>
                Add your name and a contact email in{" "}
                <Link
                  href="/settings?tab=account#public-contact"
                  className="font-medium underline underline-offset-4"
                >
                  Settings → Account → Public contact
                </Link>{" "}
                first. The privacy policy uses generic wording until you do.
              </p>
            </AlertDescription>
          </Alert>
        )}
        <section aria-labelledby="meta-review-basic" className="grid gap-4">
          <div>
            <h3 id="meta-review-basic" className="text-sm font-medium">
              App settings → Basic
            </h3>
            <p className="text-muted-foreground text-xs">
              In your Meta app open App settings → Basic and fill in these fields.
            </p>
          </div>
          <CopyField
            id="meta-privacy-url"
            label="Privacy Policy URL"
            value={urls.privacyPolicy}
            help="Paste into “Privacy Policy URL”."
          />
          <CopyField
            id="meta-terms-url"
            label="Terms of Service URL"
            value={urls.termsOfService}
            help="Paste into “Terms of Service URL” (optional in Meta, but recommended)."
          />
          <CopyField
            id="meta-deletion-instructions-url"
            label="Data deletion instructions URL"
            value={urls.dataDeletionInstructions}
            help="Under “User data deletion”, choose “Data deletion instructions URL” and paste this."
          />
        </section>
        <section aria-labelledby="meta-review-business-login" className="grid gap-4">
          <div>
            <h3 id="meta-review-business-login" className="text-sm font-medium">
              Business login settings
            </h3>
            <p className="text-muted-foreground text-xs">
              Instagram → API setup with Instagram login → Set up Instagram business login → Business login
              settings.
            </p>
          </div>
          <CopyField
            id="meta-deauthorize-url"
            label="Deauthorize callback URL"
            value={urls.deauthorizeCallback}
            help="Meta calls it when someone removes your app; their stored token is wiped."
          />
          <CopyField
            id="meta-deletion-callback-url"
            label="Data deletion request URL"
            value={urls.dataDeletionCallback}
            help="Meta calls it when someone asks for their data to be deleted; it is deleted right away."
          />
        </section>
      </CardContent>
    </Card>
  );
}

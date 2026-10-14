import type { Metadata } from "next";
import { KeyRound, Settings2, Workflow } from "lucide-react";
import { TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { UrlTabs } from "@/components/url-tabs";
import { FlashToast, type Flash } from "@/components/flash-toast";
import { InstagramIcon } from "@/components/icons";
import { appUrl } from "@/env";
import { requireUser } from "@/server/auth/guard";
import { listApiKeys } from "@/server/api-keys";
import { getActiveAccount } from "@/server/instagram/account";
import { oauthRedirectUri } from "@/server/instagram/oauth";
import { hasAnyDelivery } from "@/server/repos/deliveries";
import { getPublicSettings } from "@/server/settings";
import { AccountTab } from "./account-tab";
import { InstagramTab } from "./instagram-tab";
import { ProcessingTab } from "./processing-tab";
import { N8nTab } from "./n8n-tab";

export const metadata: Metadata = { title: "Settings" };

const TABS = ["account", "instagram", "processing", "n8n"] as const;

const OAUTH_ERRORS: Record<string, string> = {
  missing_app_credentials: "Add your Meta App ID and App Secret first.",
  access_denied: "Instagram authorization was cancelled.",
  invalid_state: "The connection request expired or was tampered with. Please try again.",
  missing_code: "Instagram didn't return an authorization code. Please try again.",
  missing_permissions: "Some permissions were not granted. Allow all requested permissions and try again.",
  token_exchange_failed: "Couldn't exchange the authorization code. Check the App Secret and redirect URI.",
  profile_fetch_failed: "Connected, but couldn't read the account profile. Please try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; connected?: string; error?: string; warning?: string }>;
}) {
  const user = await requireUser();
  const [sp, settings, account, apiKeys, anyDelivery] = await Promise.all([
    searchParams,
    getPublicSettings(),
    getActiveAccount(),
    listApiKeys(),
    hasAnyDelivery(),
  ]);

  const flashes: Flash[] = [];
  if (sp.connected === "1")
    flashes.push({
      type: "success",
      message: "Instagram connected",
      description: account ? `Signed in as @${account.username}` : undefined,
    });
  if (sp.warning === "subscribe_failed")
    flashes.push({
      type: "warning",
      message: "Couldn't subscribe to comment webhooks",
      description: "Check the webhook settings in your Meta app, then reconnect.",
    });
  if (sp.error)
    flashes.push({
      type: "error",
      message: "Instagram connection failed",
      description: OAUTH_ERRORS[sp.error] ?? "Please try again.",
    });

  const base = appUrl();

  return (
    <div className="grid grid-cols-1 gap-6">
      <FlashToast flashes={flashes} clearParams={["connected", "error", "warning"]} />
      <PageHeader title="Settings" description="Account, Instagram connection and automation behaviour." />
      <UrlTabs defaultValue="account" values={TABS} className="gap-6">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-max">
            <TabsTrigger value="account">
              <KeyRound className="hidden sm:block" aria-hidden /> Account
            </TabsTrigger>
            <TabsTrigger value="instagram">
              <InstagramIcon className="hidden size-4 sm:block" /> Instagram
            </TabsTrigger>
            <TabsTrigger value="processing">
              <Settings2 className="hidden sm:block" aria-hidden /> Processing
            </TabsTrigger>
            <TabsTrigger value="n8n">
              <Workflow className="hidden sm:block" aria-hidden /> n8n
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="account">
          <AccountTab username={user.username} />
        </TabsContent>
        <TabsContent value="instagram">
          <InstagramTab
            appId={settings["meta.appId"].value ?? ""}
            appSecretConfigured={settings["meta.appSecret"].configured}
            account={
              account
                ? {
                    username: account.username,
                    name: account.name,
                    profilePictureUrl: account.profilePictureUrl,
                    tokenExpiresAt: account.tokenExpiresAt,
                  }
                : null
            }
            webhookUrl={`${base}/api/webhooks/instagram`}
            redirectUri={oauthRedirectUri()}
            receivedEvents={anyDelivery}
            mode={settings["processing.mode"].value ?? "webhook"}
          />
        </TabsContent>
        <TabsContent value="processing">
          <ProcessingTab
            mode={settings["processing.mode"].value ?? "webhook"}
            enabled={settings["processing.enabled"].value ?? true}
          />
        </TabsContent>
        <TabsContent value="n8n">
          <N8nTab keys={apiKeys} appUrl={base} mode={settings["processing.mode"].value ?? "webhook"} />
        </TabsContent>
      </UrlTabs>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/server/auth/guard";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ChangePasswordPage() {
  const user = await requireSession();
  // Voluntary changes live in Settings (they require the current password).
  if (!user.mustChangePassword) redirect("/settings?tab=account");
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <div className="bg-primary/10 text-primary mx-auto mb-2 flex size-11 items-center justify-center rounded-full">
          <ShieldCheck className="size-5" aria-hidden />
        </div>
        <CardTitle className="text-xl">Secure your account</CardTitle>
        <CardDescription>
          You signed in with the default password. Choose a new one to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChangePasswordForm username={user.username} />
      </CardContent>
    </Card>
  );
}

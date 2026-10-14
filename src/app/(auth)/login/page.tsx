import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SetupRequired } from "@/components/setup-required";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { envProblems } from "@/env";
import { getCurrentUser } from "@/server/auth/guard";
import { hasAnyUser } from "@/server/auth/users";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  // Fresh deploy without env vars: explain what to set instead of crashing on the DB lookup.
  const missingEnv = envProblems();
  if (missingEnv.length > 0) return <SetupRequired missing={missingEnv} />;
  const user = await getCurrentUser();
  if (user) redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
  const { next } = await searchParams;
  const firstRun = !(await hasAnyUser());

  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Manage your Instagram comment automations.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={next} firstRun={firstRun} />
      </CardContent>
    </Card>
  );
}

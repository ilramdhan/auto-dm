"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/field-error";
import { loginAction } from "./actions";

export function LoginForm({ next, firstRun }: { next?: string; firstRun: boolean }) {
  const [state, action] = useActionState(loginAction, null);
  // Controlled so React 19's post-action form reset doesn't wipe it after a failed attempt.
  const [username, setUsername] = useState("");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {firstRun ? (
        <Alert variant="info">
          <Info aria-hidden />
          <AlertTitle>First run</AlertTitle>
          <AlertDescription>
            <p>
              Sign in with the default credentials from your environment (
              <code className="text-xs">ADMIN_DEFAULT_USERNAME</code> /{" "}
              <code className="text-xs">ADMIN_DEFAULT_PASSWORD</code>). You&apos;ll be asked to choose a new
              password right away.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {state && !state.ok && !fe ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertCircle aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          aria-invalid={!!fe?.username}
          aria-describedby={fe?.username ? "username-error" : undefined}
        />
        <FieldError id="username-error" errors={fe?.username} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fe?.password}
          aria-describedby={fe?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error" errors={fe?.password} />
      </div>
      <SubmitButton className="mt-2 w-full" pendingText="Signing in…">
        Sign in
      </SubmitButton>
    </form>
  );
}

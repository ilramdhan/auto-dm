"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength";
import { SubmitButton } from "@/components/submit-button";
import { FieldError } from "@/components/field-error";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants";
import { forcedChangePasswordAction } from "./actions";

export function ChangePasswordForm({ username }: { username: string }) {
  const [state, action] = useActionState(forcedChangePasswordAction, null);
  const [password, setPassword] = useState("");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {/* Helps password managers associate the new password with the account. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      {state && !state.ok && !fe ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={!!fe?.password}
          aria-describedby={`password-strength${fe?.password ? " password-error" : ""}`}
        />
        <PasswordStrengthMeter id="password-strength" password={password} />
        <FieldError id="password-error" errors={fe?.password} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          aria-invalid={!!fe?.confirm}
          aria-describedby={fe?.confirm ? "confirm-error" : undefined}
        />
        <FieldError id="confirm-error" errors={fe?.confirm} />
      </div>
      <p className="text-muted-foreground text-xs">
        At least {PASSWORD_MIN_LENGTH} characters. A passphrase of a few random words works great. You&apos;ll
        stay signed in on this device; other sessions are signed out.
      </p>
      <SubmitButton className="w-full" pendingText="Saving…">
        Save and continue
      </SubmitButton>
    </form>
  );
}

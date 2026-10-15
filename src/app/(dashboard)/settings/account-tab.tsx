"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength";
import { FieldError } from "@/components/field-error";
import type { FieldErrors } from "@/lib/action-result";
import { changePasswordAction, changeUsernameAction } from "./actions";
import { PublicContactCard } from "./public-contact-card";

export function AccountTab({
  username,
  operatorName,
  contactEmail,
}: {
  username: string;
  operatorName: string;
  contactEmail: string;
}) {
  return (
    <div className="grid max-w-2xl grid-cols-1 gap-6">
      <UsernameCard username={username} />
      <PasswordCard username={username} />
      <PublicContactCard operatorName={operatorName} contactEmail={contactEmail} />
    </div>
  );
}

function UsernameCard({ username }: { username: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [values, setValues] = useState({ username, current: "" });
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <Card>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await changeUsernameAction(values);
            if (res.ok) {
              setErrors({});
              setValues((v) => ({ ...v, current: "" }));
              toast.success("Username updated");
              router.refresh();
            } else {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.error);
            }
          });
        }}
        className="grid grid-cols-1 gap-6"
      >
        <CardHeader>
          <CardTitle>Username</CardTitle>
          <CardDescription>Used to sign in to this dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="acc-username">Username</Label>
            <Input
              id="acc-username"
              autoComplete="username"
              value={values.username}
              onChange={(e) => setValues((v) => ({ ...v, username: e.target.value }))}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? "acc-username-error" : undefined}
            />
            <FieldError id="acc-username-error" errors={errors.username} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acc-username-current">Current password</Label>
            <PasswordInput
              id="acc-username-current"
              autoComplete="current-password"
              value={values.current}
              onChange={(e) => setValues((v) => ({ ...v, current: e.target.value }))}
              aria-invalid={!!errors.current}
              aria-describedby={errors.current ? "acc-username-current-error" : undefined}
            />
            <FieldError id="acc-username-current-error" errors={errors.current} />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={pending || values.username === username}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save username
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function PasswordCard({ username }: { username: string }) {
  const [pending, start] = useTransition();
  const empty = { current: "", password: "", confirm: "" };
  const [values, setValues] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  return (
    <Card>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await changePasswordAction(values);
            if (res.ok) {
              setErrors({});
              setValues(empty);
              toast.success("Password changed", { description: "Other sessions have been signed out." });
            } else {
              setErrors(res.fieldErrors ?? {});
              toast.error(res.error);
            }
          });
        }}
        className="grid grid-cols-1 gap-6"
      >
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Changing it signs out every other session.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
          <div className="grid gap-2">
            <Label htmlFor="pw-current">Current password</Label>
            <PasswordInput
              id="pw-current"
              autoComplete="current-password"
              value={values.current}
              onChange={set("current")}
              aria-invalid={!!errors.current}
              aria-describedby={errors.current ? "pw-current-error" : undefined}
            />
            <FieldError id="pw-current-error" errors={errors.current} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-new">New password</Label>
            <PasswordInput
              id="pw-new"
              autoComplete="new-password"
              value={values.password}
              onChange={set("password")}
              aria-invalid={!!errors.password}
              aria-describedby={`pw-strength${errors.password ? " pw-new-error" : ""}`}
            />
            <PasswordStrengthMeter id="pw-strength" password={values.password} />
            <FieldError id="pw-new-error" errors={errors.password} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <PasswordInput
              id="pw-confirm"
              autoComplete="new-password"
              value={values.confirm}
              onChange={set("confirm")}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? "pw-confirm-error" : undefined}
            />
            <FieldError id="pw-confirm-error" errors={errors.confirm} />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Change password
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

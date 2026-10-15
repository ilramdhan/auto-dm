"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/field-error";
import { handleActionResult } from "@/lib/forms";
import { publicContactSchema, type PublicContactInput } from "@/lib/validation/settings";
import { savePublicContactAction } from "./actions";

/** Operator name + contact email shown on the public /privacy and /data-deletion pages. */
export function PublicContactCard({
  operatorName,
  contactEmail,
}: {
  operatorName: string;
  contactEmail: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, handleSubmit, setError, reset, formState } = useForm<PublicContactInput>({
    resolver: zodResolver(publicContactSchema),
    defaultValues: { operatorName, contactEmail },
  });
  const { errors, isDirty } = formState;

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = await savePublicContactAction(values);
      if (!handleActionResult(res, setError)) return;
      reset(values);
      toast.success("Public contact saved", {
        description: "Shown on your privacy policy and data deletion pages.",
      });
      router.refresh();
    }),
  );

  return (
    <Card id="public-contact" className="scroll-mt-20">
      <form noValidate onSubmit={onSubmit} className="grid grid-cols-1 gap-6">
        <CardHeader>
          <CardTitle>Public contact</CardTitle>
          <CardDescription>
            Shown on the public{" "}
            <Link href="/privacy" target="_blank" className="underline underline-offset-4">
              privacy policy
              <ExternalLink className="ml-0.5 inline size-3" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>{" "}
            and{" "}
            <Link href="/data-deletion" target="_blank" className="underline underline-offset-4">
              data deletion
              <ExternalLink className="ml-0.5 inline size-3" aria-hidden />
              <span className="sr-only"> (opens in a new tab)</span>
            </Link>{" "}
            pages that Meta requires before your app can go Live.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contact-operator">Your name or business name</Label>
            <Input
              id="contact-operator"
              autoComplete="organization"
              maxLength={100}
              aria-invalid={!!errors.operatorName}
              aria-describedby={`contact-operator-help${errors.operatorName ? " contact-operator-error" : ""}`}
              {...register("operatorName")}
            />
            <p id="contact-operator-help" className="text-muted-foreground text-xs">
              Named as the operator of this site, responsible for the data it stores.
            </p>
            <FieldError
              id="contact-operator-error"
              errors={errors.operatorName?.message ? [errors.operatorName.message] : undefined}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contact-email">Contact email</Label>
            <Input
              id="contact-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={!!errors.contactEmail}
              aria-describedby={`contact-email-help${errors.contactEmail ? " contact-email-error" : ""}`}
              {...register("contactEmail")}
            />
            <p id="contact-email-help" className="text-muted-foreground text-xs">
              Where people can send privacy questions and deletion requests. It is public.
            </p>
            <FieldError
              id="contact-email-error"
              errors={errors.contactEmail?.message ? [errors.contactEmail.message] : undefined}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          {isDirty ? <span className="text-muted-foreground mr-auto text-sm">Unsaved changes</span> : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save contact
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

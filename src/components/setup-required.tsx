import { Settings2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { REPO_URL } from "@/lib/constants";

/** Shown instead of a crash when required environment variables are missing (fresh deploy). */
export function SetupRequired({ missing }: { missing: string[] }) {
  return (
    <Alert role="status" variant="warning" className="text-left">
      <Settings2 aria-hidden />
      <AlertTitle>Setup needed</AlertTitle>
      <AlertDescription>
        <p>
          This server is missing{" "}
          {missing.map((name, i) => (
            <span key={name}>
              {i > 0 ? (i === missing.length - 1 ? " and " : ", ") : null}
              <code className="font-mono text-xs">{name}</code>
            </span>
          ))}
          . On Vercel: Project → Settings → Environment Variables, add them, then redeploy (the database
          tables are created during the build).
        </p>
        <p>
          <a
            href={`${REPO_URL}/blob/main/docs/deployment.md`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            Deployment guide
          </a>
        </p>
      </AlertDescription>
    </Alert>
  );
}

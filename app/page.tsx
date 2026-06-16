import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { hasEnvVars } from "@/lib/utils";
import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <nav className="flex h-16 w-full items-center justify-between border-b border-border bg-background px-5 text-sm">
        <Link href="/" className="flex items-center gap-3 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
            <BriefcaseBusiness className="h-4 w-4" />
          </span>
          <span>AI 求职画布</span>
        </Link>

        {!hasEnvVars ? (
          <EnvVarWarning />
        ) : (
          <Suspense>
            <AuthButton />
          </Suspense>
        )}
      </nav>

      <section className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-5">
        <h1 className="text-center text-4xl font-semibold tracking-normal text-foreground sm:text-5xl">
          AI 求职画布
        </h1>
      </section>
    </main>
  );
}

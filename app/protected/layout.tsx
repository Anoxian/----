import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background">
      <nav className="flex h-16 w-full items-center justify-between border-b border-border bg-background px-5 text-sm">
        <Link href="/protected" className="flex items-center gap-3 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
            <BriefcaseBusiness className="h-4 w-4" />
          </span>
          <span>Career Canvas</span>
        </Link>

        <div className="flex items-center gap-3">
          <ThemeSwitcher />
          {!hasEnvVars ? (
            <EnvVarWarning />
          ) : (
            <Suspense>
              <AuthButton />
            </Suspense>
          )}
        </div>
      </nav>
      <div className="w-full">
        {children}
      </div>
    </main>
  );
}

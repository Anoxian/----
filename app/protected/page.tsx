import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { CareerWorkspace } from "@/components/career-canvas/career-workspace";

async function ProtectedWorkspaceGate() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return <CareerWorkspace />;
}

export default function ProtectedPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center text-sm text-muted-foreground">
          正在进入求职画布
        </div>
      }
    >
      <ProtectedWorkspaceGate />
    </Suspense>
  );
}

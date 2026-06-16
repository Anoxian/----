"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, BriefcaseBusiness, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      // Update this route to redirect to an authenticated route. The user already has an active session.
      router.push("/protected");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden rounded-lg border-white/12 bg-black/42 text-white shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <CardHeader className="space-y-4 border-b border-white/10 bg-white/[0.03] px-6 py-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white shadow-[0_0_36px_rgba(255,87,34,0.22)]">
            <BriefcaseBusiness className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl tracking-normal text-white">
            登录 AI 求职画布
          </CardTitle>
          <CardDescription className="text-white/50">
            进入你的求职工作区。
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-white/72">
                  邮箱
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 border-white/12 bg-white/[0.06] text-white shadow-none placeholder:text-white/25 focus-visible:ring-[#ff5722]/70"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-white/72">
                    密码
                  </Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm text-white/38 underline-offset-4 hover:text-white/78 hover:underline"
                  >
                    忘记密码？
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 border-white/12 bg-white/[0.06] text-white shadow-none focus-visible:ring-[#ff5722]/70"
                />
              </div>
              {error ? (
                <p className="rounded-md border border-[#ff5722]/30 bg-[#ff5722]/10 px-3 py-2 text-sm leading-5 text-orange-100">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                className="h-11 w-full rounded-md bg-white text-black shadow-[0_0_36px_rgba(255,255,255,0.12)] hover:bg-[#ff5722] hover:text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="h-4 w-4" />
                )}
                {isLoading ? "正在登录" : "进入工作区"}
              </Button>
            </div>
            <div className="mt-5 text-center text-sm text-white/42">
              还没有账号？{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-white underline-offset-4 hover:text-[#ff5722] hover:underline"
              >
                注册
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

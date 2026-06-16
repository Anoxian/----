import { LoginForm } from "@/components/login-form";
import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-black text-white">
      <ShaderBackdrop />

      <nav className="relative z-10 flex h-16 items-center justify-between px-5 text-sm text-white/78">
        <Link
          href="/"
          className="flex items-center gap-3 font-medium tracking-normal"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/8 text-white shadow-[0_0_30px_rgba(255,87,34,0.18)]">
            <BriefcaseBusiness className="h-4 w-4" />
          </span>
          <span>AI 求职画布</span>
        </Link>
        <span className="hidden font-mono text-xs text-white/35 sm:block">
          RESUME / JD / CANVAS
        </span>
      </nav>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-10 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:px-8">
        <section className="min-w-0">
          <div className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-xs text-white/52 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff5722] shadow-[0_0_18px_rgba(255,87,34,0.9)]" />
            WORKSPACE ONLINE
          </div>

          <h1 className="max-w-3xl text-5xl font-semibold leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
            Job search,
            <span className="block text-white/38">mapped in motion.</span>
          </h1>

          <div className="mt-10">
            <CanvasPreview />
          </div>
        </section>

        <div className="w-full">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

function ShaderBackdrop() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 opacity-75 [background:linear-gradient(115deg,rgba(255,87,34,0.32)_0%,rgba(255,87,34,0)_24%,rgba(255,255,255,0.11)_46%,rgba(26,26,26,0.86)_72%,rgba(0,0,0,1)_100%)]" />
      <div className="absolute inset-0 opacity-55 [background:repeating-linear-gradient(90deg,rgba(255,255,255,0.06)_0_1px,transparent_1px_92px),repeating-linear-gradient(0deg,rgba(255,255,255,0.045)_0_1px,transparent_1px_92px)]" />
      <div className="absolute inset-0 opacity-40 [background:conic-gradient(from_180deg_at_50%_50%,rgba(255,255,255,0.15),rgba(255,87,34,0.18),rgba(0,0,0,0.1),rgba(255,255,255,0.12),rgba(0,0,0,0.1))] [mask-image:radial-gradient(ellipse_at_center,black_0%,black_45%,transparent_78%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:linear-gradient(to_bottom,transparent,black_24%,black_70%,transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.2)_48%,rgba(0,0,0,0.92)_100%)]" />
    </div>
  );
}

function CanvasPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-black/18 p-4 shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="relative h-40 sm:h-56">
        <div className="absolute left-0 top-0 h-56 w-[494px] origin-top-left scale-[0.68] sm:scale-100">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:28px_28px]" />
          <div className="absolute left-5 top-7 h-px w-28 bg-white/22" />
          <div className="absolute left-[148px] top-[72px] h-px w-28 bg-white/22" />
          <div className="absolute left-[274px] top-[126px] h-px w-24 bg-white/22" />
          <PreviewNode
            className="left-0 top-0 border-[#ff5722]/35 bg-[#ff5722]/12"
            label="用户画像"
            lines={["背景摘要", "优势", "待补充"]}
          />
          <PreviewNode
            className="left-[126px] top-12 border-white/16 bg-white/[0.08]"
            label="岗位方向"
            lines={["APM", "数据分析", "AI 产品"]}
          />
          <PreviewNode
            className="left-[252px] top-[104px] border-white/16 bg-white/[0.08]"
            label="JD 匹配"
            lines={["评分", "关键词", "差距"]}
          />
          <PreviewNode
            className="left-[366px] top-[82px] border-[#ff5722]/35 bg-[#ff5722]/12"
            label="简历 V2"
            lines={["摘要", "经历", "技能"]}
          />
        </div>
      </div>
    </div>
  );
}

function PreviewNode({
  className,
  label,
  lines,
}: {
  className: string;
  label: string;
  lines: string[];
}) {
  return (
    <div
      className={`absolute w-32 rounded-lg border p-3 shadow-[0_18px_45px_rgba(0,0,0,0.35)] backdrop-blur ${className}`}
    >
      <div className="mb-2 text-xs font-semibold text-white/82">{label}</div>
      <div className="space-y-1">
        {lines.map((line) => (
          <div key={line} className="h-2 rounded-sm bg-white/28" />
        ))}
      </div>
    </div>
  );
}

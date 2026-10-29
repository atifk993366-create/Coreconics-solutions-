"use client";
export const BRAND = "Coreconics Solutions";
export function Logo({ size = 36, text = true }: { size?: number; text?: boolean }) {
  return <span className="inline-flex items-center gap-2"><img src="/logo.png" alt="Coreconics Solutions" width={size} height={size} className="rounded-full" />{text && <span className="font-semibold tracking-tight text-slate-900">Coreconics <span className="font-normal text-slate-500">Solutions</span></span>}</span>;
}

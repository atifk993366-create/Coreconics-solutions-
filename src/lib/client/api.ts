"use client";
type TokenFn = () => Promise<string>; let tokenFn: TokenFn = async () => "";
export const setTokenProvider = (f: TokenFn) => { tokenFn = f; };
export class ApiFail extends Error { constructor(public status: number, message: string, public code?: string) { super(message); } }
export async function api<T = any>(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
  const qs = query ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
  const r = await fetch(`/api/v1${path}${qs}`, { method, headers: { Authorization: `Bearer ${await tokenFn()}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const ct = r.headers.get("content-type") ?? ""; if (!ct.includes("json")) { if (!r.ok) throw new ApiFail(r.status, "Request failed"); return (await r.blob()) as any; }
  const j = await r.json(); if (!r.ok) throw new ApiFail(r.status, j?.error?.message ?? "Request failed", j?.error?.code); return j.data as T;
}
export async function openFile(path: string, name = "file.pdf") {
  const r = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${await tokenFn()}` } }); if (!r.ok) { let m = "Download failed"; try { m = (await r.json()).error.message; } catch {} throw new ApiFail(r.status, m); }
  const url = URL.createObjectURL(await r.blob()); const a = document.createElement("a"); a.href = url; a.target = "_blank"; a.rel = "noopener"; if (!name.endsWith(".pdf")) a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export const inr = (n: number | undefined | null) => "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

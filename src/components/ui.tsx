"use client";
import { useEffect, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";
export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>{children}</div>;
export const H1 = ({ children, right }: { children: ReactNode; right?: ReactNode }) => <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h1 className="text-xl font-semibold text-slate-800">{children}</h1><div className="flex gap-2">{right}</div></div>;
export function Btn({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "soft" }) {
  const v = { primary: "bg-brand-500 text-white hover:bg-brand-600", ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50", danger: "bg-red-600 text-white hover:bg-red-700", soft: "bg-brand-50 text-brand-700 hover:bg-brand-100" }[variant];
  return <button {...p} className={cx("rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50", v, className)} />;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) { return <label className="block text-xs font-medium text-slate-600"><span className="mb-1 block">{label}</span>{children}{hint && <span className="mt-1 block font-normal text-slate-400">{hint}</span>}</label>; }
const inp = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(inp, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(inp, p.className)} />;
export const Badge = ({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "blue" }) => <span className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", { slate: "bg-slate-100 text-slate-700", green: "bg-green-100 text-green-700", red: "bg-red-100 text-red-700", amber: "bg-amber-100 text-amber-800", blue: "bg-blue-100 text-blue-700" }[tone])}>{children}</span>;
export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string }) {
  const rows = Array.isArray(children) ? children.length : children ? 1 : 0;
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{head.map(h => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table>{!rows && <div className="p-8 text-center text-sm text-slate-400">{empty ?? "Nothing to show"}</div>}</div>;
}
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx("px-3 py-2 align-top", className)}>{children}</td>;
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === "Escape" && onClose(); if (open) addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}><div onClick={e => e.stopPropagation()} className={cx("max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{title}</h2><button onClick={onClose} className="text-xl text-slate-400">×</button></div>{children}</div></div>;
}
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null); const [err, setErr] = useState(""); const [loading, setLoading] = useState(true); const [n, setN] = useState(0);
  useEffect(() => { let live = true; setLoading(true); fn().then(d => { if (live) { setData(d); setErr(""); } }).catch(e => live && setErr(e.message)).finally(() => live && setLoading(false)); return () => { live = false; }; /* eslint-disable-next-line */ }, [...deps, n]);
  return { data, err, loading, reload: () => setN(x => x + 1), setData };
}
export const ErrorBox = ({ msg }: { msg?: string }) => (msg ? <div className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</div> : null);
export const Loading = () => <div className="p-6 text-sm text-slate-400">Loading…</div>;
export function Toast({ msg }: { msg: string }) { return msg ? <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-800 px-4 py-2 text-sm text-white shadow-lg">{msg}</div> : null; }
export function useToast() { const [m, setM] = useState(""); return { msg: m, show: (t: string) => { setM(t); setTimeout(() => setM(""), 2500); } }; }

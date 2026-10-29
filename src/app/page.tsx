import Link from "next/link"; import { Logo } from "@/components/Brand";
export default function Home() {
  return (<main className="mx-auto max-w-2xl p-8"><Logo size={48} /><h1 className="mt-8 text-3xl font-bold text-slate-900">Lab billing & report API</h1><p className="mt-3 text-slate-600">Test price list, bill generation, auto-calculated lab reports (CBC indices, lipid, KFT…) and an AI calculation agent — embed in any website via API.</p>
    <div className="mt-6 flex gap-3"><Link href="/login" className="rounded-lg bg-brand-500 px-4 py-2 text-white">Login / Register</Link><Link href="/docs" className="rounded-lg border px-4 py-2">API docs</Link></div><p className="mt-10 text-xs text-slate-400">© Coreconics Solutions</p></main>);
}

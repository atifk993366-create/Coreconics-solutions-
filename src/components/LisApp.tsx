"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { setTokenProvider } from "@/lib/client/api";
import { cx, Toast } from "./ui";
import { Logo } from "./Brand";
import { Agents, Bills, NewBill, Patients, Referrers, Transactions } from "./views/Billing";
import { Business, Dashboard } from "./views/Business";
import { Categories, Packages, Panels, ReportEditor, ReportsList, TestCounts, TestDatabase, TestDetail } from "./views/Lab";
import { CalcStudio } from "./views/CalcStudio";
import { ApiKeys, Settings, Staff } from "./views/Admin";
import { IntegrationGuide } from "./views/Integration";

type Item = { id: string; label: string; admin?: boolean };
const NAV: { group: string; items: Item[] }[] = [
  { group: "Business", items: [{ id: "daily", label: "Daily business" }, { id: "expenses", label: "Expenses" }, { id: "due", label: "Due reports" }, { id: "referral", label: "Referral business" }, { id: "case-wise", label: "Case wise report" }, { id: "export", label: "Data export" }] },
  { group: "Cases", items: [{ id: "bills", label: "Bills" }, { id: "patients", label: "Patients" }, { id: "transactions", label: "Transactions" }, { id: "referrers", label: "Referral doctors" }, { id: "agents", label: "Agents" }] },
  { group: "Lab", items: [{ id: "todays-reports", label: "Today's reports" }, { id: "search-reports", label: "Search reports" }, { id: "packages", label: "Test packages" }, { id: "panels", label: "Test panels" }, { id: "categories", label: "Test categories" }, { id: "test-database", label: "Test database & prices" }, { id: "test-counts", label: "Test counts" }, { id: "calc", label: "Calculation AI agent" }] },
  { group: "Manage", items: [{ id: "settings", label: "Lab settings", admin: true }, { id: "staff", label: "Employee login", admin: true }, { id: "api-keys", label: "API keys", admin: true }, { id: "integration", label: "API integration guide", admin: true }] },
];
export function LisApp({ getToken, embedded, onSignOut, isAdmin, title = "Coreconics Solutions" }: { getToken: () => Promise<string>; embedded?: boolean; onSignOut?: () => void; isAdmin?: boolean; title?: string }) {
  const [errMsg, setErrMsg] = useState("");
  useEffect(() => { let t: any; const h = (e: any) => { setErrMsg(String(e.detail ?? "Error")); clearTimeout(t); t = setTimeout(() => setErrMsg(""), 4500); }; addEventListener("ls-error", h); return () => { removeEventListener("ls-error", h); clearTimeout(t); }; }, []);
  const [view, setView] = useState("dashboard"); const [open, setOpen] = useState(false); const [ready, setReady] = useState(false);
  useEffect(() => { setTokenProvider(getToken); setReady(true); }, [getToken]);
  useEffect(() => { const h = () => setView(decodeURIComponent(location.hash.slice(2)) || "dashboard"); h(); addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  const go = useCallback((v: string) => { location.hash = "/" + encodeURIComponent(v); setOpen(false); }, []);
  if (!ready) return null; const [name, arg] = [view.split(":")[0], view.split(":")[1]];
  let body: ReactNode;
  switch (name) {
    case "dashboard": body = <Dashboard go={go} />; break; case "new-bill": body = <NewBill go={go} />; break;
    case "daily": case "expenses": case "due": case "referral": case "case-wise": case "export": body = <Business key={name} tab={name} />; break;
    case "bills": body = <Bills />; break; case "patients": body = <Patients />; break; case "transactions": body = <Transactions />; break; case "referrers": body = <Referrers />; break; case "agents": body = <Agents />; break;
    case "todays-reports": body = <ReportsList open={id => go("report:" + id)} />; break; case "search-reports": body = <ReportsList search open={id => go("report:" + id)} />; break;
    case "report": body = <ReportEditor id={arg} back={() => history.back()} />; break;
    case "packages": body = <Packages />; break; case "panels": body = <Panels />; break; case "categories": body = <Categories />; break; case "test-counts": body = <TestCounts />; break;
    case "test-database": body = <TestDatabase openTest={id => go("test:" + id)} />; break; case "test": body = <TestDetail id={arg} back={() => history.back()} />; break;
    case "calc": body = <CalcStudio />; break; case "settings": body = <Settings />; break; case "staff": body = <Staff />; break; case "api-keys": body = <ApiKeys />; break;
    case "integration": body = <IntegrationGuide base={typeof location !== "undefined" ? location.origin : ""} />; break; default: body = <Dashboard go={go} />;
  }
  const nav = (<nav className="space-y-4 p-3 text-sm"><button onClick={() => go("new-bill")} className="w-full rounded-full bg-brand-500 py-2.5 font-medium text-white">+ New bill</button><button onClick={() => go("dashboard")} className={cx("block w-full rounded-lg px-3 py-2 text-left", name === "dashboard" && "bg-brand-50 text-brand-700")}>Dashboard</button>
    {NAV.map(g => { const items = g.items.filter(i => !(embedded && i.admin)); if (!items.length) return null; return <div key={g.group}><div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.group}</div>{items.map(i => <button key={i.id} onClick={() => go(i.id)} className={cx("block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50", name === i.id && "bg-brand-50 font-medium text-brand-700")}>{i.label}</button>)}</div>; })}{isAdmin && <a href="/admin" className="block rounded-lg px-3 py-2 font-medium text-brand-700 hover:bg-brand-50">⚙ Admin panel</a>}{onSignOut && <button onClick={onSignOut} className="block w-full px-3 py-2 text-left text-slate-500">Sign out</button>}</nav>);
  return (<div className="flex min-h-screen bg-slate-50 text-slate-800"><aside className="hidden w-60 shrink-0 overflow-y-auto border-r bg-white lg:block"><div className="px-5 py-4"><Logo /></div>{nav}</aside>
    {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-64 overflow-y-auto bg-white" onClick={e => e.stopPropagation()}><div className="px-5 py-4"><Logo /></div>{nav}</aside></div>}
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-white px-4 py-3 lg:hidden"><button onClick={() => setOpen(true)} className="text-xl">☰</button><Logo size={28} /></header><main className="p-4 lg:p-6">{body}</main></div><Toast msg={errMsg} /></div>);
}

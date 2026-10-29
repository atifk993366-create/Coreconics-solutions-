"use client";
import { useEffect, useState } from "react"; import { onAuthStateChanged, sendEmailVerification, signOut, type User } from "firebase/auth";
import { fbAuth } from "@/lib/client/firebase"; import { LisApp } from "@/components/LisApp"; import { Btn, Card, Loading } from "@/components/ui"; import { Logo } from "@/components/Brand";
type State = { kind: "loading" } | { kind: "ok" } | { kind: "pending" | "rejected" | "suspended" } | { kind: "error"; msg: string };
export default function AppPage() {
  const [user, setUser] = useState<User | null>(null); const [st, setSt] = useState<State>({ kind: "loading" });
  async function check(u: User) {
    setSt({ kind: "loading" });
    try {
      const reg = JSON.parse(sessionStorage.getItem("coreconics_reg") ?? "{}"); const r = await fetch("/api/v1/me/bootstrap", { method: "POST", headers: { Authorization: `Bearer ${await u.getIdToken(true)}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...reg, ownerName: reg.ownerName ?? u.displayName, labName: reg.labName ?? u.displayName ?? u.email }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.error?.message ?? "Failed"); sessionStorage.removeItem("coreconics_reg");
      setSt({ kind: j.data.status === "approved" ? "ok" : j.data.status });
    } catch (e: any) { setSt({ kind: "error", msg: e.message }); }
  }
  useEffect(() => onAuthStateChanged(fbAuth(), u => { if (!u) { location.href = "/login"; return; } setUser(u); check(u); }), []);
  const out = () => signOut(fbAuth()).then(() => (location.href = "/login"));
  if (st.kind === "loading" || !user) return <Loading />;
  if (st.kind === "ok") return <LisApp getToken={() => user.getIdToken()} onSignOut={out} />;
  const msg = { pending: ["Approval pending ⏳", "Aapki registration mil gayi hai. Coreconics Solutions team verify karke approve karegi — approve hone par aap yahin se use shuru kar sakenge."], rejected: ["Registration approve nahi hui", "Details sahi karke dobara sampark kijiye ya support se baat kijiye."], suspended: ["Account suspended", "Please Coreconics Solutions support se sampark kijiye."], error: ["Kuch gadbad hui", (st as any).msg] }[st.kind];
  return (<main className="mx-auto mt-16 max-w-md p-4"><div className="mb-6 flex justify-center"><Logo size={44} /></div><Card><h1 className="text-lg font-semibold">{msg[0]}</h1><p className="mt-2 text-sm text-slate-600">{msg[1]}</p>{!user.emailVerified && st.kind === "pending" && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Email verify nahi hua — approval jaldi ho, isliye inbox me aaya verification link kholiye. <button className="underline" onClick={() => sendEmailVerification(user)}>Dobara bhejiye</button></p>}<div className="mt-4 flex gap-2"><Btn onClick={() => check(user)}>Status refresh karein</Btn><Btn variant="ghost" onClick={out}>Sign out</Btn></div></Card></main>);
}

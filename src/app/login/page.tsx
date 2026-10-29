"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword, GoogleAuthProvider, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, updateProfile } from "firebase/auth";
import { fbAuth } from "@/lib/client/firebase"; import { Btn, Card, ErrorBox, Field, Input } from "@/components/ui"; import { Logo } from "@/components/Brand";
const nice = (e: any) => ({ "auth/invalid-credential": "Email ya password galat hai.", "auth/email-already-in-use": "Is email se account pehle se hai — Sign in kijiye.", "auth/weak-password": "Password kam se kam 6 character ka rakhiye.", "auth/popup-closed-by-user": "" } as Record<string, string>)[e.code] ?? e.message;
export default function Login() {
  const [mode, setMode] = useState<"in" | "up">("in"); const [f, setF] = useState({ email: "", pw: "", labName: "", ownerName: "", phone: "", city: "", licenseNo: "" }); const [err, setErr] = useState(""); const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const after = async (reg?: boolean) => { if (reg) sessionStorage.setItem("coreconics_reg", JSON.stringify({ labName: f.labName, ownerName: f.ownerName, phone: f.phone, city: f.city, licenseNo: f.licenseNo })); location.href = "/app"; };
  async function submit() {
    setBusy(true); setErr("");
    try {
      if (mode === "up") { const c = await createUserWithEmailAndPassword(fbAuth(), f.email, f.pw); await updateProfile(c.user, { displayName: f.ownerName }); await sendEmailVerification(c.user).catch(() => {}); await after(true); }
      else { await signInWithEmailAndPassword(fbAuth(), f.email, f.pw); await after(); }
    } catch (e: any) { setErr(nice(e)); } finally { setBusy(false); }
  }
  async function google() { setBusy(true); setErr(""); try { await signInWithPopup(fbAuth(), new GoogleAuthProvider()); await after(mode === "up"); } catch (e: any) { setErr(nice(e)); } finally { setBusy(false); } }
  async function reset() { if (!f.email) return setErr("Pehle email likhiye."); try { await sendPasswordResetEmail(fbAuth(), f.email); setInfo("Password reset link email par bhej diya."); } catch (e: any) { setErr(nice(e)); } }
  const up = mode === "up";
  return (<main className="mx-auto mt-10 max-w-md p-4"><div className="mb-6 flex justify-center"><Logo size={44} /></div><Card><h1 className="mb-1 text-xl font-semibold">{up ? "Register your lab" : "Welcome back"}</h1>{up && <p className="mb-3 text-xs text-slate-500">Registration ke baad Coreconics team manual verification karegi. Approve hote hi aap login karke use kar sakte hain.</p>}<ErrorBox msg={err} />{info && <div className="mb-3 rounded-lg bg-green-50 p-3 text-sm text-green-700">{info}</div>}
    <div className="space-y-3">{up && <><Field label="Lab / Company name *"><Input value={f.labName} onChange={set("labName")} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Owner name *"><Input value={f.ownerName} onChange={set("ownerName")} /></Field><Field label="Phone *"><Input inputMode="tel" value={f.phone} onChange={set("phone")} /></Field><Field label="City"><Input value={f.city} onChange={set("city")} /></Field><Field label="License / Reg. no."><Input value={f.licenseNo} onChange={set("licenseNo")} /></Field></div></>}
      <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field><Field label="Password"><Input type="password" value={f.pw} onChange={set("pw")} /></Field>
      <Btn className="w-full" disabled={busy || !f.email || f.pw.length < 6 || (up && (!f.labName || !f.ownerName || f.phone.length < 10))} onClick={submit}>{up ? "Register" : "Sign in"}</Btn>
      <div className="flex items-center gap-2 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />ya<span className="h-px flex-1 bg-slate-200" /></div>
      <Btn variant="ghost" className="w-full" disabled={busy || (up && (!f.labName || !f.ownerName || f.phone.length < 10))} onClick={google}>Continue with Google</Btn></div>
    <div className="mt-4 flex justify-between text-sm"><button className="text-brand-600" onClick={() => { setMode(up ? "in" : "up"); setErr(""); }}>{up ? "Already registered? Sign in" : "New lab? Register"}</button>{!up && <button className="text-slate-500" onClick={reset}>Forgot password?</button>}</div></Card></main>);
}

"use client";
import { Suspense, useEffect } from "react"; import { useSearchParams } from "next/navigation"; import { LisApp } from "@/components/LisApp";
function Inner() {
  const sp = useSearchParams(); const token = sp.get("token") ?? ""; const view = sp.get("view");
  useEffect(() => { if (view && !location.hash) location.hash = "/" + view; }, [view]);
  if (!token) return <p className="p-6 text-red-600">Missing token</p>;
  return <LisApp embedded title="Lab" getToken={async () => token} />;
}
export default function Embed() { return <Suspense><Inner /></Suspense>; }

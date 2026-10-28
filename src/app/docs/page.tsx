"use client";
import { useEffect, useState } from "react"; import { IntegrationGuide } from "@/components/views/Integration";
export default function Docs() { const [base, setBase] = useState(""); useEffect(() => setBase(location.origin), []); return <main className="p-4">{base ? <IntegrationGuide base={base} /> : null}</main>; }

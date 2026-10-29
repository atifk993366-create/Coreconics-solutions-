"use client";
<<<<<<< HEAD
import { IntegrationGuide } from "@/components/views/Integration";
export default function Docs() { return <main className="p-4"><IntegrationGuide base={typeof location !== "undefined" ? location.origin : ""} /></main>; }
=======
import { useEffect, useState } from "react"; import { IntegrationGuide } from "@/components/views/Integration";
export default function Docs() { const [base, setBase] = useState(""); useEffect(() => setBase(location.origin), []); return <main className="p-4">{base ? <IntegrationGuide base={base} /> : null}</main>; }
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd

"use client";
import { IntegrationGuide } from "@/components/views/Integration";
export default function Docs() { return <main className="p-4"><IntegrationGuide base={typeof location !== "undefined" ? location.origin : ""} /></main>; }

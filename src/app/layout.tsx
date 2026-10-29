import "./globals.css"; import type { Metadata, Viewport } from "next";
export const metadata: Metadata = { title: "Coreconics Solutions — Lab billing & report API", description: "Lab billing, report generation and AI calculation agent API by Coreconics Solutions", icons: { icon: "/logo.png" } };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }

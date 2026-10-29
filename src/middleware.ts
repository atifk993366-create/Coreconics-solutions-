import { NextResponse, type NextRequest } from "next/server";
// /embed may be framed ONLY by the partner origins listed in the token (claim "ao"). Signature is verified server-side by the API;
// this header only narrows where the iframe can be shown (a forged claim cannot grant any data access).
export function middleware(req: NextRequest) {
  const res = NextResponse.next(); const token = req.nextUrl.searchParams.get("token"); let origins: string[] = [];
  try { if (token) { const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); if (Array.isArray(p.ao)) origins = p.ao.filter((o: unknown) => typeof o === "string" && /^https?:\/\/[^\s;'"]+$/.test(o)); } } catch {}
  res.headers.set("Content-Security-Policy", `frame-ancestors ${origins.length ? origins.join(" ") : "'none'"}`); res.headers.set("Referrer-Policy", "no-referrer"); return res;
}
export const config = { matcher: ["/embed"] };

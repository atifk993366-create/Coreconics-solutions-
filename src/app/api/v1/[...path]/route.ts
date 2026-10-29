import { NextRequest, NextResponse } from "next/server";
import { ApiError } from "@/lib/types";
import { authenticate, rateLimit, requirePlatformAdmin, verifyFirebaseUser } from "@/lib/auth";
import { dispatch } from "@/lib/router";
import { createTenant } from "@/lib/services/tenants";
<<<<<<< HEAD
import { registerLab, listTenants, setApproval } from "@/lib/services/admin";
=======
import { registerLab, listTenants, setApproval, isPlatformAdmin, adminEmails } from "@/lib/services/admin";
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd

export const runtime = "nodejs"; export const maxDuration = 30; export const dynamic = "force-dynamic";
const CORS = (origin: string | null) => ({ "access-control-allow-origin": origin ?? "*", "access-control-allow-headers": "authorization, content-type, idempotency-key", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-max-age": "86400", vary: "origin" });
const err = (e: unknown, origin: string | null) => {
  if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status, headers: CORS(origin) });
  console.error(e); return NextResponse.json({ error: { code: "internal", message: "Internal error" } }, { status: 500, headers: CORS(origin) });
};
async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const origin = req.headers.get("origin"); const { path: segs } = await params; const path = "/" + segs.join("/");
  try {
    if (req.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: CORS(origin) });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local"; rateLimit(`ip:${ip}`, 300);
    let body: any = undefined; if (!["GET", "DELETE"].includes(req.method)) { const txt = await req.text(); if (txt.length > 1_000_000) throw new ApiError(413, "Body too large", "too_large"); try { body = txt ? JSON.parse(txt) : {}; } catch { throw new ApiError(400, "Invalid JSON body", "bad_json"); } }
    // platform-admin: create a tenant (partner onboarding) — protected by PLATFORM_ADMIN_SECRET
    if (path === "/admin/tenants" && req.method === "POST") { const s = process.env.PLATFORM_ADMIN_SECRET; if (!s || req.headers.get("x-admin-secret") !== s) throw new ApiError(401, "Bad admin secret", "unauthorized"); return NextResponse.json({ data: await createTenant(body ?? {}) }, { status: 201, headers: CORS(origin) }); }
    // Self-registration (Firebase login) → lab is created as PENDING until Coreconics admin approves
    if (path === "/me/bootstrap" && req.method === "POST") { const u = await verifyFirebaseUser(req); rateLimit(`boot:${u.uid}`, 20); return NextResponse.json({ data: await registerLab(u, body) }, { headers: CORS(origin) }); }
<<<<<<< HEAD
=======
    if (path === "/me" && req.method === "GET") { const u = await verifyFirebaseUser(req); return NextResponse.json({ data: { email: u.email, emailVerified: !!u.emailVerified, isAdmin: isPlatformAdmin(u.email, u.emailVerified), adminListConfigured: adminEmails().length > 0, emailInAdminList: !!u.email && adminEmails().includes(u.email.toLowerCase()) } }, { headers: CORS(origin) }); }
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
    // Platform admin (Coreconics Solutions) — manual approval console
    if (path.startsWith("/admin/") && path !== "/admin/tenants") {
      const admin = await requirePlatformAdmin(req); const m = path.match(/^\/admin\/labs(?:\/([^/]+)\/(approve|reject|suspend|reopen))?$/);
      if (m && !m[1] && req.method === "GET") return NextResponse.json({ data: await listTenants(req.nextUrl.searchParams.get("status") ?? undefined) }, { headers: CORS(origin) });
      if (m && m[1] && req.method === "POST") { const st = ({ approve: "approved", reject: "rejected", suspend: "suspended", reopen: "pending" } as const)[m[2] as "approve"]; return NextResponse.json({ data: await setApproval(m[1], st, admin, body?.note) }, { headers: CORS(origin) }); }
      throw new ApiError(404, "No admin route", "not_found");
    }
    const ctx = await authenticate(req); rateLimit(`t:${ctx.tenantId}`, 600);
    const out = await dispatch(req.method, path, { ctx, q: req.nextUrl.searchParams, body, req });
    if (out instanceof Response) { Object.entries(CORS(origin)).forEach(([k, v]) => (out as Response).headers.set(k, v)); return out as any; }
    return NextResponse.json({ data: out }, { status: req.method === "POST" ? 201 : 200, headers: CORS(origin) });
  } catch (e) { return err(e, origin); }
}
export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE, handle as OPTIONS };

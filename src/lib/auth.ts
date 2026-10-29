import { ApiError, type ApiCtx } from "./types";
import { resolveApiKey } from "./services/tenants";
import { verifyJwt } from "./util/crypto";
import { resolveUserCtx, isPlatformAdmin, type FbUser } from "./services/admin";

export const embedSecret = () => { const s = process.env.EMBED_JWT_SECRET; if (!s || s.length < 24) { if (process.env.NODE_ENV === "production") throw new ApiError(500, "EMBED_JWT_SECRET not configured", "config"); return "dev-only-embed-secret-change-me-123456"; } return s; };
/** Resolves the caller from the Authorization header. Three credential types:
 *  1) lsk_live_…  → partner server API key         2) JWT → short-lived embed token (iframe widget)
 *  3) Firebase ID token → lab owner/staff dashboard login */
export async function authenticate(req: Request): Promise<ApiCtx> {
  const h = req.headers.get("authorization") ?? ""; const tok = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!tok) throw new ApiError(401, "Missing Authorization: Bearer <API key>", "unauthorized");
  if (tok.startsWith("lsk_")) { const k = await resolveApiKey(tok); if (!k) throw new ApiError(401, "Invalid or revoked API key", "unauthorized"); return { tenantId: k.tenantId, actor: "api", role: "api", scopes: k.scopes }; }
  if (tok.split(".").length === 3) {
    const c = verifyJwt<{ tid?: string; sub?: string; typ?: string }>(tok, embedSecret()); if (c?.typ === "embed" && c.tid) return { tenantId: c.tid, actor: c.sub ?? "embed", role: "embed" };
    const fb = await verifyFirebase(tok); if (fb) return fb;
  }
  throw new ApiError(401, "Invalid or expired token", "unauthorized");
}
async function verifyFirebase(idToken: string): Promise<ApiCtx | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.FIREBASE_PRIVATE_KEY) return null;
  let u: FbUser; try { u = await decode(idToken); } catch { return null; }
  return resolveUserCtx(u); // throws pending_approval / account_rejected / account_suspended
}
async function decode(tok: string): Promise<FbUser> { const { adminApp } = await import("./repo/firestore"); const admin = await adminApp(); const d = await admin.auth().verifyIdToken(tok); return { uid: d.uid, email: d.email, emailVerified: d.email_verified, name: d.name }; }
/** Firebase user (lab may not exist / be approved yet) — used by /me/bootstrap and platform-admin routes. */
export async function verifyFirebaseUser(req: Request): Promise<FbUser> {
  const h = req.headers.get("authorization") ?? ""; const tok = h.startsWith("Bearer ") ? h.slice(7) : "";
  try { return await decode(tok); } catch { throw new ApiError(401, "Invalid Firebase token", "unauthorized"); }
}
export async function requirePlatformAdmin(req: Request): Promise<string> {
  const u = await verifyFirebaseUser(req); if (!isPlatformAdmin(u.email, u.emailVerified)) throw new ApiError(403, "Platform admin only", "forbidden"); return u.email!;
}
// tiny in-memory rate limiter (per instance). For multi-region use Upstash/Redis.
const hits = new Map<string, { n: number; t: number }>();
export function rateLimit(key: string, max = 120, windowMs = 60_000) { const now = Date.now(); const h = hits.get(key); if (!h || now - h.t > windowMs) { hits.set(key, { n: 1, t: now }); if (hits.size > 5000) hits.clear(); return; } if (++h.n > max) throw new ApiError(429, "Too many requests", "rate_limited"); }

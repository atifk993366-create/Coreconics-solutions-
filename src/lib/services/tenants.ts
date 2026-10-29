import { getRepo } from "../repo";
import { ApiError, type ApiCtx, type Tenant, type Branding } from "../types";
import { need, nowIso, requireRole, str } from "./util";
import { newApiKey, newId, sha256 } from "../util/crypto";
import { tenantStatus } from "./admin";

export interface ApiKeyDoc { id: string; tenantId: string; name: string; last4: string; scopes: string[]; createdAt: string; revoked: boolean; lastUsedAt?: string }
export async function getTenant(id: string): Promise<Tenant> { return need(await getRepo().get<Tenant>("tenants", id), "Tenant"); }
export async function createTenant(b: any): Promise<{ tenant: Tenant; apiKey: string }> {
  const name = str(b.name, "name"); const id = newId("t_");
  const tenant: Tenant = { id, name, branding: { labName: str(b.labName ?? name, "labName"), address: b.address, phone: b.phone }, allowedOrigins: Array.isArray(b.allowedOrigins) ? b.allowedOrigins.map(String) : [], plan: "api", active: true, approval: "approved", currency: "INR", createdAt: nowIso(), settings: {} };
  await getRepo().set("tenants", id, tenant); const key = await issueKey(id, "Default key"); return { tenant, apiKey: key.secret };
}
export async function issueKey(tid: string, name: string) {
  const k = newApiKey(); const doc: ApiKeyDoc = { id: k.hash, tenantId: tid, name, last4: k.last4, scopes: ["*"], createdAt: nowIso(), revoked: false };
  await getRepo().set("apiKeys", k.hash, doc); return { secret: k.secret, doc: { ...doc, id: undefined, ref: k.hash.slice(0, 12) } };
}
export async function listKeys(ctx: ApiCtx) { requireRole(ctx, "owner"); return (await getRepo().query<ApiKeyDoc>("apiKeys", { where: [["tenantId", "==", ctx.tenantId]] })).map(k => ({ ref: k.id.slice(0, 12), name: k.name, last4: k.last4, createdAt: k.createdAt, revoked: k.revoked, lastUsedAt: k.lastUsedAt })); }
export async function revokeKey(ctx: ApiCtx, ref: string) {
  requireRole(ctx, "owner"); const k = (await getRepo().query<ApiKeyDoc>("apiKeys", { where: [["tenantId", "==", ctx.tenantId]] })).find(x => x.id.startsWith(ref)); if (!k) throw new ApiError(404, "Key not found", "not_found");
  await getRepo().patch("apiKeys", k.id, { revoked: true }); return { ok: true };
}
export async function updateBranding(ctx: ApiCtx, b: Partial<Branding> & { allowedOrigins?: string[] }) {
  requireRole(ctx, "owner", "staff", "api"); const t = await getTenant(ctx.tenantId);
  const branding: Branding = { ...t.branding, ...Object.fromEntries(Object.entries(b).filter(([k]) => ["labName", "address", "phone", "email", "logoUrl", "tagline", "gstin", "footerNote", "signatories"].includes(k))) } as Branding;
  const allowedOrigins = (b.allowedOrigins ?? t.allowedOrigins).map(o => { try { return new URL(o).origin; } catch { throw new ApiError(400, `Invalid origin ${o}`, "validation"); } });
  await getRepo().patch("tenants", t.id, { branding, allowedOrigins }); return { ...t, branding, allowedOrigins };
}
export async function resolveApiKey(secret: string): Promise<{ tenantId: string; scopes: string[] } | null> {
  const h = sha256(secret); const k = await getRepo().get<ApiKeyDoc>("apiKeys", h); if (!k || k.revoked) return null;
  const t = await getRepo().get<Tenant>("tenants", k.tenantId); if (!t || tenantStatus(t) !== "approved") return null; return { tenantId: k.tenantId, scopes: k.scopes };
}
// ── employee logins (Manage → Employee login) ──
export async function inviteStaff(ctx: ApiCtx, email: string) {
  requireRole(ctx, "owner"); const e = str(email, "email", { max: 120 }).toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new ApiError(400, "Invalid email", "validation");
  await getRepo().set("invites", e, { email: e, tenantId: ctx.tenantId, role: "staff", createdAt: nowIso() }); return { email: e, status: "invited" };
}
export async function listStaff(ctx: ApiCtx) {
  requireRole(ctx, "owner"); const r = getRepo();
  const [users, inv] = await Promise.all([r.query<any>("users", { where: [["tenantId", "==", ctx.tenantId]] }), r.query<any>("invites", { where: [["tenantId", "==", ctx.tenantId]] })]);
  return [...users.map(u => ({ email: u.email, role: u.role, status: "active", uid: u.uid })), ...inv.filter(i => !users.some(u => u.email?.toLowerCase() === i.email)).map(i => ({ email: i.email, role: i.role, status: "invited" }))];
}
export async function removeStaff(ctx: ApiCtx, email: string) {
  requireRole(ctx, "owner"); const e = email.toLowerCase(); await getRepo().del("invites", e);
  const u = (await getRepo().query<any>("users", { where: [["tenantId", "==", ctx.tenantId]] })).find(x => x.email?.toLowerCase() === e && x.role !== "owner"); if (u) await getRepo().del("users", u.uid); return { ok: true };
}

// Platform-admin side (Coreconics Solutions): manual approval of newly registered labs / API partners.
import { getRepo } from "../repo";
import { ApiError, type Tenant } from "../types";
import { need, nowIso, str } from "./util";
import { newId } from "../util/crypto";

export type Approval = NonNullable<Tenant["approval"]>;
export const adminEmails = () => (process.env.PLATFORM_ADMIN_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
export const isPlatformAdmin = (email?: string | null, verified = true) => !!email && verified && adminEmails().includes(email.toLowerCase());

/** A lab is usable when approved. (Older docs without `approval` fall back to `active`.) `active` is NOT required for approved labs. */
export const tenantStatus = (t?: Tenant | null): Approval | "missing" => (!t ? "missing" : t.approval ?? (t.active === false ? "pending" : "approved"));
export interface FbUser { uid: string; email?: string; emailVerified?: boolean; name?: string }
/** Self-registration: creates the lab in PENDING state. Nothing works (UI or API keys) until an admin approves. */
export async function registerLab(u: FbUser, b: any): Promise<{ tenantId: string; status: Approval; role: string }> {
  const repo = getRepo(); const existing = await repo.get<{ tenantId: string; role: string }>("users", u.uid);
  if (existing) { const t = await repo.get<Tenant>("tenants", existing.tenantId); return { tenantId: existing.tenantId, status: tenantStatus(t) === "missing" ? "pending" : (tenantStatus(t) as Approval), role: existing.role }; }
  const email = u.email?.toLowerCase(); const inv = email ? await repo.get<{ tenantId: string }>("invites", email) : null;
  if (inv) { await repo.set("users", u.uid, { uid: u.uid, tenantId: inv.tenantId, role: "staff", email }); const t = await repo.get<Tenant>("tenants", inv.tenantId); return { tenantId: inv.tenantId, status: tenantStatus(t) === "missing" ? "pending" : (tenantStatus(t) as Approval), role: "staff" }; }
  const labName = str(b?.labName ?? u.name ?? email ?? "", "labName", { max: 120 }); const id = newId("t_");
  const auto = isPlatformAdmin(email, u.emailVerified); // platform owners are trusted → auto-approved
  const tenant: Tenant = { id, name: labName, branding: { labName, phone: b?.phone ? String(b.phone).slice(0, 20) : undefined }, allowedOrigins: [], plan: "api", active: auto, approval: auto ? "approved" : "pending", currency: "INR", createdAt: nowIso(), ownerEmail: email, emailVerified: !!u.emailVerified, settings: {},
    registration: { ownerName: b?.ownerName ? String(b.ownerName).slice(0, 80) : u.name, phone: b?.phone ? String(b.phone).slice(0, 20) : undefined, city: b?.city ? String(b.city).slice(0, 60) : undefined, licenseNo: b?.licenseNo ? String(b.licenseNo).slice(0, 60) : undefined, website: b?.website ? String(b.website).slice(0, 120) : undefined } };
  await repo.set("tenants", id, tenant); await repo.set("users", u.uid, { uid: u.uid, tenantId: id, role: "owner", email }); return { tenantId: id, status: auto ? "approved" : "pending", role: "owner" };
}
/** Used on every Firebase-authenticated request. Blocks everything except an approved lab. */
export async function resolveUserCtx(u: FbUser) {
  const row = await getRepo().get<{ tenantId: string; role: "owner" | "staff"; email?: string }>("users", u.uid); if (!row) throw new ApiError(403, "No lab linked to this login.", "no_tenant");
  const t = await getRepo().get<Tenant>("tenants", row.tenantId); const st = tenantStatus(t);
  if (st !== "approved") throw new ApiError(403, st === "pending" ? "Aapka account approval ke liye pending hai." : `Account ${st}.`, st === "pending" ? "pending_approval" : "account_" + st, { status: st });
  return { tenantId: row.tenantId, actor: row.email ?? u.uid, role: row.role } as const;
}
export async function listTenants(status?: string) {
  const rows = await getRepo().query<Tenant>("tenants", status ? { where: [["approval", "==", status]] } : {});
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(t => ({ id: t.id, name: t.name, ownerEmail: t.ownerEmail, emailVerified: t.emailVerified, approval: tenantStatus(t), registration: t.registration, createdAt: t.createdAt, approvedAt: t.approvedAt, note: t.approvalNote }));
}
export async function setApproval(id: string, status: Approval, adminEmail: string, note?: string) {
  const t = need(await getRepo().get<Tenant>("tenants", id), "Lab"); if (!["approved", "rejected", "suspended", "pending"].includes(status)) throw new ApiError(400, "Bad status", "validation");
  const patch = { approval: status, active: status === "approved", approvalNote: note?.slice(0, 300), approvedAt: status === "approved" ? nowIso() : t.approvedAt, approvedBy: adminEmail };
  await getRepo().patch("tenants", id, patch); await getRepo().set("audit", newId("a_"), { at: nowIso(), by: adminEmail, action: `tenant.${status}`, tenantId: id, note }); return { id, approval: status };
}

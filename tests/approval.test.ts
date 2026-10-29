import assert from "node:assert/strict";
import { setRepo } from "../src/lib/repo"; import { MemoryRepo } from "../src/lib/repo/memory";
import { registerLab, resolveUserCtx, setApproval, listTenants, isPlatformAdmin } from "../src/lib/services/admin";
import { issueKey, resolveApiKey, inviteStaff } from "../src/lib/services/tenants";
setRepo(new MemoryRepo()); let n = 0; const ok = async (name: string, f: () => Promise<void>) => { await f(); n++; console.log("✓", name); };
process.env.PLATFORM_ADMIN_EMAILS = "Admin@Coreconics.com";
(async () => {
  let tid = "";
  await ok("new registration is PENDING and blocked", async () => {
    const r = await registerLab({ uid: "u1", email: "owner@lab.com", emailVerified: true }, { labName: "City Lab", phone: "9999999999", city: "Bhubaneswar" });
    assert.equal(r.status, "pending"); tid = r.tenantId; await assert.rejects(resolveUserCtx({ uid: "u1" }), (e: any) => e.code === "pending_approval" && e.status === 403);
  });
  await ok("registration is idempotent (re-login keeps same lab)", async () => { const r = await registerLab({ uid: "u1", email: "owner@lab.com" }, {}); assert.equal(r.tenantId, tid); assert.equal(r.status, "pending"); });
  await ok("API keys of pending lab do not work", async () => { const k = await issueKey(tid, "k"); assert.equal(await resolveApiKey(k.secret), null); });
  await ok("admin lists pending", async () => { const l = await listTenants("pending"); assert.equal(l.length, 1); assert.equal(l[0].registration?.city, "Bhubaneswar"); });
  await ok("approve → login works, API key works", async () => {
    await setApproval(tid, "approved", "admin@coreconics.com"); const c = await resolveUserCtx({ uid: "u1" }); assert.equal(c.tenantId, tid); assert.equal(c.role, "owner");
    const k = await issueKey(tid, "k2"); assert.equal((await resolveApiKey(k.secret))!.tenantId, tid);
  });
  await ok("owner invites staff → staff joins approved lab directly", async () => {
    await inviteStaff({ tenantId: tid, actor: "o", role: "owner" }, "Staff@Lab.com"); const r = await registerLab({ uid: "u2", email: "staff@lab.com" }, { labName: "ignored" });
    assert.equal(r.tenantId, tid); assert.equal(r.role, "staff"); assert.equal(r.status, "approved"); assert.equal((await resolveUserCtx({ uid: "u2" })).role, "staff");
  });
  await ok("suspend → everything stops (login + API key)", async () => {
    const k = await issueKey(tid, "k3"); await setApproval(tid, "suspended", "admin@coreconics.com", "non-payment");
    await assert.rejects(resolveUserCtx({ uid: "u1" }), (e: any) => e.code === "account_suspended"); await assert.rejects(resolveUserCtx({ uid: "u2" }), /suspended/); assert.equal(await resolveApiKey(k.secret), null);
  });
  await ok("rejected stays blocked", async () => { const r = await registerLab({ uid: "u3", email: "x@y.com" }, { labName: "Bad Lab" }); await setApproval(r.tenantId, "rejected", "a@b.c"); await assert.rejects(resolveUserCtx({ uid: "u3" }), (e: any) => e.code === "account_rejected"); });
  await ok("platform admin check is case-insensitive & requires verified email", async () => { assert.equal(isPlatformAdmin("admin@coreconics.com", true), true); assert.equal(isPlatformAdmin("admin@coreconics.com", false), false); assert.equal(isPlatformAdmin("evil@x.com", true), false); });
  console.log(`\n${n} approval tests passed`);
})().catch(e => { console.error("FAIL", e); process.exit(1); });

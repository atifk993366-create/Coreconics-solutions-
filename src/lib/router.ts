import { ApiError, type ApiCtx } from "./types";
import * as cat from "./services/catalog"; import * as bill from "./services/billing"; import * as rep from "./services/reports"; import * as rules from "./services/rules"; import * as biz from "./services/business"; import * as ten from "./services/tenants";
import { proposeRules, confirmProposal } from "./ai/agent"; import { billPdf } from "./pdf/bill"; import { reportPdf } from "./pdf/report"; import { signUpload } from "./cloudinary";
import { signJwt } from "./util/crypto"; import { embedSecret } from "./auth"; import { dateInTz, requireRole } from "./services/util"; import { effectiveFormulas } from "./services/rules";

export interface Call { ctx: ApiCtx; params: Record<string, string>; q: URLSearchParams; body: any; req: Request }
type H = (c: Call) => Promise<unknown>; interface R { m: string; re: RegExp; keys: string[]; h: H }
const table: R[] = [];
const on = (m: string, path: string, h: H) => { const keys: string[] = []; const re = new RegExp("^" + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), "([^/]+)")) + "/?$"); table.push({ m, re, keys, h }); };
export const file = (data: Uint8Array | string, type: string, name: string) => new Response(data as any, { headers: { "content-type": type, "content-disposition": `inline; filename="${name}"`, "cache-control": "private, no-store" } });
const n = (v: string | null) => (v ? Number(v) : undefined);

// ── catalogue & prices ──
on("GET", "/catalog/departments", async c => cat.testCategories(c.ctx.tenantId));
on("GET", "/catalog/tests", async c => cat.listCatalog(c.ctx.tenantId, { department: c.q.get("department") ?? undefined, q: c.q.get("q") ?? undefined, kind: c.q.get("kind") ?? undefined, priced: c.q.get("priced") === "true" }));
on("GET", "/catalog/tests/:id", async c => { const t = await cat.getTest(c.ctx.tenantId, c.params.id); const p = (await cat.priceMap(c.ctx.tenantId)).get(t.id); return { ...t, price: p?.active === false ? null : p?.price ?? null }; });
on("POST", "/catalog/tests", async c => cat.createCustomTest(c.ctx, c.body));
on("PATCH", "/catalog/tests/:id", async c => cat.saveOverride(c.ctx, c.params.id, c.body));
on("PUT", "/prices/:testId", async c => cat.setPrice(c.ctx, c.params.testId, c.body?.price, c.body?.active !== false));
on("PUT", "/prices", async c => { if (!Array.isArray(c.body?.prices)) throw new ApiError(400, "prices[] required", "validation"); return cat.setPrices(c.ctx, c.body.prices); });
on("GET", "/packages", async c => cat.listPackages(c.ctx.tenantId)); on("POST", "/packages", async c => cat.savePackage(c.ctx, c.body)); on("DELETE", "/packages/:id", async c => { await cat.deletePackage(c.ctx, c.params.id); return { ok: true }; });
on("GET", "/catalog/antibiotics", async () => (await import("../data/antibiotics.json")).default);
on("GET", "/panels", async c => (await cat.listPanels(c.ctx.tenantId)).map(t => ({ id: t.id, name: t.name, department: t.department, tests: t.parameters.map(p => p.name) })));
// ── bills ──
on("POST", "/bills", async c => bill.createBill(c.ctx, c.body));
on("GET", "/bills", async c => bill.searchBills(c.ctx.tenantId, { from: c.q.get("from") ?? undefined, to: c.q.get("to") ?? undefined, regNo: n(c.q.get("regNo")), name: c.q.get("name") ?? undefined, referrerId: c.q.get("referrerId") ?? undefined, hasDue: c.q.get("hasDue") === "true" || undefined, cancelled: c.q.get("cancelled") === null ? undefined : c.q.get("cancelled") === "true", centre: c.q.get("centre") ?? undefined }));
on("GET", "/bills/:id", async c => ({ bill: await bill.getBill(c.ctx, c.params.id), reports: await rep.listReports(c.ctx.tenantId, { billId: c.params.id }) }));
on("POST", "/bills/:id/payments", async c => bill.addPayment(c.ctx, c.params.id, c.body));
on("POST", "/bills/:id/cancel", async c => bill.cancelBill(c.ctx, c.params.id));
on("GET", "/bills/:id/pdf", async c => { const b = await bill.getBill(c.ctx, c.params.id); return file(await billPdf(b, await ten.getTenant(c.ctx.tenantId)), "application/pdf", `bill-${b.regNo}.pdf`); });
on("GET", "/bills/:id/reports.pdf", async c => { const b = await bill.getBill(c.ctx, c.params.id); const rs = await rep.listReports(c.ctx.tenantId, { billId: b.id }); const done = rs.filter(r => r.status === "final" || r.status === "signed"); if (!done.length) throw new ApiError(409, "No finalised report yet", "not_ready"); const tests = new Map((await cat.allTests(c.ctx.tenantId)).map(t => [t.id, t])); return file(await reportPdf(done, tests, await ten.getTenant(c.ctx.tenantId)), "application/pdf", `reports-${b.regNo}.pdf`); });
// ── reports ──
on("GET", "/reports", async c => rep.listReports(c.ctx.tenantId, { date: c.q.get("date") ?? undefined, from: c.q.get("from") ?? undefined, to: c.q.get("to") ?? undefined, status: (c.q.get("status") as any) ?? undefined, regNo: n(c.q.get("regNo")), name: c.q.get("name") ?? undefined, testId: c.q.get("testId") ?? undefined }));
on("POST", "/reports/preview", async c => rep.previewResults(c.ctx, String(c.body?.testId), c.body ?? {}));
on("GET", "/reports/:id", async c => { const r = await rep.getReport(c.ctx, c.params.id); return { report: r, test: await cat.getTest(c.ctx.tenantId, r.testId) }; });
on("PUT", "/reports/:id/results", async c => rep.saveResults(c.ctx, c.params.id, c.body ?? {}));
on("POST", "/reports/:id/recalculate", async c => rep.recalcReport(c.ctx, c.params.id));
on("GET", "/reports/:id/pdf", async c => { const r = await rep.getReport(c.ctx, c.params.id); const tests = new Map((await cat.allTests(c.ctx.tenantId)).map(t => [t.id, t])); return file(await reportPdf([r], tests, await ten.getTenant(c.ctx.tenantId), { draft: r.status === "new" || r.status === "in_progress" }), "application/pdf", `report-${r.regNo}-${r.testId}.pdf`); });
// ── calculation rules + AI agent ──
on("GET", "/calc/formulas", async c => effectiveFormulas(c.ctx.tenantId));
on("GET", "/calc/rules", async c => rules.listRules(c.ctx.tenantId, c.q.get("target") ?? undefined));
on("POST", "/calc/rules", async c => rules.saveRule(c.ctx, { ...c.body, source: "manual" }));
on("POST", "/calc/rules/:id/activate", async c => rules.setRuleActive(c.ctx, c.params.id, true));
on("POST", "/calc/rules/:id/deactivate", async c => rules.setRuleActive(c.ctx, c.params.id, false));
on("POST", "/calc/agent", async c => { const p = await proposeRules(c.ctx, c.body ?? {}); if (c.body?.autoSave && p.rules.length && p.rules.every(r => r.valid)) return { proposal: p, saved: await confirmProposal(c.ctx, p.id) }; return { proposal: p }; });
on("POST", "/calc/agent/:id/confirm", async c => ({ saved: await confirmProposal(c.ctx, c.params.id, c.body?.only) }));
// ── business ──
on("GET", "/dashboard", async c => biz.dashboard(c.ctx.tenantId));
on("GET", "/business/daily", async c => biz.dailyBusiness(c.ctx.tenantId, c.q.get("date") ?? dateInTz()));
on("GET", "/business/due", async c => biz.dueReport(c.ctx.tenantId, c.q.get("from") ?? undefined, c.q.get("to") ?? undefined));
on("GET", "/business/referral", async c => biz.referralBusiness(c.ctx.tenantId, c.q.get("from") ?? undefined, c.q.get("to") ?? undefined));
on("GET", "/business/case-wise", async c => biz.caseWise(c.ctx.tenantId, { date: c.q.get("date") ?? dateInTz(), centre: c.q.get("centre") ?? undefined, caseTypes: c.q.getAll("caseType"), excludeCancelled: c.q.get("excludeCancelled") === "true" }));
on("GET", "/business/test-counts", async c => biz.testCounts(c.ctx.tenantId, c.q.get("from") ?? dateInTz(), c.q.get("to") ?? dateInTz()));
on("GET", "/business/export.csv", async c => { requireRole(c.ctx, "owner", "staff", "api"); return file(await biz.exportBillsCsv(c.ctx.tenantId, c.q.get("from") ?? undefined, c.q.get("to") ?? undefined), "text/csv", "bills.csv"); });
on("GET", "/transactions", async c => biz.transactions(c.ctx.tenantId, { from: c.q.get("from") ?? undefined, to: c.q.get("to") ?? undefined, mode: c.q.get("mode") ?? undefined }));
on("GET", "/patients", async c => biz.listPatients(c.ctx.tenantId, { name: c.q.get("name") ?? undefined, mobile: c.q.get("mobile") ?? undefined, uhid: n(c.q.get("uhid")) }));
on("GET", "/referrers", async c => biz.listReferrers(c.ctx.tenantId, { name: c.q.get("name") ?? undefined })); on("POST", "/referrers", async c => biz.saveReferrer(c.ctx, c.body));
on("GET", "/agents", async c => biz.listAgents(c.ctx.tenantId)); on("POST", "/agents", async c => biz.saveAgent(c.ctx, c.body));
on("GET", "/expenses", async c => biz.listExpenses(c.ctx.tenantId, c.q.get("from") ?? undefined, c.q.get("to") ?? undefined)); on("POST", "/expenses", async c => biz.addExpense(c.ctx, c.body));
// ── settings / keys / uploads / embed ──
on("GET", "/settings", async c => { const t = await ten.getTenant(c.ctx.tenantId); return { id: t.id, name: t.name, branding: t.branding, allowedOrigins: t.allowedOrigins, currency: t.currency }; });
on("PATCH", "/settings", async c => ten.updateBranding(c.ctx, c.body ?? {}));
on("GET", "/settings/api-keys", async c => ten.listKeys(c.ctx));
on("POST", "/settings/api-keys", async c => { requireRole(c.ctx, "owner"); const k = await ten.issueKey(c.ctx.tenantId, String(c.body?.name ?? "API key").slice(0, 60)); return { apiKey: k.secret, note: "Ye key dobara nahi dikhegi — abhi copy kar lijiye." }; });
on("DELETE", "/settings/api-keys/:ref", async c => ten.revokeKey(c.ctx, c.params.ref));
on("GET", "/settings/staff", async c => ten.listStaff(c.ctx)); on("POST", "/settings/staff", async c => ten.inviteStaff(c.ctx, c.body?.email)); on("DELETE", "/settings/staff/:email", async c => ten.removeStaff(c.ctx, c.params.email));
on("POST", "/uploads/sign", async c => signUpload(c.ctx, String(c.body?.kind ?? "logo")));
on("POST", "/embed/session", async c => {
  requireRole(c.ctx, "api"); const t = await ten.getTenant(c.ctx.tenantId); const ttl = 3600;
  const token = signJwt({ typ: "embed", tid: c.ctx.tenantId, sub: String(c.body?.user ?? "embed-user").slice(0, 80), ao: t.allowedOrigins }, embedSecret(), ttl);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(c.req.url).origin; return { token, expiresIn: ttl, url: `${base}/embed?token=${encodeURIComponent(token)}${c.body?.view ? `&view=${encodeURIComponent(String(c.body.view))}` : ""}` };
});
on("GET", "/health", async () => ({ ok: true, time: new Date().toISOString() }));

export async function dispatch(method: string, path: string, c: Omit<Call, "params">) {
  for (const r of table) { if (r.m !== method) continue; const m = path.match(r.re); if (!m) continue; const params: Record<string, string> = {}; r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1]))); return r.h({ ...c, params }); }
  throw new ApiError(404, `No route ${method} ${path}`, "not_found");
}

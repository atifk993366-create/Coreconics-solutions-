import seed from "../../data/seed-tests.json";
import { getRepo } from "../repo";
import type { TestDef, TestOverride, PriceDoc, Package, ParamDef, ApiCtx } from "../types";
import { ApiError } from "../types";
import { need, str, numv, nowIso, requireRole } from "./util";
import { newId } from "../util/crypto";

const GLOBAL = (seed as unknown as TestDef[]).map((t, i) => ({ ...t, order: i + 1, active: true, tenantId: null }));
export const DEPARTMENTS = ["Haematology", "Biochemistry", "Serology & Immunology", "Clinical Pathology", "Cytology", "Microbiology", "Endocrinology", "Histopathology", "Others", "Miscellaneous"];

function applyOverride(t: TestDef, o?: TestOverride | null): TestDef {
  if (!o) return t;
  const params = t.parameters.map(p => (o.parameters?.[p.code] ? ({ ...p, ...o.parameters[p.code] } as ParamDef) : p));
  return { ...t, name: o.name ?? t.name, interpretation: o.interpretation ?? t.interpretation, active: o.active ?? t.active, parameters: params };
}
export async function allTests(tid: string): Promise<TestDef[]> {
  const repo = getRepo();
  const [custom, ovs] = await Promise.all([repo.query<TestDef>("tests", { where: [["tenantId", "==", tid]] }), repo.query<TestOverride>("testOverrides", { where: [["tenantId", "==", tid]] })]);
  const om = new Map(ovs.map(o => [o.testId, o]));
  return [...GLOBAL.map(t => applyOverride(t, om.get(t.id))), ...custom.map(t => applyOverride(t, om.get(t.id)))];
}
export async function getTest(tid: string, id: string): Promise<TestDef> { return need((await allTests(tid)).find(t => t.id === id), "Test"); }
export async function priceMap(tid: string): Promise<Map<string, PriceDoc>> {
  const rows = await getRepo().query<PriceDoc>("prices", { where: [["tenantId", "==", tid]] }); return new Map(rows.map(r => [r.testId, r]));
}
/** Catalogue as the API consumer sees it — price is THEIR price (null = not priced yet, cannot be billed). */
export async function listCatalog(tid: string, f: { department?: string; q?: string; kind?: string; priced?: boolean } = {}) {
  const [tests, prices] = await Promise.all([allTests(tid), priceMap(tid)]);
  const q = f.q?.toLowerCase();
  return tests.filter(t => t.active !== false && (!f.department || t.department === f.department) && (!f.kind || t.kind === f.kind) && (!q || t.name.toLowerCase().includes(q) || t.id.includes(q)))
    .map(t => ({ id: t.id, name: t.name, department: t.department, kind: t.kind, parameterCount: t.parameters.length, price: prices.get(t.id)?.active === false ? null : prices.get(t.id)?.price ?? null }))
    .filter(t => !f.priced || t.price !== null);
}
export async function setPrice(ctx: ApiCtx, testId: string, price: number, active = true) {
  requireRole(ctx, "owner", "staff", "api"); await getTest(ctx.tenantId, testId);
  const doc: PriceDoc = { id: `${ctx.tenantId}_${testId}`, tenantId: ctx.tenantId, testId, price: numv(price, "price"), active }; await getRepo().set("prices", doc.id, doc); return doc;
}
export async function setPrices(ctx: ApiCtx, rows: { testId: string; price: number }[]) { const out = []; for (const r of rows.slice(0, 500)) out.push(await setPrice(ctx, r.testId, r.price)); return out; }
export async function saveOverride(ctx: ApiCtx, testId: string, patch: Partial<TestOverride>) {
  requireRole(ctx, "owner", "staff", "api"); const t = await getTest(ctx.tenantId, testId); const id = `${ctx.tenantId}_${testId}`;
  const cur = (await getRepo().get<TestOverride>("testOverrides", id)) ?? { id, tenantId: ctx.tenantId, testId };
  if (patch.parameters) for (const code of Object.keys(patch.parameters)) if (!t.parameters.some(p => p.code === code)) throw new ApiError(400, `Unknown parameter ${code}`, "validation");
  const next: TestOverride = { ...cur, ...patch, id, tenantId: ctx.tenantId, testId, parameters: { ...(cur.parameters ?? {}), ...(patch.parameters ?? {}) } };
  await getRepo().set("testOverrides", id, next); return applyOverride(t, next);
}
export async function createCustomTest(ctx: ApiCtx, b: any): Promise<TestDef> {
  requireRole(ctx, "owner", "staff", "api");
  const params: ParamDef[] = (Array.isArray(b.parameters) ? b.parameters : []).slice(0, 80).map((p: any, i: number) => ({ code: str(p.code ?? `P${i + 1}`, "code", { max: 30 }).toUpperCase().replace(/[^A-Z0-9_]/g, "_"), name: str(p.name, "parameter name"), unit: p.unit ?? "", ref: p.ref ?? "", type: ["number", "text", "option"].includes(p.type) ? p.type : "number", options: p.options ?? null, group: p.group ?? null, decimals: p.decimals, derived: false }));
  if (!params.length) throw new ApiError(400, "At least one parameter is required", "validation");
  const t: TestDef = { id: newId("c_"), name: str(b.name, "name"), shortName: b.shortName, department: str(b.department ?? "Others", "department"), kind: params.length > 1 ? "panel" : "test", parameters: params, interpretation: b.interpretation ?? "", active: true, tenantId: ctx.tenantId };
  await getRepo().set("tests", t.id, t); if (b.price !== undefined) await setPrice(ctx, t.id, Number(b.price)); return t;
}
// ── packages ──
export async function listPackages(tid: string) { return getRepo().query<Package>("packages", { where: [["tenantId", "==", tid]] }); }
export async function savePackage(ctx: ApiCtx, b: any): Promise<Package> {
  requireRole(ctx, "owner", "staff", "api"); const tests = await allTests(ctx.tenantId);
  const ids: string[] = (Array.isArray(b.testIds) ? b.testIds : []).map(String); for (const id of ids) if (!tests.some(t => t.id === id)) throw new ApiError(400, `Unknown test ${id}`, "validation");
  if (!ids.length) throw new ApiError(400, "testIds required", "validation");
  const p: Package = { id: b.id ?? newId("pkg_"), tenantId: ctx.tenantId, name: str(b.name, "name"), testIds: ids, price: numv(b.price, "price"), forSex: ["M", "F"].includes(b.forSex) ? b.forSex : "both", active: b.active !== false };
  await getRepo().set("packages", p.id, p); return p;
}
export async function deletePackage(ctx: ApiCtx, id: string) { requireRole(ctx, "owner", "staff", "api"); const p = need(await getRepo().get<Package>("packages", id), "Package"); if (p.tenantId !== ctx.tenantId) throw new ApiError(404, "Package not found", "not_found"); await getRepo().del("packages", id); }
export async function listPanels(tid: string) { return (await allTests(tid)).filter(t => t.kind === "panel"); }
export async function testCategories(tid: string) { const t = await allTests(tid); return DEPARTMENTS.map((d, i) => ({ order: i + 1, name: d, testCount: t.filter(x => x.department === d).length })); }
export { nowIso };

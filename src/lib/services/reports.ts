import { getRepo } from "../repo";
import { ApiError, type ApiCtx, type Report, type ReportStatus, type CultureData, type CalcRule } from "../types";
import { compute } from "../calc/engine";
import { getTest } from "./catalog";
import { listActiveRules } from "./rules";
<<<<<<< HEAD
import { need, nowIso, requireRole } from "./util";

export async function getReport(ctx: ApiCtx, id: string): Promise<Report> { const r = need(await getRepo().get<Report>("reports", id), "Report"); if (r.tenantId !== ctx.tenantId) throw new ApiError(404, "Report not found", "not_found"); return r; }
export async function listReports(tid: string, f: { date?: string; from?: string; to?: string; status?: ReportStatus; regNo?: number; name?: string; testId?: string; billId?: string; limit?: number }) {
  let rows = await getRepo().query<Report>("reports", { where: [["tenantId", "==", tid]], limit: 3000 });
  rows = rows.filter(r => { const d = r.createdAt.slice(0, 10); return (!f.date || d === f.date) && (!f.from || d >= f.from) && (!f.to || d <= f.to) && (!f.status || r.status === f.status) && (!f.regNo || r.regNo === f.regNo) && (!f.testId || r.testId === f.testId) && (!f.billId || r.billId === f.billId) && (!f.name || `${r.patient.firstName} ${r.patient.lastName ?? ""}`.toLowerCase().includes(f.name.toLowerCase())); });
=======
import { byDateRange, need, nowIso, requireRole } from "./util";

export async function getReport(ctx: ApiCtx, id: string): Promise<Report> { const r = need(await getRepo().get<Report>("reports", id), "Report"); if (r.tenantId !== ctx.tenantId) throw new ApiError(404, "Report not found", "not_found"); return r; }
export async function listReports(tid: string, f: { date?: string; from?: string; to?: string; status?: ReportStatus; regNo?: number; name?: string; testId?: string; billId?: string; limit?: number }) {
  const repo = getRepo(); let rows: Report[];
  if (f.billId) rows = await repo.query<Report>("reports", { where: [["tenantId", "==", tid], ["billId", "==", f.billId]] });
  else if (f.regNo) rows = await repo.query<Report>("reports", { where: [["tenantId", "==", tid], ["regNo", "==", f.regNo]] });
  else rows = await byDateRange<Report>("reports", tid, f.date ?? f.from, f.date ?? f.to);
  rows = rows.filter(r => (!f.status || r.status === f.status) && (!f.testId || r.testId === f.testId) && (!f.name || `${r.patient.firstName} ${r.patient.lastName ?? ""}`.toLowerCase().includes(f.name.toLowerCase())));
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, f.limit ?? 300);
}
/** Enter/modify results. Derived values are recalculated with the tenant's saved rules (AI agent) or builtin formulas. */
export async function saveResults(ctx: ApiCtx, id: string, b: { values?: Record<string, string | number | null>; manual?: string[]; status?: ReportStatus; notes?: string; culture?: CultureData }): Promise<Report> {
  requireRole(ctx, "owner", "staff", "api", "embed");
  const rep = await getReport(ctx, id); if (rep.status === "signed" && b.status !== "in_progress") throw new ApiError(409, "Report is signed. Re-open it (status=in_progress) before editing.", "locked");
  const test = await getTest(ctx.tenantId, rep.testId); const rules = await listActiveRules(ctx.tenantId);
  const prev: Record<string, string | number | null> = {}; for (const [k, c] of Object.entries(rep.results)) if (c.source !== "calculated") prev[k] = c.raw ?? null;
  const values = { ...prev, ...(b.values ?? {}) }; for (const k of Object.keys(values)) if (values[k] === "" ) delete values[k];
  const known = new Set(test.parameters.map(p => p.code)); for (const k of Object.keys(b.values ?? {})) if (!known.has(k.toUpperCase()) && !known.has(k)) throw new ApiError(400, `Unknown parameter ${k} for ${test.name}`, "validation");
  const manual = b.manual ?? rep.manual ?? [];
  const results = compute({ params: test.parameters, values, sex: rep.patient.sex, ageYears: rep.patient.ageYears, ageMonths: rep.patient.ageMonths, rules, testId: rep.testId, manual });
  const status: ReportStatus = b.status ?? (Object.keys(results).length ? (rep.status === "new" ? "in_progress" : rep.status) : rep.status);
  if ((status === "final" || status === "signed") && !Object.keys(results).length && !b.culture && !rep.cultureData) throw new ApiError(400, "Cannot finalise an empty report", "validation");
  const up: Partial<Report> = { results, status, manual, notes: b.notes ?? rep.notes, cultureData: b.culture ?? rep.cultureData, updatedAt: nowIso(), interpretation: test.interpretation };
<<<<<<< HEAD
  if (status === "final" || status === "signed") up.reportedAt = rep.reportedAt ?? nowIso(); if (status === "signed") up.signedBy = ctx.actor; if (status === "in_progress") { up.signedBy = undefined as any; }
=======
  if (status === "final" || status === "signed") up.reportedAt = rep.reportedAt ?? nowIso(); if (status === "signed") up.signedBy = ctx.actor; if (status === "in_progress") { up.signedBy = null as any; }
>>>>>>> ea8dfb41dbaa7fd42ed7adf7a501661796fa8fdd
  await getRepo().patch("reports", id, up); return { ...rep, ...up } as Report;
}
/** Preview calculation without saving (live UI as technician types). */
export async function previewResults(ctx: ApiCtx, testId: string, b: { values: Record<string, string | number>; sex?: "M" | "F" | "O"; ageYears?: number; manual?: string[] }) {
  const test = await getTest(ctx.tenantId, testId); const rules = await listActiveRules(ctx.tenantId);
  return compute({ params: test.parameters, values: b.values ?? {}, sex: b.sex, ageYears: b.ageYears, rules, testId, manual: b.manual });
}
export async function recalcReport(ctx: ApiCtx, id: string) { const r = await getReport(ctx, id); return saveResults(ctx, id, { values: {}, manual: r.manual, status: r.status === "signed" ? "in_progress" : r.status }); }
export type { CalcRule };

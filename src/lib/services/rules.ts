import { getRepo } from "../repo";
import { ApiError, type ApiCtx, type CalcRule, type RuleScope } from "../types";
import { validateExpression } from "../calc/expr";
import { BUILTIN } from "../calc/builtin";
import { allTests } from "./catalog";
import { nowIso, requireRole, str } from "./util";
import { newId } from "../util/crypto";

export async function listActiveRules(tid: string): Promise<CalcRule[]> { return (await getRepo().query<CalcRule>("calcRules", { where: [["tenantId", "==", tid], ["active", "==", true]] })); }
export async function listRules(tid: string, target?: string): Promise<CalcRule[]> {
  const rows = await getRepo().query<CalcRule>("calcRules", { where: [["tenantId", "==", tid]] });
  return rows.filter(r => !target || r.target === target.toUpperCase()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function knownCodes(tid: string): Promise<Map<string, { name: string; unit?: string; tests: string[] }>> {
  const m = new Map<string, { name: string; unit?: string; tests: string[] }>();
  for (const t of await allTests(tid)) for (const p of t.parameters) { const e = m.get(p.code); if (e) { if (!e.tests.includes(t.id)) e.tests.push(t.id); } else m.set(p.code, { name: p.name, unit: p.unit, tests: [t.id] }); }
  return m;
}
const scopeKey = (s?: RuleScope) => JSON.stringify([s?.sex ?? "", s?.ageMin ?? "", s?.ageMax ?? "", [...(s?.testIds ?? [])].sort()]);
export function cleanScope(s: any): RuleScope | undefined {
  if (!s || typeof s !== "object") return undefined; const o: RuleScope = {};
  if (s.sex === "M" || s.sex === "F") o.sex = s.sex; if (Number.isFinite(Number(s.ageMin)) && s.ageMin !== null && s.ageMin !== "") o.ageMin = Number(s.ageMin); if (Number.isFinite(Number(s.ageMax)) && s.ageMax !== null && s.ageMax !== "") o.ageMax = Number(s.ageMax);
  if (Array.isArray(s.testIds) && s.testIds.length) o.testIds = s.testIds.map(String); return Object.keys(o).length ? o : undefined;
}
/** Validate + persist a rule as a NEW VERSION; the previous rule with same target+scope is deactivated (kept for history/rollback). */
export async function saveRule(ctx: ApiCtx, b: { target: string; expression: string; decimals?: number; appliesTo?: RuleScope; instruction?: string; explanation?: string; source?: "ai" | "manual" }): Promise<CalcRule> {
  requireRole(ctx, "owner", "staff", "api", "embed");
  const target = str(b.target, "target", { max: 40 }).toUpperCase(); const codes = await knownCodes(ctx.tenantId);
  if (!codes.has(target)) throw new ApiError(400, `Unknown target parameter ${target}`, "validation");
  const v = validateExpression(b.expression, codes.keys()); if (!v.ok) throw new ApiError(400, `Invalid formula: ${v.error}`, "invalid_formula");
  if (v.vars.includes(target)) throw new ApiError(400, "A formula cannot use its own result", "invalid_formula");
  const scope = cleanScope(b.appliesTo); const all = await listRules(ctx.tenantId, target); const same = all.filter(r => scopeKey(r.appliesTo) === scopeKey(scope));
  const cur = same.find(r => r.active); const version = (same.reduce((m, r) => Math.max(m, r.version), 0)) + 1;
  const decimals = b.decimals !== undefined && b.decimals !== null ? Math.max(0, Math.min(6, Math.round(Number(b.decimals)))) : undefined;
  const rule: CalcRule = { id: newId("rule_"), tenantId: ctx.tenantId, target, expression: b.expression.trim(), decimals, appliesTo: scope, priority: 10 + (scope ? 5 : 0), version, active: true, source: b.source ?? "manual", instruction: b.instruction?.slice(0, 1000), explanation: b.explanation?.slice(0, 500), createdBy: ctx.actor, createdAt: nowIso(), supersedes: cur?.id };
  if (cur) await getRepo().patch("calcRules", cur.id, { active: false }); await getRepo().set("calcRules", rule.id, rule); return rule;
}
export async function setRuleActive(ctx: ApiCtx, id: string, active: boolean) {
  requireRole(ctx, "owner", "staff", "api"); const r = await getRepo().get<CalcRule>("calcRules", id); if (!r || r.tenantId !== ctx.tenantId) throw new ApiError(404, "Rule not found", "not_found");
  if (active) { const sib = (await listRules(ctx.tenantId, r.target)).filter(x => x.active && scopeKey(x.appliesTo) === scopeKey(r.appliesTo) && x.id !== id); for (const s of sib) await getRepo().patch("calcRules", s.id, { active: false }); }
  await getRepo().patch("calcRules", id, { active }); return { ...r, active };
}
/** What formula is effective right now for each calculated parameter (builtin vs tenant-custom). */
export async function effectiveFormulas(tid: string) {
  const active = await listActiveRules(tid); const out = BUILTIN.map(b => ({ target: b.target, expression: b.expression, source: "builtin", explanation: b.explanation, version: 1, ruleId: `builtin:${b.target}`, appliesTo: undefined as RuleScope | undefined }));
  for (const r of active) { const i = out.findIndex(o => o.target === r.target && !o.appliesTo && !r.appliesTo); const e = { target: r.target, expression: r.expression, source: r.source, explanation: r.explanation ?? "", version: r.version, ruleId: r.id, appliesTo: r.appliesTo }; if (i >= 0) out[i] = e; else out.push(e); }
  return out;
}

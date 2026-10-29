import type { CalcRule, ParamDef, ResultCell, Sex } from "../types";
import { evaluate, MissingVar, parse, ExprError, type Val, type Node } from "./expr";
import { builtinRules } from "./builtin";
import { flagFor, pickRefText } from "./ranges";

export interface ComputeInput {
  params: ParamDef[]; values: Record<string, string | number | null | undefined>;
  sex?: Sex; ageYears?: number; ageMonths?: number;
  rules?: CalcRule[];          // tenant rules (AI / manual) — win over builtin
  testId?: string; manual?: string[]; // codes the technician typed over on purpose
}
const cache = new Map<string, Node>();
const ast = (s: string) => { let a = cache.get(s); if (!a) { a = parse(s); if (cache.size > 500) cache.clear(); cache.set(s, a); } return a; };
const toNum = (v: unknown): number | null => { if (typeof v === "number") return isFinite(v) ? v : null; if (typeof v === "string") { const t = v.replace(/,/g, "").trim(); if (t !== "" && isFinite(Number(t))) return Number(t); } return null; };
const matches = (r: CalcRule, i: ComputeInput) => {
  const s = r.appliesTo; if (!s) return true;
  if (s.sex && i.sex && s.sex !== i.sex) return false; if (s.sex && !i.sex) return false;
  const a = i.ageYears ?? 0;
  if (s.ageMin !== undefined && a < s.ageMin) return false; if (s.ageMax !== undefined && a >= s.ageMax) return false;
  if (s.testIds?.length && i.testId && !s.testIds.includes(i.testId)) return false;
  return true;
};
/** Highest-priority active tenant rule for target, else builtin. */
export function pickRule(target: string, i: ComputeInput): CalcRule | undefined {
  const custom = (i.rules ?? []).filter(r => r.active && r.target === target && matches(r, i)).sort((a, b) => b.priority - a.priority || b.version - a.version);
  return custom[0] ?? builtinRules().find(r => r.target === target && matches(r, i));
}
const fmt = (v: number, d: number) => d <= 0 ? String(Math.round(v)) : v.toFixed(d);

export function compute(i: ComputeInput): Record<string, ResultCell> {
  const out: Record<string, ResultCell> = {};
  const vars: Record<string, Val> = { AGE: i.ageYears ?? 0, AGE_MONTHS: (i.ageYears ?? 0) * 12 + (i.ageMonths ?? 0), SEX_M: i.sex === "M" ? 1 : 0, SEX_F: i.sex === "F" ? 1 : 0 };
  const manual = new Set(i.manual ?? []);
  const cell = (p: ParamDef, value: number | string | null, source: ResultCell["source"], extra: Partial<ResultCell> = {}): ResultCell => {
    const refText = pickRefText(p, i.sex, i.ageYears);
    const d = extra.formula !== undefined || p.derived ? (p.decimals ?? 2) : undefined;
    const display = value === null ? "" : typeof value === "number" ? fmtAuto(value, d) : String(value);
    return { raw: value, value, display, flag: flagFor(value, refText), source, refText, unit: p.unit, ...extra };
  };
  const fmtAuto = (v: number, d?: number) => d === undefined ? String(v) : fmt(v, d);
  // context inputs not part of this test's parameter list (e.g. TLC for absolute counts)
  for (const [k, v] of Object.entries(i.values)) { const nv = toNum(v); if (nv !== null && !i.params.some(p => p.code === k)) vars[k.toUpperCase()] = nv; }
  // 1) entered values
  for (const p of i.params) {
    const raw = i.values[p.code];
    if (raw === undefined || raw === null || raw === "") continue;
    const nv = p.type === "number" ? toNum(raw) : null;
    const v = p.type === "number" ? (nv ?? String(raw)) : String(raw);
    out[p.code] = cell(p, v, manual.has(p.code) ? "manual" : "entered");
    out[p.code].display = typeof raw === "number" ? String(raw) : String(raw);
    vars[p.code] = v;
  }
  // 2) calculated values — iterate to resolve dependency chains (LDL -> LDL_HDL, EGFR -> EGFR_CAT, ...)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (const p of i.params) {
      if (manual.has(p.code) && out[p.code]) continue;
      const rule = pickRule(p.code, i);
      if (!rule || (!p.derived && !(i.rules ?? []).some(r => r.target === p.code && r.active))) continue;
      if (out[p.code]?.source === "entered" && !p.derived) continue;
      try {
        const r = evaluate(ast(rule.expression), vars);
        if (r === null || r === undefined) continue;
        const dec = rule.decimals ?? p.decimals ?? 2;
        let value: number | string = typeof r === "boolean" ? (r ? 1 : 0) : r;
        if (typeof value === "number") value = Number(value.toFixed(Math.max(dec, 0)));
        const prev = out[p.code];
        if (prev && prev.value === value && prev.source === "calculated" && prev.ruleId === rule.id) continue;
        const c = cell({ ...p, decimals: dec }, value, "calculated", { ruleId: rule.id, ruleVersion: rule.version, formula: rule.expression });
        out[p.code] = c; vars[p.code] = value; changed = true;
      } catch (e) { if (e instanceof MissingVar || e instanceof ExprError) { if (out[p.code]?.source === "calculated") { delete out[p.code]; delete vars[p.code]; changed = true; } continue; } throw e; }
    }
    if (!changed) break;
  }
  return out;
}

import type { ParamDef, Sex } from "../types";
export interface Range { low?: number; high?: number; lowInc: boolean; highInc: boolean }
const n = (s: string) => Number(s.replace(/,/g, ""));
/** Parses "13 - 17", "4,800 - 10,800", "< 2", "> 90", "<=5", "Neg. < 2.0 AU/mL". Returns null for textual refs ("Absent"). */
export function parseRange(text?: string): Range | null {
  if (!text) return null;
  const t = text.replace(/[–—]/g, "-");
  let m = t.match(/(-?[\d,]*\.?\d+)\s*(?:-|to)\s*(-?[\d,]*\.?\d+)/i);
  if (m) { const a = n(m[1]), b = n(m[2]); return { low: Math.min(a, b), high: Math.max(a, b), lowInc: true, highInc: true }; }
  m = t.match(/(<=|≤|<)\s*(-?[\d,]*\.?\d+)/); if (m) return { high: n(m[2]), highInc: m[1] !== "<", lowInc: true };
  m = t.match(/(>=|≥|>)\s*(-?[\d,]*\.?\d+)/); if (m) return { low: n(m[2]), lowInc: m[1] !== ">", highInc: true };
  return null;
}
export function pickRefText(p: ParamDef, sex?: Sex, ageYears?: number): string {
  for (const r of p.ranges ?? []) {
    if (r.sex && r.sex !== "any" && r.sex !== sex) continue;
    if (r.ageMin !== undefined && (ageYears ?? 0) < r.ageMin) continue;
    if (r.ageMax !== undefined && (ageYears ?? 0) >= r.ageMax) continue;
    return r.text;
  }
  return p.ref ?? "";
}
export function flagFor(value: number | string | null, refText: string): "" | "L" | "H" {
  if (typeof value !== "number" || !isFinite(value)) return "";
  const r = parseRange(refText); if (!r) return "";
  if (r.low !== undefined && (r.lowInc ? value < r.low : value <= r.low)) return "L";
  if (r.high !== undefined && (r.highInc ? value > r.high : value >= r.high)) return "H";
  return "";
}
